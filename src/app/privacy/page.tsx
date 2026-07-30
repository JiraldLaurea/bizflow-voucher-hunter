import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Voucher Hunt",
  description:
    "How Voucher Hunt collects, uses, and shares personal information.",
};

/**
 * Public privacy policy.
 *
 * Google Play requires a publicly reachable policy URL for any app that handles
 * personal data, and this app handles phone numbers. Deliberately unauthenticated
 * and statically rendered so the Play Console reviewer and the store listing can
 * both reach it.
 *
 * DRAFT — the contents mirror what the code actually does (see docs/PLAY_RELEASE.md
 * for the audit), but this has NOT been reviewed by a lawyer. Philippine Data
 * Privacy Act obligations and the operating entity's legal name still need to be
 * confirmed before publishing.
 */
const UPDATED = "30 July 2026";

/**
 * Declared to Google Play as the account-deletion contact, so it must stay in
 * step with `SUPPORT_EMAIL` in /delete-account and with the address on the store
 * listing. Play reviewers do test it.
 */
const SUPPORT_EMAIL = "yangpspider@gmail.com";

export default function PrivacyPolicyPage() {
  return (
    <main className="page-shell legal-page">
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: {UPDATED}</p>

      <p>
        Voucher Hunt lets you sign in with your mobile number, reveal a voucher,
        reserve a time to use it, and earn Loyalty Points at participating
        partner businesses. This policy explains what we collect, why, and who we
        share it with.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Mobile number (required).</strong> Sign-in is by one-time SMS
          code, so we cannot identify your vouchers or points without it.
        </li>
        <li>
          <strong>Name (required to confirm a voucher).</strong> Shown to partner
          staff so they can match a reservation to you.
        </li>
        <li>
          <strong>Email address (optional).</strong> Only stored if you enter it.
        </li>
        <li>
          <strong>Notification token.</strong> If you allow notifications, we
          store the push token your device issues. It identifies the device, not
          you personally.
        </li>
        <li>
          <strong>Activity in the service.</strong> Vouchers drawn and issued,
          reservations, Loyalty Points earned and spent, and referral link opens.
        </li>
      </ul>

      <p>
        We do <strong>not</strong> collect your location, contacts, photos, or
        the contents of your SMS inbox. The app never reads SMS messages — you
        type the verification code yourself. There are no advertising or
        third-party analytics SDKs in the app.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To sign you in and keep you signed in.</li>
        <li>
          To issue vouchers, hold reservations, and let partner staff validate a
          voucher you present.
        </li>
        <li>To calculate and settle Loyalty Points.</li>
        <li>
          To send you service messages: your voucher confirmation by SMS, and —
          only if you allow it — notifications about your points and bookings.
        </li>
        <li>
          To detect abuse, such as repeated scans intended to inflate Loyalty
          Points.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <ul>
        <li>
          <strong>Partner businesses.</strong> When you present a voucher, staff
          see the voucher and the name on the reservation. For Loyalty Points
          they see a masked mobile number, not the full one.
        </li>
        <li>
          <strong>Our SMS provider,</strong> to deliver your verification code
          and voucher confirmation. They receive your mobile number and the
          message.
        </li>
        <li>
          <strong>Expo&apos;s push notification service,</strong> to deliver
          notifications to your device. It receives the push token and the
          notification text.
        </li>
        <li>
          <strong>Our hosting and database providers,</strong> who store the data
          on our behalf.
        </li>
      </ul>

      <p>
        We do not sell your personal information, and we do not share it for
        advertising.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Account and voucher records are kept while your account is active, and
        afterwards only as long as needed for settlement with partner businesses
        and for our legal and accounting obligations. Sign-in sessions expire
        automatically.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Notifications.</strong> Turn any category off under
          <em> More → Notifications</em> in the app, or switch them off entirely
          in your device settings.
        </li>
        <li>
          <strong>Signing out</strong> removes the session from your device and
          stops notifications to it.
        </li>
        <li>
          <strong>Access or deletion.</strong> Contact us using the details below
          to request a copy of your data. To close your account, see{" "}
          <a href="/delete-account">Delete your account</a>, which sets out the
          steps and what we keep afterwards.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        Voucher Hunt is not directed to children and we do not knowingly collect
        information from them.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes materially, we will update the date above and, if
        the change is significant, tell you in the app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, data access requests, and deletion requests:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </main>
  );
}
