import * as SecureStore from 'expo-secure-store';

// The rider's bearer token, kept in the OS keystore (Keychain on iOS, encrypted
// SharedPreferences on Android) rather than plain AsyncStorage — it is a
// credential, and a rider's phone is a device that gets lost.
const TOKEN_KEY = 'edawr-rider-token';

export async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    // A read failure means "not signed in", never a crash on launch.
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Non-fatal: the rider stays signed in for this session and is asked to
    // sign in again next launch. Better than blocking a delivery shift.
  }
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Nothing useful to do; the token expires server-side regardless.
  }
}
