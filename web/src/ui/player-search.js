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

function matchRank(player, query, extra) {
  const literal = query.toLowerCase();
  if (!literal) return 0;
  const fields = [player.name, player.accountId, player.allianceTag, extra]
    .filter(Boolean)
    .map((value) => value.toLowerCase());
  if (fields.some((value) => value === literal)) return 0;
  if (fields.some((value) => value.includes(literal))) return 1;
  return 2;
}

export function comparePlayerSearch(a, b, query, extraA = "", extraB = "") {
  return matchRank(a, query, extraA) - matchRank(b, query, extraB);
}
