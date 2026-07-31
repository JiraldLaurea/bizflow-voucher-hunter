import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  catalogues,
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  type Language,
  type TranslationKey,
} from "@/i18n/translations";

const LANGUAGE_KEY = "voucher_hunt_language";

type LanguageContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
  /** True until the stored choice has been read, so nothing renders in the wrong language. */
  isLoading: boolean;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * The device language, when we support it.
 *
 * This is why there is no language step on first launch: a Korean phone opens
 * the app in Korean already, so a picker would be a gate that almost every user
 * dismisses without reading. The selector in More covers the rest — someone
 * whose phone is in a language we do not carry, or who simply prefers another.
 */
function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    const code = locale.languageCode?.toLowerCase();
    if (code && isSupportedLanguage(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}

/** Substitutes {name} placeholders; leaves unknown ones untouched to aid debugging. */
function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      let resolved = DEFAULT_LANGUAGE;
      try {
        const stored = await SecureStore.getItemAsync(LANGUAGE_KEY);
        // An explicit choice always wins over the device setting, including when
        // the user deliberately picked English on a non-English phone.
        resolved = stored && isSupportedLanguage(stored) ? stored : deviceLanguage();
      } catch {
        resolved = deviceLanguage();
      }
      if (!active) return;
      setLanguageState(resolved);
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    // Switch immediately; persisting is not worth making the UI wait on.
    setLanguageState(next);
    void SecureStore.setItemAsync(LANGUAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const catalogue = catalogues[language];
    return {
      language,
      setLanguage,
      isLoading,
      t: (key, vars) =>
        // Fall back to English rather than showing a raw key: a missing
        // translation should read as untranslated, not as broken.
        interpolate(catalogue[key] ?? catalogues[DEFAULT_LANGUAGE][key] ?? key, vars),
    };
  }, [isLoading, language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside a LanguageProvider");
  return context;
}

/** Convenience for components that only need the translate function. */
export function useTranslation() {
  return useLanguage().t;
}
