import { isTeamLogo } from "../domain/team.js";
export function rememberedProjects(storage, account) {
  try {
    const rows = JSON.parse(
      storage.getItem("evony-projects:" + account) || "[]",
    );
    return Array.isArray(rows)
      ? rows.filter(
          (r) =>
            r &&
            typeof r.id === "string" &&
            /^[\w-]+$/.test(r.id) &&
            typeof r.name === "string",
        )
      : [];
  } catch {
    return [];
  }
}
export function rememberProject(storage, account, file) {
  const rows = rememberedProjects(storage, account).filter(
    (r) => r.id !== file.id,
  );
  rows.unshift({
    id: file.id,
    name: file.name,
    ...(file.teamFileId
      ? {
          teamFileId: file.teamFileId,
          teamFileResourceKey: file.teamFileResourceKey || "",
        }
      : {}),
    ...(isTeamLogo(file.logo) ? { logo: file.logo } : {}),
    resourceKey: file.resourceKey || "",
    lastOpened: Date.now(),
  });
  storage.setItem(
    "evony-projects:" + account,
    JSON.stringify(rows.slice(0, 50)),
  );
}

export function forgetProject(storage, account, id) {
  const rows = rememberedProjects(storage, account).filter(
    (project) => project.id !== id,
  );
  storage.setItem("evony-projects:" + account, JSON.stringify(rows));
}
