import Feather from "@expo/vector-icons/Feather";

import { colors } from "@/theme";

/**
 * Feather, matching the web, which draws its icons with `react-icons/fi` — the
 * same set. Using it everywhere keeps stroke weight and shapes identical across
 * the two clients instead of approximating them with text glyphs.
 */
export type IconName = keyof typeof Feather.glyphMap;

export function Icon({
  color = colors.primary,
  name,
  size = 16,
}: {
  color?: string;
  name: IconName;
  size?: number;
}) {
  return <Feather color={color} name={name} size={size} />;
}
