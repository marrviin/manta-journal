/** Module-level current language, kept outside the React tree so non-React
 *  layers can localize without a hook: the api-http request interceptor reads
 *  this to attach X-App-Language to every memory-service call, and api.ts's
 *  throws use it the same way. I18nProvider keeps it in sync with the UI. */

import { normalizeLang, type Lang } from "@manta-journal/shared";

const STORAGE_KEY = "journal.language";

let current: Lang = normalizeLang(
  typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
);

export function currentLang(): Lang {
  return current;
}

export function setCurrentLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // localStorage unavailable — the in-memory value still drives the session
  }
}
