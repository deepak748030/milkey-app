// Central API config - ponytail: single source, env switch, no hardcodes
// Vercel (real) = https://milkey-app-server.vercel.app/api
// Local server-clone = http://<LAN-IP>:5000/api (EXPO_PUBLIC_API_URL must end with /api)
const rawBase = process.env.EXPO_PUBLIC_API_URL || 'https://milkey-app-server.vercel.app/api';
const normalizedBase = rawBase.endsWith('/api') ? rawBase : rawBase.replace(/\/$/, '') + '/api';
export const API_BASE_URL = normalizedBase;
export const SERVER_BASE_URL = API_BASE_URL.replace('/api','');
export const getImageUrl = (p?: string | null) => {
  if (!p) return '';
  if (p.startsWith('http')) return p;
  return `${SERVER_BASE_URL}${p.startsWith('/') ? p : `/${p}`}`;
};
