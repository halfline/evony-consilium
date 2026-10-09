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
