import { ScriptDrive } from "./drive.js";
import { syncTeam, validateConfig } from "./sync.js";

const CONFIG = "CONSILIUM_CONFIG",
  CURSOR = "CONSILIUM_CURSOR",
  REPORT = "CONSILIUM_LAST_REPORT",
  USAGE = "CONSILIUM_DAILY_USAGE";
const HANDLER = "syncConsiliumTeam";

// Services are injected so the actual trigger lifecycle and generated bundle
// can be exercised without real credentials or a running Apps Script project.
export function createRuntime({
  properties,
  lock,
  triggers,
  fetch,
  token,
  uuid,
  now = Date.now,
  log = console.log,
}) {
  function exclusive(task) {
    if (!lock.tryLock(1000))
      return { skipped: "Another sync operation is running." };
    try {
      return task();
    } finally {
      lock.releaseLock();
    }
  }
  function config() {
    const saved = properties.getProperty(CONFIG);
    if (!saved)
      throw new Error(
        "Run configureConsiliumSync before installing or running sync.",
      );
    return validateConfig(JSON.parse(saved));
  }
  function execute(settings, dryRun, resetCursor = false) {
    const started = now();
    let usage = JSON.parse(properties.getProperty(USAGE) || "null");
    if (
      !usage ||
      !Number.isFinite(usage.windowStartedAt) ||
      started - usage.windowStartedAt >= 86400000
    )
      usage = { windowStartedAt: started, calls: 0, milliseconds: 0 };
    // Conservative per-script limits leave room below consumer quotas. Other
    // scripts on the same Google account still share Google's actual quotas.
    const remaining = 60 * 60 * 1000 - usage.milliseconds;
    if (usage.calls >= 15000 || remaining < 10000) {
      const report = {
        state: "quota-paused",
        at: new Date(started).toISOString(),
        retryAfter: new Date(usage.windowStartedAt + 86400000).toISOString(),
      };
      properties.setProperty(REPORT, JSON.stringify(report));
      log(JSON.stringify(report));
      return report;
    }
    const drive = new ScriptDrive({
      fetch: (url, options) => {
        if (usage.calls >= 15000)
          throw Object.assign(
            new Error("Local daily request budget exhausted."),
            { status: 429 },
          );
        usage.calls++;
        return fetch(url, options);
      },
      token,
      uuid,
    });
    try {
      const report = syncTeam({
        drive,
        config: settings,
        cursor: resetCursor ? 0 : Number(properties.getProperty(CURSOR) || 0),
        dryRun,
        now,
        deadline: started + Math.min(120000, remaining),
      });
      if (!dryRun) properties.setProperty(CURSOR, String(report.nextCursor));
      const saved = {
        ...report,
        state: report.warnings.length ? "partial" : "ok",
        at: new Date(now()).toISOString(),
        warningCount: report.warnings.length,
        warnings: report.warnings.slice(0, 10),
      };
      properties.setProperty(REPORT, JSON.stringify(saved));
      log(JSON.stringify(saved));
      return saved;
    } catch (error) {
      const report = {
        state: "error",
        at: new Date(now()).toISOString(),
        message: error.message,
        ...(error.status ? { status: error.status } : {}),
      };
      properties.setProperty(REPORT, JSON.stringify(report));
      log(JSON.stringify(report));
      throw error;
    } finally {
      usage.milliseconds += Math.max(0, now() - started);
      properties.setProperty(USAGE, JSON.stringify(usage));
    }
  }
  return {
    run(dryRun = false) {
      return exclusive(() => execute(config(), dryRun));
    },
  };
}
