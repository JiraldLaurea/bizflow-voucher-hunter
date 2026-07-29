import type {
  Campaign,
  CampaignCard,
  CampaignSlot,
  ClaimedVoucher,
  EndUser,
  ErrorResponse,
  LoyaltyDailyStatus,
  RewardLedgerEntry,
  RewardVoucher,
  RewardWallet,
  SuccessResponse,
  Voucher,
  VoucherAttempt,
  VoucherPool,
} from "@bizflow/shared";

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
};

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export function subscribeToUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => listener());
}

function getApiBaseUrl(): string {
  if (!configuredBaseUrl) {
    throw new ApiError(
      "E-MOBILE-CONFIG",
      "Set EXPO_PUBLIC_API_BASE_URL before starting the mobile app.",
      0,
    );
  }
  if (!__DEV__ && !configuredBaseUrl.startsWith("https://")) {
    throw new ApiError(
      "E-MOBILE-CONFIG",
      "The production API URL must use HTTPS.",
      0,
    );
  }
  return configuredBaseUrl;
}

/**
 * Absolutises an asset path the API serves. Campaign artwork is stored either as
 * a `data:` URI (uploaded) or as a root-relative path like
 * `/images/campaigns/x.png`, which only resolves against the backend's origin —
 * the app has no origin of its own.
 */
export function resolveAssetUrl(src: string): string {
  if (src.startsWith("data:") || /^https?:\/\//.test(src)) return src;
  return `${getApiBaseUrl()}${src.startsWith("/") ? src : `/${src}`}`;
}

export function buildReferralLink(campaignSlug: string, referrerUserId: string) {
  const query = new URLSearchParams({
    campaign: campaignSlug,
    ref: referrerUserId,
  });
  return `${getApiBaseUrl()}/api/public/referral/visit?${query.toString()}`;
}

export type ReferralLinkIdentity = {
  campaignSlug: string;
  referrerUserId: string;
  visitPath: string;
};

export function getReferralLinkIdentity(
  token: string,
  sessionId: string,
  campaignSlug?: string,
): Promise<ReferralLinkIdentity> {
  return apiRequest<ReferralLinkIdentity>("/api/public/referral/link", {
    method: "POST",
    body: { campaignSlug, sessionId },
    token,
  });
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, token, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...requestOptions,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "E-NETWORK",
      "Could not reach Voucher Hunt. Check your connection and API URL.",
      0,
    );
  }

  // A bearer token rejected by the server has been revoked, expired, or wiped by
  // an admin reset. Notify the auth provider before the request error reaches the
  // screen so the locally cached SecureStore session cannot keep the app signed in.
  if (response.status === 401 && token) {
    notifyUnauthorized();
  }

  let payload: SuccessResponse<T> | ErrorResponse;
  try {
    payload = (await response.json()) as SuccessResponse<T> | ErrorResponse;
  } catch {
    throw new ApiError("E-INVALID-RESPONSE", "The server returned an invalid response.", response.status);
  }

  if (!response.ok || !payload.success) {
    const apiFailure = payload as ErrorResponse;
    throw new ApiError(
      apiFailure.error?.code ?? "E-REQUEST",
      apiFailure.error?.message ?? "The request could not be completed.",
      response.status,
      apiFailure.error?.details,
    );
  }

  return payload.data;
}

export type OtpRequestResult = {
  sent: boolean;
  expiresAt: string;
  devCode?: string;
};

export type OtpVerifyResult = {
  phone: string;
  token: string;
};

export function requestOtp(phone: string): Promise<OtpRequestResult> {
  return apiRequest<OtpRequestResult>("/api/public/signin/request-otp", {
    method: "POST",
    headers: { "X-Client": "mobile" },
    body: { phone },
  });
}

export function verifyOtp(phone: string, code: string): Promise<OtpVerifyResult> {
  return apiRequest<OtpVerifyResult>("/api/public/signin/verify-otp", {
    method: "POST",
    headers: { "X-Client": "mobile" },
    body: { phone, code, issueToken: true },
  });
}

export function revokeSession(token: string): Promise<{ signedOut: boolean }> {
  return apiRequest<{ signedOut: boolean }>("/api/public/signin/signout", {
    method: "POST",
    token,
  });
}

/* Hunt flow ---------------------------------------------------------------- */

export type PublicSlot = CampaignSlot & { remainingPoolQuantity: number };

export type PublicCampaign = {
  campaign: Campaign;
  business?: { id: string; name: string; logoText: string; industry: string };
  slots: PublicSlot[];
};

