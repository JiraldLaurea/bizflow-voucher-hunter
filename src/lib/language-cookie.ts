/**
 * Shared by the server (which reads the cookie) and the selector (which writes
 * it). Kept apart from `lib/locale.ts` because that module imports
 * `next/headers`, which cannot be pulled into a client component.
 */

/**
 * Readable by client JavaScript on purpose: the selector writes it with
 * `document.cookie` so switching language costs no round trip to an API route.
 * It holds a language code and nothing else, so there is nothing to protect.
 */
export const LANGUAGE_COOKIE = "vh_lang";

/** A year — a language preference has no reason to expire mid-session. */
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
