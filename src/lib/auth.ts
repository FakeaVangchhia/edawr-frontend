import { AdminSession } from '../types';

export const ADMIN_SESSION_KEY = 'edawr-admin-session';

export const getAdminSession = (): AdminSession | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AdminSession;
  } catch {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
};

export const getAdminAccessToken = () => getAdminSession()?.accessToken || '';
