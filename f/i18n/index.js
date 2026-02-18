import { LOCALE_EN } from "./locales/en.js";
import { LOCALE_RU } from "./locales/ru.js";

export const LOCALE_OVERRIDE_KEY = "followup_locale_override_v1";

const FALLBACK_LOCALE = "en";
const MESSAGES = {
  en: LOCALE_EN,
  ru: LOCALE_RU,
};

function normalizeLocale(value) {
  return (value || "").toLowerCase().split("-")[0];
}

function getByPath(source, key) {
  return key.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), source);
}

function interpolate(template, params) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (full, token) => {
    if (params[token] === undefined || params[token] === null) return full;
    return String(params[token]);
  });
}

export function resolveLocale() {
  let override = "";
  try {
    override = localStorage.getItem(LOCALE_OVERRIDE_KEY) || "";
  } catch {
    override = "";
  }

  const preferred = [override, ...(navigator.languages || []), navigator.language || ""]
    .map((item) => normalizeLocale(item))
    .filter(Boolean);

  const picked = preferred.find((candidate) => Boolean(MESSAGES[candidate]));
  return picked || FALLBACK_LOCALE;
}

export function localeToIntlTag(locale) {
  return locale === "ru" ? "ru-RU" : "en-US";
}

export function createI18n(locale) {
  const activeLocale = MESSAGES[locale] ? locale : FALLBACK_LOCALE;

  function t(key, params = {}) {
    const localized = getByPath(MESSAGES[activeLocale], key);
    const fallback = getByPath(MESSAGES[FALLBACK_LOCALE], key);
    const value = localized ?? fallback;
    if (typeof value !== "string") return key;
    return interpolate(value, params);
  }

  function applyToDocument(root = document) {
    document.documentElement.lang = activeLocale;

    root.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
    });

    root.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.setAttribute("title", t(element.dataset.i18nTitle));
    });

    root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
  }

  return {
    locale: activeLocale,
    intlLocale: localeToIntlTag(activeLocale),
    t,
    applyToDocument,
  };
}
