// Team links are shared metadata, independent of any map layout.
export function normalizeDiscordUrl(value = "") {
  if (typeof value !== "string" || value.length > 2048)
    throw new Error("Enter a valid Discord invite or channel link.");
  const text = value.trim();
  if (!text) return "";
  let url;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : "https://" + text);
  } catch {
    throw new Error("Enter a valid Discord invite or channel link.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    ![
      "discord.gg",
      "discord.com",
      "www.discord.com",
      "discordapp.com",
      "www.discordapp.com",
    ].includes(url.hostname)
  )
    throw new Error("Enter a valid Discord invite or channel link.");
  return url.href;
}

export const isTeamLogo = (value) =>
  typeof value === "string" &&
  value.length <= 100000 &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
