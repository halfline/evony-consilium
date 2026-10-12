export function orderByPlayerOwner(plan, items, ownerId) {
  const players = plan.keeps.filter((player) => player.ownerId == null);
  players.sort((a, b) => b.level - a.level);
  const rank = new Map(players.map((player, index) => [player.id, index]));
  const byId = new Map(plan.keeps.map((player) => [player.id, player]));
  const group = (item) => {
    const id = ownerId(item);
    return rank.get(byId.get(id)?.ownerId || id) ?? Infinity;
  };
  return items.sort((a, b) => group(a) - group(b));
}
