import { SUBCITY_CULTURES } from "../domain/subcities.js";
import { option } from "./dom.js";

export function subcityTypeOptions() {
  return [
    option("", "All types"),
    ...SUBCITY_CULTURES.map((culture) => option(culture, culture)),
    option("historic", "Historic"),
    option("famous", "Famous"),
  ];
}

export function subcityFilterCategory(type, culture) {
  return type?.category === "culture" ? culture : type?.category || culture;
}
