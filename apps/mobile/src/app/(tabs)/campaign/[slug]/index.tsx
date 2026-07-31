import { buildMapsUrl, buildTelUrl } from "@bizflow/shared";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, InlineError } from "@/components/FormControls";
import { CampaignImage } from "@/components/CampaignImage";
import { Icon, type IconName } from "@/components/Icon";
import { ErrorState } from "@/components/ErrorState";
import { StepHeader } from "@/components/HuntUi";
import { useHunt } from "@/hunt/HuntContext";
import { CAMPAIGN_MODE_LABELS, formatCampaignRange } from "@/lib/format";
import { useTranslation } from "@/i18n/LanguageContext";
import { colors, fonts, radius, shadow, spacing } from "@/theme";

/** Step 1 — the campaign landing (`.campaign-landing-card` on the web). */
export default function CampaignLandingScreen() {
  const t = useTranslation();
  const router = useRouter();
  const [venueError, setVenueError] = useState("");
  const {
    begin,
    campaign,
    error,
    flow,
    loading,
    refreshSnapshot,
    reload,
    slug,
  } = useHunt();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  // The landing screen stays mounted in the tab navigator. Re-read the
  // authoritative hunt state whenever it becomes active so its CTA cannot show
  // "Let's Hunt!" after progress was made on another campaign step.
  useFocusEffect(
    useCallback(() => {
      if (loading) return;
      void refreshSnapshot().catch(() => {
        // A missing snapshot means this campaign has not been started yet.
      });
    }, [loading, refreshSnapshot]),
  );

  const hasActiveAttempt = flow.attempts.some(
    (attempt) => attempt.status === "Candidate" || attempt.status === "Held",
  );
  const canResume = Boolean(
    flow.issued || flow.selectedSlotId || hasActiveAttempt,
  );

  async function startHunt() {
    // Keep this order aligned with the web landing page's resumeRoute().
    if (flow.issued) {
      router.push({ pathname: "/campaign/[slug]/confirmation", params: { slug } });
      return;
    }
    if (flow.selectedSlotId) {
      router.push({ pathname: "/campaign/[slug]/confirm", params: { slug } });
      return;
    }
    if (hasActiveAttempt) {
      router.push({ pathname: "/campaign/[slug]/results", params: { slug } });
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      // `startHunt` is also the authoritative resume snapshot. A campaign switch
      // can reach this handler before the focus refresh has painted, so decide
      // from this response instead of always spending another base spin.
      const started = await begin();
      if (!started) {
        throw new Error(t("campaign.sessionNotReady"));
      }
      if (started.voucher) {
        router.push({
          pathname: "/campaign/[slug]/confirmation",
          params: { slug },
        });
        return;
      }
      const activeAttempt = started.attempts.find(
        (attempt) =>
          attempt.status === "Candidate" || attempt.status === "Held",
      );
      if (activeAttempt) {
        router.push({ pathname: "/campaign/[slug]/results", params: { slug } });
        return;
      }
      router.push({ pathname: "/campaign/[slug]/roulette", params: { slug } });
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : t("campaign.startError"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!campaign) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <StepHeader onBack={() => router.back()} title={t("campaign.stepTitle")} />
        <View style={styles.content}>
          <ErrorState
            error={error}
            fallback={t("campaign.unavailable")}
            onRetry={reload}
          />
        </View>
      </SafeAreaView>
    );
  }

  const { business, campaign: details } = campaign;

  async function openExternal(url: string, failureKey: "venue.mapsError" | "venue.callError") {
    setVenueError("");
    try {
      // openURL rejects when nothing can handle the URL — no maps app and no
      // browser, or a device with no dialer — so surface that rather than
      // leaving a tap that silently does nothing.
      await Linking.openURL(url);
    } catch {
      setVenueError(t(failureKey));
    }
  }

  const openMaps = () =>
    openExternal(
      buildMapsUrl({
        address: business?.address,
        latitude: business?.latitude,
        longitude: business?.longitude,
      }),
      "venue.mapsError",
    );
  const callBusiness = (contactNumber: string) =>
    openExternal(buildTelUrl(contactNumber), "venue.callError");

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Voucher Hunt</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.landingCard}>
          <CampaignImage campaign={details} showCategory />
          <View style={styles.landingBody}>
          <Text style={styles.eyebrow}>{t("campaign.selectedEyebrow")}</Text>
          <Text style={styles.campaignTitle}>{details.title}</Text>
          <Text style={styles.business}>{campaign.business?.name ?? ""}</Text>
          <Text style={styles.offer}>{details.offerMessage}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaIcon}>
              <Icon name="map-pin" size={14} />
            </View>
            <Text style={styles.metaText}>
              {details.location ?? t("home.locationTba")}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaIcon}>
              <Icon name="calendar" size={14} />
            </View>
            <Text style={styles.metaText}>
              {formatCampaignRange(details.startDate, details.endDate)}
            </Text>
          </View>
          </View>
        </View>

        {business && (business.address || business.contactNumber) ? (
          <View style={styles.venueCard}>
            <Text style={styles.venueTitle}>{t("venue.title")}</Text>
            <Text style={styles.venueBusiness}>{business.name}</Text>

            {business.address ? (
              <Pressable
                accessibilityHint={t("venue.openInMaps")}
                accessibilityRole="link"
                onPress={() => void openMaps()}
                style={({ pressed }) => [
                  styles.venueRow,
                  pressed && styles.venueRowPressed,
                ]}
              >
                <View style={styles.venueIcon}>
                  <Icon name="map-pin" size={16} />
                </View>
                <View style={styles.venueRowCopy}>
                  <Text style={styles.venueLabel}>{t("venue.address")}</Text>
                  <Text style={styles.venueLink}>{business.address}</Text>
                </View>
                <Icon name="external-link" size={14} />
              </Pressable>
            ) : null}

            {business.contactNumber ? (
              <Pressable
                accessibilityHint={t("venue.call")}
                accessibilityRole="link"
                onPress={() => void callBusiness(business.contactNumber as string)}
                style={({ pressed }) => [
                  styles.venueRow,
                  pressed && styles.venueRowPressed,
                ]}
              >
                <View style={styles.venueIcon}>
                  <Icon name="phone" size={16} />
                </View>
                <View style={styles.venueRowCopy}>
                  <Text style={styles.venueLabel}>{t("venue.contact")}</Text>
                  <Text style={styles.venueLink}>{business.contactNumber}</Text>
                </View>
                <Icon name="external-link" size={14} />
              </Pressable>
            ) : null}

            {venueError ? <InlineError message={venueError} /> : null}
          </View>
        ) : null}

        <View style={styles.actionIntro}>
          <Text style={styles.actionTitle}>{t("campaign.readyTitle")}</Text>
          <Text style={styles.actionCopy}>{t("campaign.readySubtitle")}</Text>
        </View>

        <View style={styles.ruleCard}>
          <RuleRow icon="clock" text={t("campaign.ruleOneSpin")} />
          <RuleRow icon="shield" text={t("campaign.ruleHigherDiscount")} last />
        </View>

        {actionError ? <InlineError message={actionError} /> : null}

        <View style={styles.action}>
          <Button
            loading={busy}
            loadingLabel={t("campaign.searching")}
            onPress={startHunt}
          >
            {canResume ? t("campaign.continue") : t("campaign.startHunt")}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** `.mini-rule` — an icon column beside a single line of copy. */
