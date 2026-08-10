import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { fetchRiderSession } from './src/api';
import DeliveryScreen from './src/screens/DeliveryScreen';
import LoginScreen from './src/screens/LoginScreen';
import { clearToken, loadToken, saveToken } from './src/session';
import { RiderSession } from './src/types';

export default function App() {
  const [session, setSession] = useState<RiderSession | null>(null);
  // Distinct from "signed out": on launch we do not yet know which it is, and
  // flashing the login screen at a rider who is already signed in is jarring.
  const [restoring, setRestoring] = useState(true);

  // Restore a stored token, then revalidate it against the backend. Validating
  // rather than trusting it matters: the token may have expired, or the rider
  // may have been deactivated since, and finding that out here is far better
  // than on their first tap of Accept.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await loadToken();
      if (token) {
        try {
          const restored = await fetchRiderSession(token);
          if (!cancelled) {
            setSession(restored);
          }
          // /rider/me returns a fresh token; keep the stored one rolling so a
          // rider who opens the app regularly is never logged out mid-shift.
          await saveToken(restored.access_token);
        } catch {
          await clearToken();
        }
      }
      if (!cancelled) {
        setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = useCallback(async (next: RiderSession) => {
    setSession(next);
    await saveToken(next.access_token);
  }, []);

  const handleLogout = useCallback(async () => {
    setSession(null);
    await clearToken();
  }, []);

  if (restoring) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#4169E1" />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <DeliveryScreen
      session={session}
      onLogout={handleLogout}
    />
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
});
