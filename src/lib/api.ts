const rawApiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '';

const normalizedApiBaseUrl = rawApiBaseUrl.replace(/\/+$/, '');

export const API_BASE_URL = normalizedApiBaseUrl;

const isAbsoluteUrl = (value: string) => /^[a-z][a-z\d+\-.]*:\/\//i.test(value);

export const apiUrl = (path: string) => {
  if (!path) {
    return API_BASE_URL || '';
  }

  if (isAbsoluteUrl(path)) {
    return path;
  }

  if (!API_BASE_URL) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const assetUrl = (path: string | null | undefined) => {
  if (!path) {
    return '';
  }

  return apiUrl(path);
};
