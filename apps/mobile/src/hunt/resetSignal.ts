type HuntResetListener = (campaignSlug: string) => void;

const listeners = new Set<HuntResetListener>();

/**
 * Synchronizes a development reset across the More tab and any campaign stack
 * Expo Router is keeping mounted in the background.
 */
export function publishHuntReset(campaignSlug: string) {
  for (const listener of listeners) listener(campaignSlug);
}

export function subscribeToHuntReset(listener: HuntResetListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
