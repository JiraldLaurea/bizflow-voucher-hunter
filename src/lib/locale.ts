import { cookies, headers } from "next/headers";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  type Language,
} from "@/i18n/languages";
import { LANGUAGE_COOKIE } from "@/lib/language-cookie";

/**
 * The first supported language the browser asks for.
 *
 * `Accept-Language` is ordered by preference and its entries may carry a region
 * (`ko-KR`) or a quality weight (`ja;q=0.8`), so each tag is cut back to its
 * base subtag before matching. Weights are left in the browser's order rather
 * than sorted: in practice browsers already send the list highest-first, and
 * honouring a hand-written `q` ordering is not worth the parsing.
 */
function fromAcceptLanguage(header: string | null): Language | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    const base = tag?.split("-")[0];
    if (base && isSupportedLanguage(base)) return base;
  }
  return null;
}

/**
 * Which language to render, in priority order:
 *
 *   1. the cookie, if the visitor has ever used the selector
 *   2. the browser's `Accept-Language`, when it names one of the four
 *   3. English
 *
 * Mirrors the mobile app's rule (stored choice, then device language, then
 * English) so a Korean browser lands on Korean copy without touching anything,
 * and the selector exists for the cases that misses. See docs/I18N.md.
 */
export function resolveLanguage(): Language {
  const stored = cookies().get(LANGUAGE_COOKIE)?.value;
  if (stored && isSupportedLanguage(stored)) return stored;
  return fromAcceptLanguage(headers().get("accept-language")) ?? DEFAULT_LANGUAGE;
}