function RuleRow({
  icon,
  last = false,
  text,
}: {
  icon: IconName;
  last?: boolean;
  text: string;
}) {
  return (
    <View style={[styles.ruleRow, last && styles.ruleRowLast]}>
      <View style={styles.ruleIcon}>
        <Icon name={icon} size={15} />
      </View>
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.page,
    flex: 1,
  },
  loader: {
    marginTop: 80,
  },
  appBar: {
    paddingHorizontal: 18,
    paddingTop: spacing.md,
  },
  appBarTitle: {
    color: colors.ink,
    fontFamily: fonts.extrabold,
    fontSize: 18,
  },
  content: {
    gap: spacing.lg,
    padding: 18,
    paddingBottom: 48,
    paddingTop: 22,
  },
  landingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    boxShadow: "0 12px 30px rgba(11, 29, 58, 0.09)",
    overflow: "hidden",
  },
  landingBody: {
    gap: 6,
    padding: 18,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.extrabold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  campaignTitle: {
    color: colors.ink,
    fontFamily: fonts.extrabold,
    fontSize: 24,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  business: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  offer: {
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  venueCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  venueTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  venueBusiness: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    marginBottom: spacing.sm,
    marginTop: 2,
  },
  venueRow: {
    alignItems: "center",
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: spacing.md,
  },
  venueRowPressed: {
    opacity: 0.6,
  },
  venueIcon: {
    alignItems: "center",
    width: 20,
  },
  venueRowCopy: {
    flex: 1,
    gap: 2,
  },
  venueLabel: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  venueLink: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  metaIcon: {
    alignItems: "center",
    width: 16,
  },
  metaText: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  categoryChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    marginTop: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  categoryChipText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  actionIntro: {
    gap: 4,
  },
  actionTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 19,
  },
  actionCopy: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  ruleCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    ...shadow.soft,
  },
  ruleRow: {
    alignItems: "center",
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
  },
  ruleRowLast: {
    borderBottomWidth: 0,
  },
  ruleIcon: {
    alignItems: "center",
    width: 22,
  },
  ruleText: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  action: {
    marginTop: spacing.sm,
  },
});
