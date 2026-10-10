export function parseDriveLink(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Paste a Google Drive file or folder URL.");
  }
  if (url.hostname !== "drive.google.com" || url.protocol !== "https:")
    throw new Error("Use an https://drive.google.com link.");
  const id =
    url.pathname.match(/\/(?:folders|d)\/([\w-]+)/)?.[1] ||
    url.searchParams.get("id");
  if (!id || !/^[\w-]+$/.test(id))
    throw new Error("This Drive URL has no file or folder ID.");
  return {
    id,
    ...(!url.pathname.includes("/folders/") ? { kind: "file" } : {}),
    resourceKey: url.searchParams.get("resourcekey") || "",
  };
}
// Shared app links and Drive links are both valid entry points to the team file.
export function parseTeamLink(link, appUrl = globalThis.location?.href) {
  if (appUrl) {
    let url;
    try {
      url = new URL(link);
    } catch {
      return parseDriveLink(link);
    }
    const app = new URL(appUrl),
      params = new URLSearchParams(url.hash.slice(1));
    const id = params.get("team"),
      resourceKey = params.get("resourceKey") || "";
    const pathname = (value) => value.replace(/\/index\.html$/, "/");
    if (
      url.origin === app.origin &&
      pathname(url.pathname) === pathname(app.pathname) &&
      /^[\w-]{1,200}$/.test(id || "") &&
      resourceKey.length <= 200
    )
      return { id, resourceKey, kind: "file" };
  }
  return parseDriveLink(link);
}
