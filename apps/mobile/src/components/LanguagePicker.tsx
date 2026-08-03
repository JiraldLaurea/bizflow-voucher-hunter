import { StyleSheet, Text, View } from "react-native";

import { Select } from "@/components/FormControls";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  isSupportedLanguage,
  LANGUAGES,
  type Language,
} from "@/i18n/translations";
import { colors, fonts, radius, spacing } from "@/theme";

const ORDER: Language[] = ["en", "ko", "zh", "ja"];
const OPTIONS = ORDER.map((value) => ({ label: LANGUAGES[value], value }));

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

      <View style={styles.select}>
        <Select
          hideLabel
          label={t("language.title")}
          onChange={(value) => {
            if (isSupportedLanguage(value)) setLanguage(value);
          }}
          options={OPTIONS}
          value={language}
        />
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
  select: {
    marginTop: spacing.md,
  },
});
