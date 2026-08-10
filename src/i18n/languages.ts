/**
 * What the four supported languages *are*, separate from anything written in
 * them.
 *
 * The web has two catalogues — `marketing.ts` for the business landing page and
 * `client.ts` for the customer one — and both need the same language set, the
 * same fallback rule and the same names in the selector. Those live here so
 * neither catalogue is the other's dependency: importing `Language` from
 * "marketing" in order to render the customer page reads like a mistake even
 * when it works.
 */

export const LANGUAGES = {
  en: "English",
  ko: "한국어",
  zh: "中文",
  ja: "日本語",
} as const;

export type Language = keyof typeof LANGUAGES;

/**
 * The narrow form of each name, for the language selector once the nav is too
 * tight to spell one out.
 *
 * Native rather than the ISO code — a Chinese reader recognises 中 immediately
 * and "ZH" not at all. English has no single-character form, so it keeps the
 * two-letter code it is already known by.
 */
export const LANGUAGES_SHORT: Record<Language, string> = {
  en: "EN",
  ko: "한",
  zh: "中",
  ja: "日",
};

export const DEFAULT_LANGUAGE: Language = "en";

export function isSupportedLanguage(value: string): value is Language {
  return value in LANGUAGES;
}

/**
 * The locale each language formats dates with.
 *
 * Separate from the language code because `zh` alone leaves the region open and
 * Intl then picks one for us; naming it keeps the demo campaign dates stable.
 */
const DATE_LOCALES: Record<Language, string> = {
  en: "en-US",
  ko: "ko-KR",
  zh: "zh-CN",
  ja: "ja-JP",
};

export function dateLocale(language: Language) {
  return DATE_LOCALES[language];
}

/**
 * Builds the lookup for one language out of a set of catalogues.
 *
 * Returned rather than exported as a hook so both landing pages can stay server
 * components — there is no context and no client JavaScript involved in reading
 * a string.
 *
 * English is the fallback: a key a catalogue somehow lacks reads as
 * untranslated rather than as a raw key or a blank. TypeScript already requires
 * every catalogue to carry every key, so this is the runtime backstop, not a
 * licence to leave keys out.
 */
export function buildTranslator<Key extends string>(
  catalogues: Record<Language, Record<Key, string>>,
  language: Language,
): (key: Key) => string {
  const catalogue = catalogues[language];
  const fallback = catalogues[DEFAULT_LANGUAGE];
  return (key) => catalogue[key] ?? fallback[key];
}
