import { toDisplayPhone } from "@bizflow/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { selectVoucher } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, Field, InlineError, ReadOnlyField } from "@/components/FormControls";
import { StepHeader, SummaryList, SummaryRow } from "@/components/HuntUi";
import { VoucherTicket } from "@/components/VoucherTicket";
import { useHunt } from "@/hunt/HuntContext";
import { formatDate, formatTime } from "@/lib/format";
import { colors, fonts, spacing } from "@/theme";

/** Step 6 — name/email/guests, then issue the final voucher. */
export default function ConfirmScreen() {
  const router = useRouter();
  const { phone, token } = useAuth();
  const { campaign, flow, save, selectedAttempt, sessionId, slotById, slug } = useHunt();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const slot = slotById(flow.selectedSlotId);
  const isRestaurant = campaign?.campaign.mode === "restaurant";

  async function issue() {
    if (!token || !selectedAttempt) return;
    setBusy(true);
    setError("");
    try {
      const issued = await selectVoucher(
        {
          campaignSlug: slug,
          attemptId: selectedAttempt.id,
          slotId: flow.selectedSlotId,
          sessionId,
          name: flow.name.trim(),
          email: flow.email.trim() || undefined,
          guestCount: isRestaurant ? Number(flow.guestCount) || 1 : undefined,
        },
        token,
      );
      save({ issued: { voucher: issued.voucher, slot: issued.slot } });
      router.replace({ pathname: "/campaign/[slug]/confirmation", params: { slug } });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to reserve your voucher.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <StepHeader onBack={() => router.back()} title="Confirm & Details" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>
          Confirm your selected voucher and reservation details.
        </Text>

        {selectedAttempt ? (
          <View style={styles.ticket}>
            <VoucherTicket benefit={selectedAttempt} detail="Selected voucher" />
          </View>
        ) : (
          <InlineError message="Select a voucher candidate first." />
        )}

        <Field
          autoCapitalize="words"
          label="Full Name"
          onChangeText={(value) => save({ name: value })}
          placeholder="Jane Doe"
          value={flow.name}
        />
        <ReadOnlyField
          label="Mobile Number"
          value={phone ? toDisplayPhone(phone) : "—"}
        />
        <Field
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email (Optional)"
          onChangeText={(value) => save({ email: value })}
          placeholder="jane@example.com"
          value={flow.email}
        />
        {isRestaurant ? (
          <Field
            keyboardType="number-pad"
            label="Guests"
            onChangeText={(value) => save({ guestCount: value })}
            value={flow.guestCount}
          />
        ) : null}

        <SummaryList>
          <SummaryRow
            icon="calendar"
            label="Date"
            value={slot ? formatDate(slot.date) : "No slot"}
          />
          <SummaryRow
            icon="clock"
            label="Time"
            value={slot ? formatTime(slot.startTime) : "No slot"}
          />
          <SummaryRow
            icon="tag"
            label="Category"
            value={isRestaurant ? "Restaurant" : "Online Shop"}
          />
        </SummaryList>

        {error ? <InlineError message={error} /> : null}

        <View style={styles.action}>
          <Button
            disabled={!selectedAttempt || !flow.selectedSlotId || !flow.name.trim()}
            loading={busy}
            loadingLabel="Reserving..."
            onPress={issue}
          >
            Confirm &amp; Reserve
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
  lead: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  ticket: {
    marginBottom: spacing.lg,
  },
  action: {
    marginTop: spacing.xl,
  },
});
