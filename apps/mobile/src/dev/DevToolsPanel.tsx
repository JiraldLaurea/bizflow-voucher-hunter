import type { CampaignCard } from "@bizflow/shared";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { listCampaigns } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, InlineError, Select } from "@/components/FormControls";
import {
  devToolsEnabled,
  getDevPoolId,
  listDevPools,
  resetHunt,
  setDevPoolId,
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

  useEffect(() => {
    if (!devToolsEnabled || !token) return;
    let active = true;
    void listCampaigns(token)
      .then((cards) => {
        if (!active) return;
        setCampaigns(cards);
        setSlug((current) => current || (cards[0]?.campaign.slug ?? ""));
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
