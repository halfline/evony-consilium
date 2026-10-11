// Apps Script lacks structuredClone. Consilium Drive documents contain only
// JSON values; undefined must also survive the existing merge helpers.
export const structuredClone = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));
