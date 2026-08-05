/**
 * The one address the product publishes.
 *
 * It is declared to Google Play as the account-deletion contact, so the privacy
 * policy, the deletion instructions and the marketing page must all show the
 * same string — three hand-typed copies is three chances to drift after the
 * next inbox change. Change it here.
 */
export const SUPPORT_EMAIL = "yangpspider@gmail.com";

/**
 * `mailto:` for a business enquiry from the marketing page, with the subject
 * pre-filled so these land as something recognisable rather than an unlabelled
 * message in the same inbox that handles deletion requests.
 */
export const BUSINESS_ENQUIRY_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  "Voucher Hunt for my business",
)}&body=${encodeURIComponent(
  [
    "Business name:",
    "Type of business:",
    "Where you're located:",
    "",
    "What you'd like to run:",
    "",
  ].join("\n"),
)}`;
