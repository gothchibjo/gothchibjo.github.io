import { HEADER_PAIRS_EN } from "./en.js";
import { HEADER_PAIRS_RU } from "./ru.js";

export const HEADER_PAIRS_BY_LOCALE = {
  en: HEADER_PAIRS_EN,
  ru: HEADER_PAIRS_RU,
};

export function getHeaderPairsForLocale(locale) {
  const normalized = (locale || "en").toLowerCase().split("-")[0];
  return HEADER_PAIRS_BY_LOCALE[normalized] || HEADER_PAIRS_EN;
}

export function getRandomHeaderPair(locale) {
  const pairs = getHeaderPairsForLocale(locale);
  if (!pairs.length) return ["Do", "Get"];
  const index = Math.floor(Math.random() * pairs.length);
  return pairs[index];
}
