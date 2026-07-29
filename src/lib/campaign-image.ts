// Thin re-export: the implementation moved to @bizflow/shared so the mobile app
// resolves campaign artwork exactly as the web does. Existing web imports of
// "@/lib/campaign-image" keep working unchanged.
export {
  CAMPAIGN_SAMPLE_IMAGES,
  MAX_CAMPAIGN_IMAGE_DATA_URL_LENGTH,
  MAX_CAMPAIGN_IMAGE_UPLOAD_BYTES,
  isCampaignImageStorageValue,
  isInternalCampaignImage,
  isUploadedCampaignImage,
  resolveCampaignImage,
} from "@bizflow/shared/campaign-image";
