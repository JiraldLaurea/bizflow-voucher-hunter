"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FiChevronDown, FiGlobe } from "react-icons/fi";
import { LANGUAGES, LANGUAGES_SHORT, type Language } from "@/i18n/languages";
import {
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
} from "@/lib/language-cookie";

/**
 * The one interactive control on an otherwise static page.
 *
 * A native `<select>` rather than a custom dropdown: it is keyboard and screen
 * reader correct without any of the roving-focus code a listbox needs, and on
 * phones it opens the OS picker, which is a better control than anything worth
 * building here. The cost is that the options cannot be styled, which does not
 * matter for four language names.
 *
 * The select is stretched over the whole pill at zero opacity and the label
 * beside the globe is ours, which is what lets the pill carry a caret and swap
 * the spelt-out name for its narrow form when the nav runs out of room. The
 * select still holds the value, the label and the focus, so none of that is
 * reimplemented — only the painting is.
 *
 * Switching writes the cookie and calls `router.refresh()`, which re-renders the
 * server component with the new catalogue. The copy never ships to the browser
 * in four languages — only the language that was asked for.
 */
export function LanguageSelector({ language }: { language: Language }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(next: string) {
    // `SameSite=Lax` because this is a preference and nothing else; `path=/` so
    // it still applies if the page ever moves off the root route.
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="marketing-language" data-pending={isPending ? "" : undefined}>
      <FiGlobe aria-hidden="true" className="marketing-language-globe" />
      {/*
       * Both forms are rendered and one is hidden by a media query rather than
       * picked in JS: the page is server-rendered and the nav must be right on
       * the first paint, before any width is known to the client.
       *
       * `aria-hidden` on both because the select underneath already announces
       * the current language — without it the name is read out twice.
       */}
      <span aria-hidden="true" className="marketing-language-name">
        {LANGUAGES[language]}
      </span>
      <span aria-hidden="true" className="marketing-language-name-short">
        {LANGUAGES_SHORT[language]}
      </span>
      <FiChevronDown aria-hidden="true" className="marketing-language-caret" />
      <select
        aria-label={
          // Deliberately not translated through `t`: a screen reader user who
          // has landed on the wrong language needs this label to be findable,
          // and the language names beside it are already self-describing.
          "Language"
        }
        className="marketing-language-select"
        onChange={(event) => change(event.target.value)}
        value={language}
      >
        {Object.entries(LANGUAGES).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
