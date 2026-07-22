export const MAX_CAMPAIGN_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_CAMPAIGN_IMAGE_DATA_URL_LENGTH = 1_500_000;

export const CAMPAIGN_SAMPLE_IMAGES: Record<string, { src: string; alt: string }> = {
  "july-dinner": {
    src: "/images/campaigns/july-dinner.png",
    alt: "Filipino-inspired dinner in a warmly lit restaurant",
  },
  "8pm-drop": {
    src: "/images/campaigns/8pm-shopping.png",
    alt: "Online shopping parcels and products during an evening sale",
  },
  "glow-facial": {
    src: "/images/campaigns/glow-facial-week.png",
    alt: "Skincare products arranged in a calm facial studio",
  },
};

const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Uploaded images are normalized by the campaign form before persistence. The
 * signature check prevents an arbitrary data payload from being stored under
 * an image MIME type; SVG is deliberately excluded because it can contain
 * executable markup.
 */
export function isUploadedCampaignImage(value: string) {
  if (value.length > MAX_CAMPAIGN_IMAGE_DATA_URL_LENGTH) return false;

  const separator = value.indexOf(",");
  if (separator < 0) return false;
  const header = value.slice(0, separator);
  const payload = value.slice(separator + 1);
  if (!base64Pattern.test(payload)) return false;

  if (header === "data:image/png;base64") {
    return payload.startsWith("iVBORw0KGgo");
  }
  if (header === "data:image/jpeg;base64") {
    return payload.startsWith("/9j/");
  }
  if (header === "data:image/webp;base64") {
    return payload.startsWith("UklGR");
  }
  return false;
}

export function isInternalCampaignImage(value: string) {
  return /^\/images\/campaigns\/[A-Za-z0-9._/-]+$/.test(value);
}

/** Accepts normalized uploads plus the legacy seed/test visual values. */
export function isCampaignImageStorageValue(value: string) {
  if (isUploadedCampaignImage(value) || isInternalCampaignImage(value)) {
    return true;
  }

  if (value.length > 4_000) return false;
  return /^linear-gradient\(/.test(value) || /^#[0-9a-fA-F]{3,8}$/.test(value);
}

/** Resolves the artwork customers actually see, including legacy campaign fallbacks. */
export function resolveCampaignImage(campaign: {
  heroImage: string;
  slug: string;
  title: string;
}) {
  if (
    isUploadedCampaignImage(campaign.heroImage) ||
    isInternalCampaignImage(campaign.heroImage)
  ) {
    return {
      src: campaign.heroImage,
      alt: `${campaign.title} campaign`,
    };
  }

  return CAMPAIGN_SAMPLE_IMAGES[campaign.slug] ?? null;
}
