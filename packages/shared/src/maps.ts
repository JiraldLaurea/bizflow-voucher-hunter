/**
 * Google Maps links for a venue address.
 *
 * Uses the documented Maps URL scheme rather than a lat/lng deep link: we only
 * ever have a written address, and this form resolves it the same way a search
 * would. It also works everywhere — the Maps app when installed, the browser
 * otherwise — which a `geo:` or `comgooglemaps://` URI would not.
 */
export function buildMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

/**
 * A `tel:` URI for a contact number.
 *
 * Strips spaces, dashes and brackets, which are common in written numbers and
 * which some dialers refuse. A leading `+` is kept: it is significant.
 */
export function buildTelUrl(contactNumber: string): string {
  return `tel:${contactNumber.trim().replace(/(?!^\+)[^\d]/g, "")}`;
}
