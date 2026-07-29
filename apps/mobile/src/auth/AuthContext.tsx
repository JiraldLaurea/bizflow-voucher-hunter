import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";

import {
  getOrCreateRewardWallet,
  revokeSession,
  subscribeToUnauthorized,
  validateCustomerSession,
} from "@/api/client";

const TOKEN_KEY = "voucher_hunt_customer_token";
const PHONE_KEY = "voucher_hunt_customer_phone";
const SESSION_CHECK_INTERVAL_MS = 30_000;

export type LoyaltyAward = {
  balance: string;
  date: string;
  points: string;
};

type AuthContextValue = {
  isLoading: boolean;
  loyaltyAward: LoyaltyAward | null;
  phone: string | null;
  token: string | null;
  completeSignIn: (phone: string, token: string) => Promise<void>;
  dismissLoyaltyAward: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [loyaltyAward, setLoyaltyAward] = useState<LoyaltyAward | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const clearLocalSession = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(PHONE_KEY),
    ]);
    setLoyaltyAward(null);
    setPhone(null);
    setToken(null);
  }, []);

  useEffect(
    () =>
      subscribeToUnauthorized(() => {
        void clearLocalSession();
      }),
    [clearLocalSession],
  );

  useEffect(() => {
    let active = true;

    void Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(PHONE_KEY),
    ])
      .then(([storedToken, storedPhone]) => {
        if (!active) return;
        if (storedToken && storedPhone) {
          setToken(storedToken);
          setPhone(storedPhone);
        }
      })
      .catch(() => {
        if (!active) return;
        setToken(null);
        setPhone(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setLoyaltyAward(null);
      return;
    }

    let active = true;

    // App launch is the earning event. The server awards at most one
    // app-use bonus per Manila calendar day, so retries are safe.
    void getOrCreateRewardWallet(token)
      .then((snapshot) => {
        if (!active || !snapshot.appUseAwardedNow) return;
        setLoyaltyAward({
          balance: snapshot.balance,
          date: snapshot.dailyStatus.date,
          points: snapshot.dailyStatus.appUsePoints,
        });
      })
      .catch(() => {
        // Loading Loyalty Points must not block the rest of the signed-in app.
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let requestInFlight = false;
    const checkSession = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        await validateCustomerSession(token);
      } catch {
        // Authenticated 401 responses are handled centrally by apiRequest.
        // Network failures must not sign the customer out.
      } finally {
        requestInFlight = false;
      }
    };

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          void checkSession();
        }
      },
    );
    const interval = setInterval(
      () => void checkSession(),
      SESSION_CHECK_INTERVAL_MS,
    );

    return () => {
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [token]);

  const dismissLoyaltyAward = useCallback(() => {
    setLoyaltyAward(null);
  }, []);

  const completeSignIn = useCallback(async (nextPhone: string, nextToken: string) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, nextToken),
      SecureStore.setItemAsync(PHONE_KEY, nextPhone),
    ]);
    setPhone(nextPhone);
    setToken(nextToken);
  }, []);

  const signOut = useCallback(async () => {
    const currentToken = token;
    try {
      if (currentToken) {
        await revokeSession(currentToken);
      }
    } finally {
      await clearLocalSession();
    }
  }, [clearLocalSession, token]);

  const value = useMemo(
    () => ({
      isLoading,
      loyaltyAward,
      phone,
      token,
      completeSignIn,
      dismissLoyaltyAward,
      signOut,
    }),
    [
      completeSignIn,
      dismissLoyaltyAward,
      isLoading,
      loyaltyAward,
      phone,
      signOut,
      token,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
