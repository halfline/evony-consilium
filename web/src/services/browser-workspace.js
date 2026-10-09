import { TeamWorkspace } from "./team-workspace.js";
import { TeamRepository } from "../persistence/team-repository.js";
import { GoogleSession } from "./google/session.js";
import { Drive } from "./google/drive.js";
import { DrivePicker } from "./google/picker.js";

export function createBrowserWorkspace(config, callbacks) {
  const session = new GoogleSession(config);
  const token = () => session.token();
  return new TeamWorkspace({
    ...callbacks,
    session,
    drive: new Drive(token),
    picker: new DrivePicker(config, token),
    repository: new TeamRepository(localStorage),
  });
}