export type HuntState = {
  user: EndUser;
  campaign: Campaign;
  attempts: VoucherAttempt[];
  /** Present once this phone has issued a final voucher for the campaign. */
  voucher?: Voucher;
  remainingBaseAttempts: number;
  remainingBonusAttempts: number;
  sharesGrantedToday: number;
};

export type AttemptSlots = {
  attempt: VoucherAttempt;
  slots: PublicSlot[];
};

export type IssuedVoucher = {
  voucher: Voucher;
  slot: CampaignSlot;
  campaign: Campaign;
  user: EndUser;
};

/** Pool previews that fill the reel. Public, so no token is needed. */
export type RoulettePreview = Pick<
  VoucherPool,
  "benefitType" | "benefitValue" | "displayLabel"
> & {
  poolId?: string;
  probabilityWeight?: number;
  remainingQuantity?: number;
};

export function listCampaigns(token: string): Promise<CampaignCard[]> {
  return apiRequest<CampaignCard[]>("/api/public/campaigns", { token });
}

export function getCampaign(slug: string, token: string): Promise<PublicCampaign> {
  return apiRequest<PublicCampaign>(
    `/api/public/campaigns/${encodeURIComponent(slug)}`,
    { token },
  );
}

export function getCampaignPools(
  slug: string,
  token: string,
): Promise<RoulettePreview[]> {
  return apiRequest<RoulettePreview[]>(
    `/api/public/campaigns/${encodeURIComponent(slug)}/pools`,
    { token },
  );
}

export function startHunt(
  input: { campaignSlug: string; sessionId: string; name?: string; email?: string },
  token: string,
): Promise<HuntState> {
  return apiRequest<HuntState>("/api/public/hunt/start", {
    method: "POST",
    body: input,
    token,
  });
}

export function getHuntState(
  campaignSlug: string,
  token: string,
): Promise<HuntState> {
  return apiRequest<HuntState>(
    `/api/public/hunt/state?campaignSlug=${encodeURIComponent(campaignSlug)}`,
    { token },
  );
}

export function drawAttempt(
  input: {
    campaignSlug: string;
    sessionId: string;
    sourceType?: "base" | "referral_bonus";
    /** Development-only: forces the draw to a specific pool. */
    devPoolId?: string;
  },
  token: string,
  signal?: AbortSignal,
): Promise<VoucherAttempt> {
  return apiRequest<VoucherAttempt>("/api/public/hunt/attempt", {
    method: "POST",
    body: input,
    signal,
    token,
  });
}

export function validateCustomerSession(
  token: string,
): Promise<{ phone: string }> {
  return apiRequest<{ phone: string }>("/api/public/signin/session", {
    token,
  });
}

export function getAttemptSlots(
  input: { campaignSlug: string; attemptId: string },
  token: string,
): Promise<AttemptSlots> {
  const query = new URLSearchParams({
    campaignSlug: input.campaignSlug,
    attemptId: input.attemptId,
  });
  return apiRequest<AttemptSlots>(`/api/public/hunt/slots?${query.toString()}`, {
    token,
  });
}

export function selectVoucher(
  input: {
    campaignSlug: string;
    attemptId: string;
    slotId: string;
    sessionId: string;
    name: string;
    email?: string;
    guestCount?: number;
  },
  token: string,
): Promise<IssuedVoucher> {
  return apiRequest<IssuedVoucher>("/api/public/hunt/select", {
    method: "POST",
    body: input,
    token,
  });
}

/* Customer wallet ---------------------------------------------------------- */

export type RewardWalletSnapshot = {
  wallet: RewardWallet;
  walletSecret: string;
  balance: string;
  ledger: RewardLedgerEntry[];
  vouchers: RewardVoucher[];
  dailyStatus: LoyaltyDailyStatus;
  /** True only when this request created today's 10 LP app-use award. */
  appUseAwardedNow: boolean;
};

export function listClaimedVouchers(token: string): Promise<ClaimedVoucher[]> {
  return apiRequest<ClaimedVoucher[]>("/api/public/vouchers", { token });
}

export function getOrCreateRewardWallet(
  token: string,
): Promise<RewardWalletSnapshot> {
  return apiRequest<RewardWalletSnapshot>("/api/public/rewards/wallet", {
    method: "POST",
    body: {},
    token,
  });
}

export function convertRewardCredit(
  input: { walletSecret: string; amount: string },
  token: string,
): Promise<unknown> {
  return apiRequest("/api/public/rewards/convert", {
    method: "POST",
    body: input,
    token,
  });
}
