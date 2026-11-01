import Constants from 'expo-constants';

// EXPO_PUBLIC_API_URL is inlined by Expo for local web/native builds. app.config.js
// also reads the repository-root .env and stores the same value in Constants.extra,
// which makes the URL available to APK builds as well.
const configuredBase =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  'https://milkey-app.onrender.com/api';
const rawBase = typeof configuredBase === 'string' && configuredBase.trim()
  ? configuredBase.trim()
  : 'https://milkey-app.onrender.com/api';
const baseWithoutTrailingSlashes = rawBase.replace(/\/+$/, '');
const normalizedBase = /\/api$/i.test(baseWithoutTrailingSlashes)
  ? baseWithoutTrailingSlashes
  : `${baseWithoutTrailingSlashes}/api`;

export const API_BASE_URL = normalizedBase;
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/i, '');

export const getImageUrl = (p?: string | null) => {
  if (!p) return '';
  if (p.startsWith('http')) return p;
  return `${SERVER_BASE_URL}${p.startsWith('/') ? p : `/${p}`}`;
};
