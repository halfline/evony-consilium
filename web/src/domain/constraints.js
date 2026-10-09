// Shared schema constraints; these helpers neither read nor mutate application state.
export function number(value, min, max, label, integer = true) {
  if (
    !Number.isFinite(value) ||
    (integer && !Number.isInteger(value)) ||
    value < min ||
    value > max
  )
    throw new Error("Invalid " + label + ".");
  return value;
}
export const string = (value, max, label) => {
  if (typeof value !== "string" || value.length > max)
    throw new Error("Invalid " + label + ".");
  return value;
};
