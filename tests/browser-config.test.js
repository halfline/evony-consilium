import assert from "node:assert/strict";
import { test } from "node:test";
import { browserConfigModule } from "../scripts/browser-config.js";

async function loadConfig(env) {
  const source = browserConfigModule(env);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  return (await import(url)).googleConfig;
}

test("browser config is unconfigured when environment values are absent", async () => {
  assert.deepEqual(await loadConfig({}), {
    clientId: "",
    apiKey: "",
    appId: "",
  });
});

test("browser config preserves values that need JavaScript escaping", async () => {
  const env = {
    GOOGLE_CLIENT_ID: 'client"with\\quotes',
    GOOGLE_PICKER_API_KEY: "key\nwith newline",
    GOOGLE_CLOUD_PROJECT_NUMBER: "123456789012",
  };
  assert.deepEqual(await loadConfig(env), {
    clientId: env.GOOGLE_CLIENT_ID,
    apiKey: env.GOOGLE_PICKER_API_KEY,
    appId: env.GOOGLE_CLOUD_PROJECT_NUMBER,
  });
});
