export function matchesPlayerSearch(player, query, extra = "") {
  return `${player.name || ""} ${player.accountId || ""} ${player.allianceTag || ""} ${extra}`
    .toLowerCase()
    .includes(query.toLowerCase());
}
