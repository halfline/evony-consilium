export const $ = (id) => document.getElementById(id);
export function option(value, text) {
  const e = document.createElement("option");
  e.value = value;
  e.textContent = text;
  return e;
}

export function view(...roots) {
  if (!roots.length || roots.some((root) => !root))
    throw new Error("A view needs its DOM roots.");
  const nodes = new Map();
  return (id) => {
    if (!nodes.has(id) || !roots.some((root) => root.contains(nodes.get(id)))) {
      const node = roots
        .flatMap((root) => [root, ...root.querySelectorAll("[id]")])
        .find((node) => node.id === id);
      if (!node) throw new Error(`Missing view control: ${id}`);
      nodes.set(id, node);
    }
    return nodes.get(id);
  };
}
