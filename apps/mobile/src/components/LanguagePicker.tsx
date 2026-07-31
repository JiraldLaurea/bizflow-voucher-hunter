import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { useLanguage } from "@/i18n/LanguageContext";
import { LANGUAGES, type Language } from "@/i18n/translations";
import { colors, fonts, radius, spacing } from "@/theme";

const ORDER: Language[] = ["en", "ko", "zh", "ja"];

/**
 * Language selector.
 *
 * Each option is labelled in its own language — someone looking for Korean is
 * looking for "한국어", not for "Korean" spelled out in a script they cannot
 * read. That also means the list stays legible whatever the current setting is.
 */
export function LanguagePicker() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("language.title")}</Text>
      <Text style={styles.subtitle}>{t("language.subtitle")}</Text>

      <View style={styles.options}>
        {ORDER.map((code) => {
          const selected = code === language;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={code}
              onPress={() => setLanguage(code)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {LANGUAGES[code]}
              </Text>
              {selected ? <Icon color={colors.primary} name="check" size={18} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  options: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  option: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  optionLabel: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  optionLabelSelected: {
    color: colors.primary,
  },
});
