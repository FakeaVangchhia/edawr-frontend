import Constants from 'expo-constants';

// The Django/DRF backend (backend/) listens on 8000. The Next.js app on 3000 is
// UI only and serves no API routes.
const DEFAULT_PORT = '8000';

function extractHost(hostLike?: string | null): string | null {
  if (!hostLike) {
    return null;
  }

  const normalized = hostLike
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^exp:\/\//, '')
    .split('/')[0]
    .split(':')[0];

  return normalized || null;
}

/** The dev machine's LAN address, as reported by the Expo dev server.
 *
 * Only ever available while the app is running through Expo Go or a dev client:
 * a standalone build has no dev server to ask, so every one of these lookups
 * returns undefined and this function returns null.
 */
function buildExpoLanUrl(): string | null {
  const constants = Constants as typeof Constants & {
    manifest?: { debuggerHost?: string | null };
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string | null } } };
  };

  const host =
    extractHost(constants.expoConfig?.hostUri) ??
    extractHost(constants.manifest2?.extra?.expoGo?.debuggerHost) ??
    extractHost(constants.manifest?.debuggerHost);

  return host ? `http://${host}:${DEFAULT_PORT}` : null;
}

function isLocalhostUrl(url?: string | null): boolean {
  return !!url && /localhost|127\.0\.0\.1/i.test(url);
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

// A phone can never reach the *computer's* localhost, so a localhost override is
// treated as unset rather than obeyed.
const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const configuredApiUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim();

function resolveApiUrl(): string {
  // 1. An explicit build-time override always wins.
  if (envApiUrl && !isLocalhostUrl(envApiUrl)) {
    return envApiUrl;
  }

  // 2. In development, follow the Expo dev server back to this machine's LAN
  //    IP. This is what makes `npm start` work on a real phone with no config.
  if (__DEV__) {
    const lanUrl = buildExpoLanUrl();
    if (lanUrl) {
      return lanUrl;
    }
  }

  // 3. A released build reads its backend from app.json's `expo.extra.apiUrl`.
  if (configuredApiUrl && !isLocalhostUrl(configuredApiUrl)) {
    return configuredApiUrl;
  }

  // 4. Nothing configured. In development localhost is a reasonable guess (the
  //    simulator case). In a release build it is guaranteed wrong — there is no
  //    dev server to auto-detect and no override was baked in — so say so
  //    loudly rather than shipping an app that silently fails every request
  //    against an address that cannot exist on the device.
  if (!__DEV__) {
    throw new Error(
      'eDawr: no API URL configured for this build. Set EXPO_PUBLIC_API_URL at ' +
        'build time, or expo.extra.apiUrl in app.json, to the public URL of the ' +
        'Django backend.',
    );
  }

  return `http://localhost:${DEFAULT_PORT}`;
}

export const API_URL = stripTrailingSlash(resolveApiUrl());
