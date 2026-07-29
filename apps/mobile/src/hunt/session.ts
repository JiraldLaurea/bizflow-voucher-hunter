import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "voucher_hunt_visitor_session";

/** Opaque per-install visitor ID used to prevent self-referral grants. */
export async function getVisitorSessionId() {
  const existing = await SecureStore.getItemAsync(SESSION_KEY);
  if (existing) return existing;
  const created = `sess_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  await SecureStore.setItemAsync(SESSION_KEY, created);
  return created;
}
