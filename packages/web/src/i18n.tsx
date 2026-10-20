/** Renderer i18n context: the UI language lives in the main process's settings
 *  store (the desktop truth source) and is mirrored here for instant first
 *  paint (localStorage cache) and live switching. The provider bootstraps once
 *  per window via the `get_language` IPC (browser builds without the bridge
 *  fall back to the localStorage cache), listens to `journal://language-changed`
 *  so a switch in the settings window flips every open window immediately, and
 *  mirrors the value into the module-level currentLang() so the HTTP client
 *  localizes server responses too. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { t, type I18nKey, type Lang } from "@manta-journal/shared";

import { currentLang, setCurrentLang } from "./i18n-lang";
import { setServerLanguage } from "./api";

interface I18n {
  lang: Lang;
  /** Translate a key with positional {0} params against the current language. */
  t: (key: I18nKey, ...params: (string | number)[]) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18n | null>(null);

const hasDesktopBridge = () =>
  typeof (globalThis as { journal?: unknown }).journal !== "undefined";

export function I18nProvider({ children }: { children: ReactNode }) {
  // localStorage cache first (same origin → shared across the app's windows),
  // then the desktop bridge's stored value wins once it arrives.
  const [lang, setLangState] = useState<Lang>(() => currentLang());

  useEffect(() => {
    if (!hasDesktopBridge()) return;
    void window.journal
      .invoke<Lang>("get_language")
      .then((stored) => {
        setCurrentLang(stored);
        setLangState(stored);
      })
      .catch(() => {});
    return window.journal.listen("journal://language-changed", (next: Lang) => {
      setCurrentLang(next);
      setLangState(next);
    });
  }, []);

  const setLang = useCallback((next: Lang) => {
    setCurrentLang(next);
    setLangState(next);
    if (hasDesktopBridge()) {
      void window.journal
        .invoke("set_language", next)
        // The main process rebroadcasts journal://language-changed to every
        // window; push the language to the server too, so the journal
        // scheduler's hourly pass writes in the language the user reads.
        .then(() => setServerLanguage(next))
        .catch(() => {});
    }
  }, []);

  const value = useMemo<I18n>(
    () => ({ lang, t: (key, ...params) => t(lang, key, ...params), setLang }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}
