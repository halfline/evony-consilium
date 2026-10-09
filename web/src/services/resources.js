async function readJSON(url, message) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(message);
  return response.json();
}

// Player screens need castle and avatar catalogs before any map resources exist.
export async function loadResources() {
  const [catalog, avatarCatalog] = await Promise.all([
    readJSON("assets/catalog.json", "The graphics catalog could not be loaded."),
    readJSON("assets/avatar-catalog.json", "The avatar catalog could not be loaded."),
  ]);
  return { catalog, avatarCatalog };
}
