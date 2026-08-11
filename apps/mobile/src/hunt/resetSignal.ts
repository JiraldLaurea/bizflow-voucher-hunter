type HuntResetListener = () => void;

const listeners = new Set<HuntResetListener>();

/**
 * Synchronizes a development reset across the More tab and any campaign stack
 * Expo Router is keeping mounted in the background.
 *
 * Carries no slug because a reset clears every campaign the phone has hunted:
 * a background stack that kept its local state because the signal named a
 * different campaign would go on to reconfirm an attempt the server deleted.
 */
export function publishHuntReset() {
  for (const listener of listeners) listener();
}

export function subscribeToHuntReset(listener: HuntResetListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
