// One API base for the admin screens. The same EXPO_PUBLIC_API_URL is also used
// by the Expo app (APK / Expo Web); VITE_API_URL remains available as a web-only
// override. Both accept a host with or without the trailing /api path.
const configuredBase = (
    __MILKEY_API_URL__ ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.EXPO_PUBLIC_API_URL ||
    '/api'
).trim();
const baseWithoutTrailingSlashes = configuredBase.replace(/\/+$/, '');

export const API_BASE_URL = /\/api$/i.test(baseWithoutTrailingSlashes)
    ? baseWithoutTrailingSlashes
    : `${baseWithoutTrailingSlashes}/api`;
