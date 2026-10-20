//! Main-process i18n: the UI language lives in the settings store under
//! `ui_language` and is read fresh on every call, so switching it in the
//! settings window takes effect immediately — no restart. The renderer
//! keeps its own live copy (I18nProvider) and syncs via the
//! `journal://language-changed` broadcast from the set_language IPC.

import { t, normalizeLang, type I18nKey, type Lang } from '@manta-journal/shared';
import * as store from './store';

export const LANG_KEY = 'ui_language';

export function getLang(): Lang {
  // Defensive: module top-level / early-boot callers (e.g. the tray menu before
  // startGui opens the store) must not crash on the uninitialized DB.
  try {
    return normalizeLang(store.getSetting(LANG_KEY));
  } catch {
    return 'zh';
  }
}

export function setLang(lang: Lang): void {
  store.setSetting(LANG_KEY, lang);
}

/** Translate against the current store language (positional {0} params). */
export function tMain(key: I18nKey, ...params: (string | number)[]): string {
  return t(getLang(), key, ...params);
}
