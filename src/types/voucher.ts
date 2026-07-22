export type CampaignMode = "restaurant" | "online_shop" | "beauty" | "pet" | "retail" | "other";
export type CampaignStatus = "active" | "paused" | "closed";
export type SlotStatus = "active" | "sold_out" | "closed" | "paused";
export type AttemptStatus = "Candidate" | "Held" | "Selected" | "Released" | "Expired";
export type VoucherStatus = "Issued" | "Delivered" | "Redeemed" | "Expired" | "Cancelled" | "NoShow";
export type SourceType = "base" | "referral_bonus" | "admin_bonus";

export type Business = {
  id: string;
  name: string;
  logoText: string;
  industry: CampaignMode;
};

export type Campaign = {
  id: string;
  businessId: string;
  slug: string;
  title: string;
  offerMessage: string;
  heroImage: string;
  mode: CampaignMode;
  /** Human-readable location shown on the campaign directory card (e.g. "Makati"). */
  location?: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  baseAttempts: number;
  referralDailyLimit: number;
  candidateTimeoutMinutes: number;
  terms: string;
  shopUrl?: string;
  /** When true, an issued restaurant reservation can be moved to another slot. */
  allowReschedule: boolean;
};

export type CampaignSlot = {
  id: string;
  campaignId: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  branchId?: string;
  totalCapacity: number;
  remainingCapacity: number;
  status: SlotStatus;
};

export type VoucherPool = {
  id: string;
  campaignId: string;
  benefitType: "discount_percent" | "fixed_amount" | "free_item" | "free_shipping";
  benefitValue: string;
  displayLabel: string;
  totalQuantity: number;
  remainingQuantity: number;
  probabilityWeight: number;
  expiryType: "hours" | "days" | "selected_slot_only" | "custom";
  expiryValue: number;
  minimumSpend?: number;
  status: "active" | "paused" | "depleted";
  restriction?: string;
};

export type EndUser = {
  id: string;
  campaignId: string;
  name?: string;
  phone: string;
  email?: string;
  sessionId: string;
  createdAt: string;
};

export type VoucherAttempt = {
  id: string;
  campaignId: string;
  /** Chosen only at final confirmation; a fresh candidate has no slot yet. */
  slotId?: string;
  userId: string;
  attemptNumber: number;
  sourceType: SourceType;
  benefitType: VoucherPool["benefitType"];
  benefitValue: string;
  displayLabel: string;
  poolId: string;
  status: AttemptStatus;
  expiresAt: string;
  createdAt: string;
};

export type Voucher = {
  id: string;
  campaignId: string;
  slotId: string;
  userId: string;
  selectedAttemptId: string;
  voucherCode: string;
  qrToken: string;
  benefitType: VoucherPool["benefitType"];
  benefitValue: string;
  displayLabel: string;
  status: VoucherStatus;
  issuedAt: string;
  expiresAt: string;
  redeemedAt?: string;
};

export type Reservation = {
  id: string;
  campaignId: string;
  slotId: string;
  userId: string;
  voucherId: string;
  guestCount?: number;
  status: "Reserved" | "Redeemed" | "Cancelled" | "No-show";
  createdAt: string;
};

export type SmsLog = {
  id: string;
  campaignId: string;
  userId: string;
  voucherId: string;
  to: string;
  body: string;
  provider: string;
  status: "pending" | "sent" | "failed";
  providerMessageId?: string;
  createdAt: string;
  failureReason?: string;
  // SMPP delivery-receipt (DLR) outcome, populated asynchronously by the SMSC.
  deliveryStatus?: string;
  deliveryError?: string;
  deliveryReceipt?: string;
  deliveredAt?: string;
};

export type RedemptionLog = {
  id: string;
  voucherId: string;
  staffName: string;
  purchaseAmount?: number;
  note?: string;
  createdAt: string;
};

export type AnalyticsEvent = {
  id: string;
  campaignId: string;
  eventName: string;
  userId?: string;
  slotId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ReferralReward = {
  id: string;
  campaignId: string;
  referrerUserId: string;
  visitorSessionId: string;
  status: "granted" | "rejected";
  reason?: string;
  createdAt: string;
};

export type RewardWalletStatus = "Active" | "Suspended";
export type RewardLedgerType = "credit_earned" | "voucher_converted" | "adjustment";
export type RewardVoucherStatus = "Active" | "Redeemed" | "Expired" | "Cancelled";
export type RewardTransactionStatus = "Accepted" | "Held" | "Rejected" | "Adjusted" | "Cancelled";
export type RewardSettlementStatus = "Pending" | "Processed" | "Completed" | "Adjusted";

export type RewardWallet = {
  id: string;
  phone: string;
  maskedPhone: string;
  name?: string;
  email?: string;
  walletToken: string;
  balanceCentavos: number;
  lifetimeEarnedCentavos: number;
  lifetimeConvertedCentavos: number;
  status: RewardWalletStatus;
  createdAt: string;
  updatedAt: string;
};

export type RewardLedgerEntry = {
  id: string;
  walletId: string;
  type: RewardLedgerType;
  deltaCentavos: number;
  balanceAfterCentavos: number;
  sourceType: string;
  sourceId?: string;
  businessId?: string;
  staffName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type RewardPurchase = {
  id: string;
  walletId: string;
  businessId: string;
  purchaseAmountCentavos: number;
  rewardAmountCentavos: number;
  staffName: string;
  status: RewardTransactionStatus;
  idempotencyKey?: string;
  fraudFlag?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
};

export type RewardVoucher = {
  id: string;
  walletId: string;
  voucherCode: string;
  qrToken: string;
  amountCentavos: number;
  remainingCentavos: number;
  status: RewardVoucherStatus;
  issuedAt: string;
  expiresAt?: string;
  redeemedAt?: string;
  createdAt: string;
};

export type RewardVoucherRedemption = {
  id: string;
  voucherId: string;
  walletId: string;
  businessId: string;
  amountCentavos: number;
  staffName: string;
  settlementStatus: RewardSettlementStatus;
  settlementId?: string;
  createdAt: string;
};

export type RewardSettlement = {
  id: string;
  businessId: string;
  period: string;
  totalAmountCentavos: number;
  status: RewardSettlementStatus;
  gcashReference?: string;
  createdAt: string;
  processedAt?: string;
};

export type AppDb = {
  businesses: Business[];
  campaigns: Campaign[];
  slots: CampaignSlot[];
  pools: VoucherPool[];
  users: EndUser[];
  attempts: VoucherAttempt[];
  vouchers: Voucher[];
  reservations: Reservation[];
  smsLogs: SmsLog[];
  redemptionLogs: RedemptionLog[];
  analyticsEvents: AnalyticsEvent[];
  referralRewards: ReferralReward[];
};

export type SuccessResponse<T> = {
  success: true;
  data: T;
};

export type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
