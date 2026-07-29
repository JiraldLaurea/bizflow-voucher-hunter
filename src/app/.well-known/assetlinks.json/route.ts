import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Android App Links verification.
 *
 * The `autoVerify` intent filter in the mobile app's `app.config.js` only takes
 * effect if this domain serves a matching statement. Without it Android silently
 * falls back to a disambiguation dialog ("open with…") instead of going straight
 * to the app.
 *
 * The fingerprint must be the **Play App Signing** SHA-256, not the upload key —
 * Play re-signs the AAB, so the certificate users actually receive is Google's.
 * Find it in Play Console → Release → Setup → App signing → "App signing key
 * certificate". Multiple fingerprints may be listed comma-separated so a local
 * debug build can be verified alongside the Play release.
 *
 * Serves an empty statement list when unconfigured rather than 404ing, so the
 * URL always exists and the misconfiguration is visible.
 */
export function GET() {
  const packageName =
    process.env.ANDROID_PACKAGE_NAME?.trim() || "com.voucherhunt.mobile";
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const statements =
    fingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: packageName,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [];

  return NextResponse.json(statements, {
    headers: {
      "content-type": "application/json",
      // Android re-checks periodically; a short cache keeps a fingerprint fix
      // from being masked by a stale CDN copy.
      "cache-control": "public, max-age=300",
    },
  });
}
