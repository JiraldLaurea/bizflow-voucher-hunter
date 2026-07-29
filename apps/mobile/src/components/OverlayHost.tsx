import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";

/**
 * A minimal portal for full-screen overlays (dropdown sheets, and anything else
 * that must escape a ScrollView and sit above the tab bar).
 *
 * The alternative, React Native's `Modal`, creates a real native dialog window on
 * Android. That window has to be constructed before anything can animate, which
 * showed up as 129–200ms frame spikes and read as an unresponsive pause on tap.
 * Rendering into the existing view tree costs no window at all, so opening is
 * immediate and the animation is the only thing that takes time.
 */
type OverlayContextValue = {
  present: (key: string, node: ReactNode) => void;
  dismiss: (key: string) => void;
};

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function OverlayProvider({ children }: PropsWithChildren) {
  const [overlays, setOverlays] = useState<Record<string, ReactNode>>({});

  const present = useCallback((key: string, node: ReactNode) => {
    setOverlays((current) => ({ ...current, [key]: node }));
  }, []);

  const dismiss = useCallback((key: string) => {
    setOverlays((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const value = useMemo(() => ({ present, dismiss }), [dismiss, present]);
  const entries = Object.entries(overlays);

  return (
    <OverlayContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {entries.length > 0 ? (
          // `box-none` so the host itself never swallows touches — only the
          // overlay's own children receive them.
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {entries.map(([key, node]) => (
              <View key={key} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                {node}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </OverlayContext.Provider>
  );
}

export function useOverlay(): OverlayContextValue {
  const value = useContext(OverlayContext);
  if (!value) throw new Error("useOverlay must be used inside OverlayProvider");
  return value;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
