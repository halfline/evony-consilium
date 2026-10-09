import { createBrowserWorkspace } from "./src/services/browser-workspace.js";
import { googleConfig } from "./google-config.js";
import { createPlanner } from "./src/ui/planner.js";
import { loadResources } from "./src/services/resources.js";
import { createNotifier } from "./src/ui/notifications.js";

try {
  const planner = createPlanner(await loadResources(), {
    createWorkspace: (callbacks) =>
      createBrowserWorkspace(googleConfig, callbacks),
  });
  document.getElementById("loading").hidden = true;
  await planner.start();
} catch (error) {
  document.getElementById("loading").hidden = true;
  const message = "Could not load the planner: " + error.message;
  document.getElementById("login-detail").textContent = message;
  createNotifier(document.getElementById("toast"))(message, true);
}
