import { isValidPhilippinePhone, normalizePhone, toDisplayPhone } from "@bizflow/shared";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError, requestOtp, verifyOtp } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, Field, InlineError } from "@/components/FormControls";
import { Screen } from "@/components/Screen";
import { colors, fonts, radius, spacing } from "@/theme";

type Step = "phone" | "code";

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function SignInScreen() {
  const { completeSignIn } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCodeFocused, setIsCodeFocused] = useState(false);

  async function handleRequestCode() {
    setError(null);
    if (!isValidPhilippinePhone(phoneInput)) {
      setError("Enter a valid Philippine mobile number, such as 09171234567.");
      return;
    }

    const normalized = normalizePhone(phoneInput);
    if (!normalized) return;

    setIsSubmitting(true);
    try {
      const result = await requestOtp(normalized);
      setVerifiedPhone(normalized);
      setDevCode(result.devCode ?? null);
      setCode("");
      setStep("code");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the complete 6-digit verification code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await verifyOtp(verifiedPhone, code);
      await completeSignIn(result.phone, result.token);
    } catch (verifyError) {
      setError(getErrorMessage(verifyError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeNumber() {
    setStep("phone");
    setCode("");
    setDevCode(null);
    setError(null);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboardView}
    >
      <Screen>
        <View style={styles.panel}>
          <View style={styles.centerContent}>
            <View style={styles.emblem} accessibilityElementsHidden>
              <Text style={styles.emblemIcon}>🎁</Text>
            </View>

            <View style={styles.hero}>
              <Text style={styles.title}>
                {step === "phone"
                  ? "Sign in to start hunting"
                  : "Check your messages"}
              </Text>
              <Text style={styles.subtitle}>
                {step === "phone"
                  ? "Enter your mobile number — we'll text you a code to verify it's yours."
                  : `Enter the 6-digit code sent to ${toDisplayPhone(verifiedPhone)}.`}
              </Text>
            </View>

            <View style={styles.form}>
              {step === "phone" ? (
                <>
                  <Field
                    autoComplete="tel"
                    autoFocus
                    keyboardType="phone-pad"
                    label="Mobile Number"
                    maxLength={16}
                    onChangeText={(value) => {
                      setPhoneInput(value);
                      setError(null);
                    }}
                    onSubmitEditing={() => void handleRequestCode()}
                    placeholder="09171234567"
                    returnKeyType="send"
                    textContentType="telephoneNumber"
                    value={phoneInput}
                  />
                  {error ? <InlineError message={error} /> : null}
                  <Button
                    disabled={!isValidPhilippinePhone(phoneInput)}
                    loading={isSubmitting}
                    loadingLabel="Sending code..."
                    onPress={() => void handleRequestCode()}
                  >
                    Send Code  →
                  </Button>
                </>
              ) : (
                <>
                  <View style={styles.otpField}>
                    <Text style={styles.otpLabel}>Verification Code</Text>
                    <View style={styles.otpInputWrap}>
                      <View
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={styles.otpBoxes}
                      >
                        {Array.from({ length: 6 }, (_, index) => {
                          const isActive =
                            isCodeFocused &&
                            index === Math.min(code.length, 5);
                          return (
                            <View
                              key={index}
                              style={[
                                styles.otpBox,
                                isActive && styles.otpBoxActive,
                                error && styles.otpBoxError,
                              ]}
                            >
                              <Text style={styles.otpDigit}>
                                {code[index] ?? ""}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                      <TextInput
                        accessibilityLabel="6-digit verification code"
                        autoComplete="sms-otp"
                        autoFocus
                        caretHidden
                        contextMenuHidden
                        keyboardType="number-pad"
                        maxLength={6}
                        onBlur={() => setIsCodeFocused(false)}
                        onChangeText={(value) => {
                          setCode(value.replace(/\D/g, ""));
                          setError(null);
                        }}
                        onFocus={() => setIsCodeFocused(true)}
                        onSubmitEditing={() => void handleVerifyCode()}
                        returnKeyType="done"
                        selectionColor="transparent"
                        style={styles.otpNativeInput}
                        textContentType="oneTimeCode"
                        value={code}
                      />
                    </View>
                  </View>
                  {devCode ? (
                    <View style={styles.demoCode}>
                      <Text style={styles.demoCodeLabel}>Local demo code</Text>
                      <Text style={styles.demoCodeValue}>{devCode}</Text>
                    </View>
                  ) : null}
                  {error ? <InlineError message={error} /> : null}
                  <Button
                    disabled={code.length !== 6}
                    loading={isSubmitting}
                    loadingLabel="Verifying..."
                    onPress={() => void handleVerifyCode()}
                  >
                    Verify & Continue  →
                  </Button>
                  <Button
                    disabled={isSubmitting}
                    onPress={changeNumber}
                    variant="secondary"
                  >
                    Use a different number
                  </Button>
                </>
              )}
            </View>
          </View>

          <Text style={styles.footnote}>
            One sign-in works across all Voucher Hunt campaigns.
          </Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  panel: {
    flex: 1,
    justifyContent: "space-between",
    minHeight: 620,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
  },
  emblem: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 64,
    justifyContent: "center",
    marginBottom: spacing.lg,
    width: 64,
    alignSelf: "center",
  },
  emblemIcon: {
    fontSize: 30,
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontFamily: fonts.extrabold,
    letterSpacing: -0.4,
    lineHeight: 30,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 330,
    textAlign: "center",
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.xl,
    width: "100%",
  },
  otpField: {
    gap: spacing.sm,
  },
  otpLabel: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  otpInputWrap: {
    height: 54,
    position: "relative",
  },
  otpBoxes: {
    flexDirection: "row",
    gap: spacing.sm,
    height: 54,
  },
  otpBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    height: 54,
    justifyContent: "center",
  },
  otpBoxActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  otpBoxError: {
    borderColor: colors.danger,
  },
  otpDigit: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 22,
    lineHeight: 27,
  },
  otpNativeInput: {
    bottom: 0,
    color: "transparent",
    left: 0,
    opacity: 0.01,
    position: "absolute",
    right: 0,
    top: 0,
  },
  demoCode: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  demoCodeLabel: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  demoCodeValue: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: fonts.extrabold,
    letterSpacing: 2,
  },
  footnote: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    paddingTop: spacing.xl,
    textAlign: "center",
  },
});
