import { redirect } from "next/navigation";

/**
 * The campaign journey lives in the mobile app now; this route only survives as
 * the address printed on QR codes and shared links.
 *
 * It is still a verified Android App Link (see `.well-known/assetlinks.json`),
 * so a visitor with the app installed never reaches this handler — Android hands
 * the URL to the app first. This is the fallback for everyone else, and sending
 * them to the app landing page is the only useful thing left to do with the
 * request: the campaign they scanned cannot be opened without the app.
 *
 * The slug is deliberately dropped rather than passed along. `/client` has no
 * per-campaign view to deep-link into, so a query string would only be noise in
 * the address bar.
 */
export default function CampaignRedirectPage() {
  redirect("/client");
}
