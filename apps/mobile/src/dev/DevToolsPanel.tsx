import type { CampaignCard } from "@bizflow/shared";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { listCampaigns } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, Field, InlineError, Select } from "@/components/FormControls";
import {
  devToolsEnabled,
  getDevPoolId,
  grantLoyaltyPoints,
  listDevPools,
  refreshMyVouchers,
  resetHunt,
  setDevPoolId,
  simulateCollection,
  simulatePurchase,
  type DevPoolOption,
} from "@/dev/devTools";
import { publishHuntReset } from "@/hunt/resetSignal";
import { colors, fonts, radius, spacing } from "@/theme";

/**
 * Port of the web More page's `.dev-voucher-picker`.
 *
 * The web panel is campaign-scoped because that page lives under
 * `/campaign/[slug]/more`. The app's More tab is global, so this adds a campaign
 * selector first and then applies both tools to whichever campaign is picked.
 *
 * Renders nothing outside development.
 */
export function DevToolsPanel() {
  const { token } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignCard[]>([]);
  const [slug, setSlug] = useState("");
  const [pools, setPools] = useState<DevPoolOption[]>([]);
  const [poolId, setPoolId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Enough for the dearest demo item (1,200 LP) in one tap.
  const [lpAmount, setLpAmount] = useState("1500");
  const [lpBusy, setLpBusy] = useState(false);
  // The earning side of the loop: pesos spent at a partner's till, of which 5%
  // becomes LP that the same partner is billed for.
  const [tillBusinessId, setTillBusinessId] = useState("");
  const [tillAmount, setTillAmount] = useState("1000");
  const [tillBusy, setTillBusy] = useState(false);
  const [collectCode, setCollectCode] = useState("");
  const [collectBusy, setCollectBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);

  useEffect(() => {
    if (!devToolsEnabled || !token) return;
    let active = true;
    void listCampaigns(token)
      .then((cards) => {
        if (!active) return;
        setCampaigns(cards);
        setSlug((current) => current || (cards[0]?.campaign.slug ?? ""));
        setTillBusinessId(
          (current) => current || (cards[0]?.campaign.businessId ?? ""),
        );
      })
      .catch(() => {
        if (active) setCampaigns([]);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!devToolsEnabled || !token || !slug) return;
    let active = true;
    void listDevPools(slug, token)
      .then((options) => {
        if (active) setPools(options);
      })
      .catch(() => {
        if (active) setPools([]);
      });
    void getDevPoolId(slug).then((stored) => {
      if (active) setPoolId(stored);
    });
    return () => {
      active = false;
    };
  }, [slug, token]);

  // Campaign cards already carry their partner; deriving the list here avoids a
  // second request just to name three businesses.
  const businessOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const card of campaigns) {
      if (!seen.has(card.campaign.businessId)) {
        seen.set(card.campaign.businessId, card.businessName);
      }
    }
    return [...seen.entries()].map(([value, label]) => ({ label, value }));
  }, [campaigns]);

  const choosePool = useCallback(
    (nextPoolId: string) => {
      setPoolId(nextPoolId);
      setMessage("");
      void setDevPoolId(slug, nextPoolId);
    },
    [slug],
  );

  async function runReset() {
    if (!token || !slug) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      // Cancel any roulette request kept mounted behind the More tab before the
      // server deletes its attempt. Otherwise that request can recreate it.
      publishHuntReset(slug);
      const result = await resetHunt(slug, token);
      // Forcing a pool only makes sense for a hunt that has not been spent.
      await setDevPoolId(slug, "");
      setPoolId("");
      setMessage(
        `Hunt reset — cleared ${result.attemptsCleared} attempt(s) and ${result.vouchersCleared} voucher(s).`,
      );
      // Remove the hidden campaign stack. Re-entering a campaign now always
      // begins at its details page.
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reset the hunt.");
    } finally {
      setBusy(false);
    }
  }

  async function grantLp() {
    if (!token) return;
    setLpBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await grantLoyaltyPoints(lpAmount, token);
      setMessage(`Granted ${result.granted} — balance is now ${result.balance}.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to grant Loyalty Points.",
      );
    } finally {
      setLpBusy(false);
    }
  }

  async function runSimulatedPurchase() {
    if (!token || !tillBusinessId) return;
    setTillBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await simulatePurchase(
        { businessId: tillBusinessId, purchaseAmount: tillAmount },
        token,
      );
      setMessage(
        result.heldForReview
          ? `Purchase held for fraud review — no LP awarded yet.`
          : `Earned ${result.rewardAmount} — balance is now ${result.balance}. The partner owes this on their statement.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to simulate the purchase.",
      );
    } finally {
      setTillBusy(false);
    }
  }

  async function runSimulatedCollection() {
    if (!token || !collectCode.trim()) return;
    setCollectBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await simulateCollection(collectCode.trim(), token);
      setMessage(
        `Collected ${result.product?.name ?? "item"} at ${result.businessName} — ${result.amount} now owed to them.`,
      );
      setCollectCode("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to collect that item.",
      );
    } finally {
      setCollectBusy(false);
    }
  }

  async function runVoucherRefresh() {
    if (!token) return;
    setRefreshBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await refreshMyVouchers(token);
      const moved = result.refreshed.filter((item) => item.movedTo);
      // Surface per-voucher problems: a booking that could not be moved is the
      // difference between a usable voucher and one that still reads expired.
      const blocked = result.refreshed.filter((item) => item.note);
      setMessage(
        result.refreshed.length === 0
          ? "No vouchers to refresh."
          : `Refreshed ${result.refreshed.length} voucher(s)${
              moved.length > 0 ? `, moved ${moved.length} to a new slot` : ""
            }.${blocked.length > 0 ? ` ${blocked[0].note}.` : ""}`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to refresh vouchers.",
      );
    } finally {
      setRefreshBusy(false);
    }
  }

  if (!devToolsEnabled) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <Text style={styles.headingText}>Development tools</Text>
        <Text style={styles.headingBadge}>Local only</Text>
      </View>

      <Select
        disabled={campaigns.length === 0}
        label="Campaign"
        onChange={setSlug}
        options={campaigns.map((card) => ({
          label: card.campaign.title,
          value: card.campaign.slug,
        }))}
        placeholder="No campaigns available"
        value={slug}
      />

      <Select
        label="Choose the next voucher"
        onChange={choosePool}
        options={[
          { label: "Random — use campaign odds", value: "" },
          ...pools.map((pool) => ({
            label: `${pool.displayLabel} (${pool.remainingQuantity ?? 0} remaining)`,
            value: pool.poolId,
          })),
        ]}
        value={poolId}
      />
      <Text style={styles.copy}>
        This choice applies to the next roulette spin for this campaign.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.label}>Add Loyalty Points</Text>
      <Field
        inputMode="decimal"
        keyboardType="decimal-pad"
        label="Amount (LP)"
        onChangeText={setLpAmount}
        placeholder="1500"
        value={lpAmount}
      />
      <Button
        disabled={!lpAmount.trim()}
        loading={lpBusy}
        loadingLabel="Granting…"
        variant="secondary"
        onPress={grantLp}
      >
        Add to my wallet
      </Button>
      <Text style={styles.copy}>
        Credits this number&apos;s wallet with no purchase behind it, so no
        partner is billed for it. Use it to test the LP shop and checkout.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.label}>Simulate a purchase at a partner</Text>
      <Select
        disabled={businessOptions.length === 0}
        label="Partner"
        onChange={setTillBusinessId}
        options={businessOptions}
        placeholder="No partners available"
        value={tillBusinessId}
      />
      <Field
        inputMode="decimal"
        keyboardType="decimal-pad"
        label="Amount paid (₱)"
        onChangeText={setTillAmount}
        placeholder="1000"
        value={tillAmount}
      />
      <Button
        disabled={!tillBusinessId || !tillAmount.trim()}
        loading={tillBusy}
        loadingLabel="Scanning…"
        variant="secondary"
        onPress={runSimulatedPurchase}
      >
        Earn 5% as LP
      </Button>
      <Text style={styles.copy}>
        Stands in for staff scanning your wallet at the till. Unlike the grant
        above, the partner is billed for this LP, so it shows up on their
        monthly statement.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.label}>Make my vouchers valid again</Text>
      <Button
        loading={refreshBusy}
        loadingLabel="Refreshing…"
        variant="secondary"
        onPress={runVoucherRefresh}
      >
        Refresh my vouchers
      </Button>
      <Text style={styles.copy}>
        Demo bookings age out. This moves any past booking to the next slot with
        room and re-dates the voucher — expiry still applies, so the expired
        path keeps working as it does in production.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.label}>Collect an item as staff</Text>
      <Field
        autoCapitalize="characters"
        label="Voucher code"
        onChangeText={setCollectCode}
        placeholder="RWD-975A4F"
        value={collectCode}
      />
      <Button
        disabled={!collectCode.trim()}
        loading={collectBusy}
        loadingLabel="Collecting…"
        variant="secondary"
        onPress={runSimulatedCollection}
      >
        Mark as handed over
      </Button>
      <Text style={styles.copy}>
        Redeems one of your own item vouchers, the step that puts the amount on
        the partner&apos;s statement. Find codes under LP Shop → My items.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.label}>Reset the voucher hunt</Text>
      <Button
        disabled={!slug}
        loading={busy}
        loadingLabel="Resetting…"
        variant="secondary"
        onPress={runReset}
      >
        Reset My Hunt
      </Button>
      <Text style={styles.copy}>
        Clears this number&apos;s attempts, voucher, and reservation for this campaign
        and returns the stock, so you can hunt again from the start.
      </Text>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <InlineError message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: 16,
  },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  headingText: {
    color: colors.ink,
    fontFamily: fonts.extrabold,
    fontSize: 14,
  },
  headingBadge: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    color: colors.alertText,
    fontFamily: fonts.bold,
    fontSize: 11,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  copy: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    backgroundColor: colors.borderSoft,
    height: 1,
    marginVertical: spacing.sm,
  },
  message: {
    color: colors.success,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
  },
});
