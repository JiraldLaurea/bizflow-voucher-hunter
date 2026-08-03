import type { Business } from "@bizflow/shared";
import { buildDirectionsUrl, buildTelUrl, isCoordinate } from "@bizflow/shared";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { InlineError } from "@/components/FormControls";
import { Icon } from "@/components/Icon";
import { useTranslation } from "@/i18n/LanguageContext";
import { colors, fonts, radius, spacing } from "@/theme";

function buildEmbeddedMapsHtml(latitude: number, longitude: number) {
  const query = encodeURIComponent(`${latitude},${longitude}`);
  const mapUrl = `https://www.google.com/maps?q=${query}&z=16&output=embed`;

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body, iframe { border: 0; height: 100%; margin: 0; overflow: hidden; padding: 0; width: 100%; }
    </style>
  </head>
  <body>
    <iframe allowfullscreen loading="eager" referrerpolicy="no-referrer-when-downgrade" src="${mapUrl}"></iframe>
  </body>
</html>`;
}

export function BusinessDetailsCard({ business }: { business?: Business }) {
  const t = useTranslation();
  const [error, setError] = useState("");
  const [mapVisible, setMapVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  const pin =
    business && isCoordinate(business.latitude) && isCoordinate(business.longitude)
      ? { latitude: business.latitude, longitude: business.longitude }
      : null;
  const mapHtml = pin ? buildEmbeddedMapsHtml(pin.latitude, pin.longitude) : "";

  const closeImmediately = useCallback(() => setMapVisible(false), []);
  const openMap = useCallback(() => {
    translateY.setValue(900);
    setMapVisible(true);
  }, [translateY]);
  const animateOpen = useCallback(() => {
    Animated.spring(translateY, {
      damping: 24,
      mass: 0.85,
      stiffness: 210,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [translateY]);
  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      duration: 220,
      toValue: 900,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) closeImmediately();
    });
  }, [closeImmediately, translateY]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => translateY.stopAnimation(),
        onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 70 || gesture.vy > 0.55) {
            dismiss();
            return;
          }
          Animated.spring(translateY, {
            damping: 22,
            stiffness: 230,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dismiss, translateY],
  );

  if (!business || (!business.address && !business.contactNumber && !pin)) return null;

  async function openExternal(url: string, failureKey: "venue.mapsError" | "venue.callError") {
    setError("");
    try {
      await Linking.openURL(url);
    } catch {
      setError(t(failureKey));
    }
  }

  const directionsUrl = buildDirectionsUrl({
    address: business.address,
    latitude: business.latitude,
    longitude: business.longitude,
  });

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>{t("venue.title")}</Text>
        <Text style={styles.business}>{business.name}</Text>

        {business.address ? (
          <View style={styles.row}>
            <Icon name="map-pin" size={16} />
            <View style={styles.rowCopy}>
              <Text style={styles.label}>{t("venue.address")}</Text>
              <Text style={styles.value}>{business.address}</Text>
            </View>
          </View>
        ) : null}

        {pin && mapHtml ? (
          <Pressable
            accessibilityLabel={`${business.name} ${t("venue.address")}`}
            accessibilityRole="button"
            onPress={openMap}
            style={({ pressed }) => [styles.mapPreview, pressed && styles.pressed]}
          >
            <WebView
              cacheEnabled={false}
              javaScriptEnabled
              onShouldStartLoadWithRequest={() => false}
              originWhitelist={["https://*"]}
              pointerEvents="none"
              scrollEnabled={false}
              source={{ baseUrl: "https://www.google.com", html: mapHtml }}
              style={styles.map}
            />
            <View pointerEvents="box-only" style={StyleSheet.absoluteFill} />
            <View style={styles.mapBadge}>
              <Icon color={colors.ink} name="maximize-2" size={14} />
              <Text style={styles.mapBadgeText}>{t("venue.viewFullMap")}</Text>
            </View>
          </Pressable>
        ) : null}

        {business.contactNumber ? (
          <View style={styles.row}>
            <Icon name="phone" size={16} />
            <View style={styles.rowCopy}>
              <Text style={styles.label}>{t("venue.contact")}</Text>
              <Text style={styles.value}>{business.contactNumber}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          {business.address || pin ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void openExternal(directionsUrl, "venue.mapsError")}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Icon color={colors.primary} name="navigation" size={15} />
              <Text style={styles.actionText}>{t("venue.directions")}</Text>
            </Pressable>
          ) : null}
          {business.contactNumber ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                void openExternal(buildTelUrl(business.contactNumber as string), "venue.callError")
              }
              style={({ pressed }) => [styles.action, styles.primaryAction, pressed && styles.pressed]}
            >
              <Icon color={colors.surface} name="phone" size={15} />
              <Text style={[styles.actionText, styles.primaryActionText]}>{t("venue.callButton")}</Text>
            </Pressable>
          ) : null}
        </View>
        {error ? <InlineError message={error} /> : null}
      </View>

      {pin && mapHtml ? (
        <Modal
          animationType="none"
          onRequestClose={dismiss}
          onShow={animateOpen}
          statusBarTranslucent
          transparent
          visible={mapVisible}
        >
          <View style={styles.backdrop}>
            <Pressable onPress={dismiss} style={StyleSheet.absoluteFill} />
            <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}> 
              <View style={styles.dragArea} {...panResponder.panHandlers}>
                <View style={styles.handle} />
              </View>
              <SafeAreaView edges={["bottom"]} style={styles.sheetSafeArea}>
                <View style={styles.sheetHeader}>
                  <Text numberOfLines={1} style={styles.sheetTitle}>{business.name}</Text>
                  <Pressable onPress={dismiss} style={styles.closeButton}>
                    <Icon color={colors.ink} name="x" size={21} />
                  </Pressable>
                </View>
                {business.address ? (
                  <View style={styles.sheetAddress} {...panResponder.panHandlers}>
                    <Icon name="map-pin" size={17} />
                    <Text style={styles.sheetAddressText}>{business.address}</Text>
                  </View>
                ) : null}
                <View style={styles.fullMapBody}>
                  <WebView
                    cacheEnabled={false}
                    javaScriptEnabled
                    onShouldStartLoadWithRequest={() => false}
                    originWhitelist={["https://*"]}
                    source={{ baseUrl: "https://www.google.com", html: mapHtml }}
                    style={styles.fullMap}
                  />
                </View>
                <View style={styles.sheetFooter}>
                  <Pressable
                    onPress={() => void openExternal(directionsUrl, "venue.mapsError")}
                    style={styles.fullMapAction}
                  >
                    <Icon color={colors.surface} name="navigation" size={15} />
                    <Text style={styles.fullMapActionText}>{t("venue.directions")}</Text>
                  </Pressable>
                </View>
              </SafeAreaView>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.xl, padding: spacing.lg },
  title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
  business: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginBottom: spacing.sm, marginTop: 2 },
  row: { alignItems: "center", borderTopColor: colors.borderSoft, borderTopWidth: 1, flexDirection: "row", gap: 10, paddingVertical: spacing.md },
  rowCopy: { flex: 1, gap: 2 },
  label: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase" },
  value: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  mapPreview: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, height: 170, overflow: "hidden", position: "relative" },
  map: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  mapBadge: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.94)", borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, bottom: 10, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 7, position: "absolute", right: 10 },
  mapBadgeText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 11 },
  actions: { borderTopColor: colors.borderSoft, borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, paddingTop: spacing.md },
  action: { alignItems: "center", borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 10 },
  primaryAction: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 },
  primaryActionText: { color: colors.surface },
  pressed: { opacity: 0.72 },
  backdrop: { backgroundColor: "rgba(7,15,31,0.48)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: "90%", overflow: "hidden" },
  sheetSafeArea: { flex: 1 },
  dragArea: { alignItems: "center", minHeight: 30, paddingBottom: 8, paddingTop: 10 },
  handle: { backgroundColor: colors.border, borderRadius: radius.pill, height: 5, width: 44 },
  sheetHeader: { alignItems: "center", flexDirection: "row", gap: spacing.md, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
  sheetTitle: { color: colors.ink, flex: 1, fontFamily: fonts.bold, fontSize: 17 },
  closeButton: { alignItems: "center", backgroundColor: colors.page, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  sheetAddress: { alignItems: "flex-start", borderTopColor: colors.borderSoft, borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, marginHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm },
  sheetAddressText: { color: colors.textMuted, flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  fullMapBody: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, marginHorizontal: spacing.lg, overflow: "hidden" },
  fullMap: { backgroundColor: "#eef1f4", flex: 1 },
  sheetFooter: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  fullMapAction: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, flexDirection: "row", gap: 7, justifyContent: "center", paddingVertical: 11 },
  fullMapActionText: { color: colors.surface, fontFamily: fonts.semibold, fontSize: 14 },
});
