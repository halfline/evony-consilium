import { createRuntime } from "./runtime.js";

function runtime() {
  return createRuntime({
    properties: PropertiesService.getScriptProperties(),
    lock: LockService.getScriptLock(),
    triggers: {
      list: () => ScriptApp.getProjectTriggers(),
      remove: (trigger) => ScriptApp.deleteTrigger(trigger),
      create: (handler, minutes) =>
        ScriptApp.newTrigger(handler)
          .timeBased()
          .everyMinutes(minutes)
          .create(),
    },
    fetch: (url, options) => UrlFetchApp.fetch(url, options),
    token: () => ScriptApp.getOAuthToken(),
    uuid: () => Utilities.getUuid(),
  });
}

export const configure = () => runtime().configure(consiliumConfig_());
export const install = () => runtime().install();
export const setup = () => {
  const job = runtime();
  job.configure(consiliumConfig_());
  return job.install();
};
export const sync = () => runtime().run();
export const preview = () => runtime().run(true);
export const uninstall = () => runtime().uninstall();
export const status = () => runtime().status();
