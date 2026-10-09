import { createBrowserWorkspace } from "./src/services/browser-workspace.js";
import { googleConfig } from "./google-config.js";
import { createPlanner } from "./src/ui/planner.js";
import { createNotifier } from "./src/ui/notifications.js";

try {
  const planner = createPlanner({}, {
    createWorkspace: (callbacks) =>
      createBrowserWorkspace(googleConfig, callbacks),
  });
  await planner.start();
} catch (error) {
  const message = "Could not load the planner: " + error.message;
  document.getElementById("login-detail").textContent = message;
  createNotifier(document.getElementById("toast"))(message, true);
}
