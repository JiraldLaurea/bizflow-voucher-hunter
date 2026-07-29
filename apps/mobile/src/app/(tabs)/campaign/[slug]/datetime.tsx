import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, getAttemptSlots, type PublicSlot } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, InlineError } from "@/components/FormControls";
import { InfoCard, SelectedStrip, SlotRow, StepHeader } from "@/components/HuntUi";
import { useHunt } from "@/hunt/HuntContext";
import { formatDate, formatTime } from "@/lib/format";
import { colors, fonts, spacing } from "@/theme";

/**
 * Step 5 — the tier-gated slot picker. The slots come from `GET /hunt/slots`, not
 * the campaign's full slot list: a higher-value voucher is offered at fewer times.
 */
export default function DateTimeScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { begin, flow, save, selectedAttempt, slug } = useHunt();
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !flow.selectedAttemptId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await getAttemptSlots(
        { campaignSlug: slug, attemptId: flow.selectedAttemptId },
        token,
      );
      setSlots(result.slots);
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        (caught.code === "E-USER-404" || caught.code === "E-ATTEMPT-404")
      ) {
        // Reconcile with the authoritative campaign session before discarding
        // the selected voucher. A stale local attempt can coexist with a newer
        // valid server attempt after a reset/reload or campaign switch.
        try {
          const snapshot = await begin();
          const recoveredAttempt =
            snapshot?.attempts.find(
              (attempt) => attempt.id === flow.selectedAttemptId,
            ) ??
            snapshot?.attempts
              .slice()
              .reverse()
              .find(
                (attempt) =>
                  attempt.status === "Candidate" || attempt.status === "Held",
              );

          if (snapshot?.voucher) {
            router.replace({
              pathname: "/campaign/[slug]/confirmation",
              params: { slug },
            });
            return;
          }

          if (recoveredAttempt) {
            save({
              attempts: snapshot?.attempts ?? [],
              selectedAttemptId: recoveredAttempt.id,
              selectedSlotId: "",
              selectedDate: "",
            });
            const recovered = await getAttemptSlots(
              { campaignSlug: slug, attemptId: recoveredAttempt.id },
              token,
            );
            setSlots(recovered.slots);
            return;
          }
        } catch {
          // With no recoverable authoritative attempt, restart at the reel.
        }

        setSlots([]);
        setError(
          "This voucher selection is no longer available. Return to the campaign and start a new hunt.",
        );
        return;
      }
      setSlots([]);
      setError(
        caught instanceof Error ? caught.message : "Unable to load time slots.",
      );
    } finally {
      setLoading(false);
    }
  }, [begin, flow.selectedAttemptId, router, save, slug, token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!flow.selectedAttemptId) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <StepHeader onBack={() => router.back()} title="Date & Time" />
        <View style={styles.content}>
          <InfoCard>
            <Text style={styles.infoText}>Reveal and pick a voucher first.</Text>
            <Button
              onPress={() =>
                router.replace({ pathname: "/campaign/[slug]", params: { slug } })
              }
            >
              Return to campaign
            </Button>
          </InfoCard>
        </View>
      </SafeAreaView>
    );
  }

  const dates = Array.from(new Set(slots.map((slot) => slot.date)));

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <StepHeader onBack={() => router.back()} title="Date & Time" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {selectedAttempt ? (
          <SelectedStrip
            label={selectedAttempt.displayLabel}
            onChange={() => router.back()}
          />
        ) : null}
        <Text style={styles.helper}>
          Pick a time to use your{" "}
          <Text style={styles.helperStrong}>{selectedAttempt?.displayLabel}</Text>{" "}
          voucher.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? null : slots.length === 0 ? (
          <InfoCard>
            <Text style={styles.infoText}>
              No time slots are available for this voucher right now.
            </Text>
          </InfoCard>
        ) : (
          dates.map((date) => (
            <View key={date}>
              <Text style={styles.dateTitle}>{formatDate(date)}</Text>
              <View style={styles.slotList}>
                {slots
                  .filter((slot) => slot.date === date)
                  .map((slot) => {
                    const soldOut =
                      slot.remainingCapacity <= 0 || slot.status !== "active";
                    const low = slot.remainingCapacity <= 3;
                    return (
                      <SlotRow
                        key={slot.id}
                        low={low}
                        note={
                          soldOut
                            ? "Fully booked"
                            : low
                              ? `Only ${slot.remainingCapacity} spots left`
                              : `${slot.remainingCapacity} spots available`
                        }
                        onPress={() =>
                          save({ selectedSlotId: slot.id, selectedDate: slot.date })
                        }
                        selected={slot.id === flow.selectedSlotId}
                        soldOut={soldOut}
                        time={`${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`}
                      />
                    );
                  })}
              </View>
            </View>
          ))
        )}

        {error ? <InlineError message={error} /> : null}

        <View style={styles.action}>
          <Button
            disabled={!flow.selectedSlotId}
            onPress={() =>
              router.push({ pathname: "/campaign/[slug]/confirm", params: { slug } })
            }
          >
            Continue
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.page,
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 48,
    paddingTop: 26,
  },
  infoText: {
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  helper: {
    alignSelf: "center",
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
    maxWidth: 280,
    textAlign: "center",
  },
  helperStrong: {
    color: colors.ink,
    fontFamily: fonts.bold,
  },
  loader: {
    marginTop: spacing.xl,
  },
  dateTitle: {
    color: "#6b7385",
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 14,
    marginTop: 26,
    textTransform: "uppercase",
  },
  slotList: {
    gap: 9,
  },
  action: {
    marginTop: spacing.xl,
  },
});
