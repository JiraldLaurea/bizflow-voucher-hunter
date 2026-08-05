/**
 * "July Dinner" -> "july-dinner". The slug is derived from the title rather than
 * typed: it is the campaign's public URL, and letting the two be edited
 * separately produced links that no longer resembled the campaign they opened.
 *
 * Accents are stripped before the non-alphanumeric sweep so "Café" becomes
 * "cafe" rather than "caf".
 */
export function campaignSlug(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
