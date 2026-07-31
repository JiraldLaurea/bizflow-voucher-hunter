import { isValidPhilippinePhone, normalizePhone, toDisplayPhone } from "@bizflow/shared";
import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError, requestOtp, verifyOtp } from "@/api/client";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/auth/AuthContext";
import { Button, Field, InlineError } from "@/components/FormControls";
import { Screen } from "@/components/Screen";
import { colors, fonts, radius, spacing } from "@/theme";

type Step = "phone" | "code";
const RESEND_COOLDOWN_SECONDS = 60;

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function SignInScreen() {
  const { completeSignIn } = useAuth();
  const t = useTranslation();
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isCodeFocused, setIsCodeFocused] = useState(false);

  useEffect(() => {
    if (step !== "code" || resendSeconds <= 0) return;

    const timer = setTimeout(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1_000);

    return () => clearTimeout(timer);
  }, [resendSeconds, step]);

  async function handleRequestCode() {
    setError(null);
    if (!isValidPhilippinePhone(phoneInput)) {
      setError(t("signIn.invalidPhone"));
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
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
      setStep("code");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (isResending || resendSeconds > 0 || !verifiedPhone) return;

    setError(null);
    setIsResending(true);
    try {
      const result = await requestOtp(verifiedPhone);
      setDevCode(result.devCode ?? null);
      setCode("");
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsResending(false);
    }
  }

  async function handleVerifyCode() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError(t("signIn.invalidCode"));
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
    setResendSeconds(0);
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
              <Image
                resizeMode="contain"
                source={require("../../assets/images/voucher-verification-emblem.png")}
                style={styles.emblemImage}
              />
            </View>

            <View style={styles.hero}>
              <Text style={styles.title}>
                {step === "phone"
                  ? "Sign in to start hunting"
                  : "Check your messages"}
              </Text>
              <Text style={styles.subtitle}>
                {step === "phone"
                  ? t("signIn.subtitlePhone")
                  : t("signIn.subtitleCode", { phone: toDisplayPhone(verifiedPhone) })}
              </Text>
              {step === "code" ? (
                <Text style={styles.deliveryNote}>{t("signIn.deliveryNote")}</Text>
              ) : null}
            </View>

            <View style={styles.form}>
              {step === "phone" ? (
                <>
                  <Field
                    autoComplete="tel"
                    autoFocus
                    keyboardType="phone-pad"
                    label={t("signIn.phoneLabel")}
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
                    loadingLabel={t("signIn.sending")}
                    onPress={() => void handleRequestCode()}
                  >
                    Send Code  →
                  </Button>
                </>
              ) : (
                <>
                  <View style={styles.otpField}>
                    <Text style={styles.otpLabel}>{t("signIn.codeLabel")}</Text>
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
                      <Text style={styles.demoCodeLabel}>{t("signIn.demoCode")}</Text>
                      <Text style={styles.demoCodeValue}>{devCode}</Text>
                    </View>
                  ) : null}
                  <View style={styles.resendRow}>
                    <Text style={styles.resendPrompt}>{t("signIn.resendPrompt")}</Text>
                    <Button
                      disabled={resendSeconds > 0 || isSubmitting}
                      loading={isResending}
                      loadingLabel={t("signIn.resending")}
                      onPress={() => void handleResendCode()}
                      variant="tertiary"
                    >
                      {resendSeconds > 0
                        ? `Resend in ${resendSeconds}s`
                        : "Resend code"}
                    </Button>
                  </View>
                  {error ? <InlineError message={error} /> : null}
                  <Button
                    disabled={code.length !== 6}
                    loading={isSubmitting}
                    loadingLabel={t("signIn.verifying")}
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
    height: 72,
    justifyContent: "center",
    marginBottom: spacing.lg,
    width: 72,
    alignSelf: "center",
  },
  emblemImage: {
    height: 62,
    width: 62,
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
  deliveryNote: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 300,
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
  resendRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 28,
  },
  resendPrompt: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
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
