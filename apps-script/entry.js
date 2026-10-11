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
