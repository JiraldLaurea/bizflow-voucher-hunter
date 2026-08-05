import type { RewardProduct } from "@/api/client";
import { resolveAssetUrl } from "@/api/client";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { CampaignImage } from "@/components/CampaignImage";
import { colors } from "@/theme";

type RewardProductImageProps = {
  borderRadius?: number;
  product: Pick<RewardProduct, "campaign" | "imageUrl" | "name">;
  style?: object;
};

/** Product photography first; current campaign art remains a safe fallback. */
export function RewardProductImage({
  borderRadius = 0,
  product,
  style,
}: RewardProductImageProps) {
  if (!product.imageUrl) {
    return product.campaign ? (
      <CampaignImage
        borderRadius={borderRadius}
        campaign={product.campaign}
        style={style}
      />
    ) : null;
  }

  return (
    <View style={[styles.media, { borderRadius }, style]}>
      <Image
        alt={product.name}
        contentFit="cover"
        source={{ uri: resolveAssetUrl(product.imageUrl) }}
        style={styles.image}
        transition={160}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  media: {
    aspectRatio: 2,
    backgroundColor: colors.page,
    overflow: "hidden",
    width: "100%",
  },
  image: {
    height: "100%",
    width: "100%",
  },
});
