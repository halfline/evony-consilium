function searchableText(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[ɛεϵ]/g, "e");
}

export function matchesPlayerSearch(player, query, extra = "") {
  return searchableText(
    `${player.name || ""} ${player.accountId || ""} ${player.allianceTag || ""} ${extra}`,
  ).includes(searchableText(query));
}
