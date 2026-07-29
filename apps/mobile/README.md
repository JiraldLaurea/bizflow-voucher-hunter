# Voucher Hunt Mobile

Expo SDK 57 Android client for the customer-facing Voucher Hunt experience.
The Next.js app at the repository root remains the API server and web
admin/staff dashboard.

## Configure the API

Copy `.env.example` to `.env.local`, then set:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
```

- Android emulator: use `http://10.0.2.2:3000`.
- Physical Android device: use the development computer's LAN address, such
  as `http://192.168.1.10:3000`. The phone and computer must share a network.
- Production: use the stable HTTPS deployment. Non-HTTPS production URLs are
  rejected so bearer tokens are never sent over plaintext HTTP.

Do not put secrets in `EXPO_PUBLIC_*` variables. The API base URL is public
configuration.

## Run

From the repository root:

```bash
npm run dev
npm run mobile
```

In the Expo terminal, press `a` to open Android. You can also run:

```bash
npm run mobile:android
```

## Phase 2 behavior

- Phone number and manual six-digit OTP sign-in.
- The OTP verify request opts into a mobile bearer token.
- The opaque bearer token and normalized phone are persisted with
  `expo-secure-store`.
- Expo Router protected routes prevent access to Home, Vouchers, and More
  until authentication is restored.
- Sign out revokes the server token and always clears the local secure
  session.
- Home and Vouchers are intentionally shell screens. Their data journeys are
  Phase 3 and Phase 4.

## Validation

```bash
npm run mobile:typecheck
npm run lint --workspace @voucher-hunt/mobile
cd apps/mobile
npx expo export --platform android --output-dir dist
```

`npx expo-doctor` currently reports 19/20 checks. Its remaining duplicate-React
warning is caused by the two applications intentionally requiring different
majors: the root Next.js 14 web app uses React 18, while Expo SDK 57 uses its
app-local React 19. Metro's Android export resolves the mobile-local copy and
passes. Do not add a root React override, because that would break the web
app's supported dependency range; revisit this when the web framework is
upgraded.
