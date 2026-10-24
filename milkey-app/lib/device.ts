import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { API_BASE_URL } from '@/lib/apiConfig';
import { getAuthToken } from '@/lib/authStore';

const STORAGE_KEY = 'milkey_device_id';

function sanitize(s: string): string {
  return String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

export async function getStableDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    // Generate deterministic + random fallback
    const nativePart = sanitize(`${Platform.OS}-${Device.modelName || 'unknown'}-${Device.osVersion || '0'}`);
    const rand = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    const id = `${nativePart}-${rand}`.slice(0, 96);
    await AsyncStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return sanitize(`${Platform.OS}-${Device.modelName || 'device'}-${Date.now()}`.slice(0, 80));
  }
}

export async function getDeviceMeta(): Promise<{
  deviceId: string;
  deviceName: string;
  platform: string;
  modelName: string;
  osName: string;
  osVersion: string;
  appVersion: string;
  userAgent: string;
}> {
  const deviceId = await getStableDeviceId();
  const modelName = (Device as any).modelName || Device.modelId || 'unknown';
  const osName = (Device as any).osName || Platform.OS || 'unknown';
  const osVersion = (Device as any).osVersion || String(Platform.Version || '');
  const appVersion = Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version || '';
  const deviceName = (Device as any).deviceName || modelName || `${Platform.OS} device`;

  return {
    deviceId,
    deviceName: String(deviceName).slice(0, 80),
    platform: Platform.OS as string,
    modelName: String(modelName).slice(0, 80),
    osName: String(osName).slice(0, 32),
    osVersion: String(osVersion).slice(0, 32),
    appVersion: String(appVersion || '').slice(0, 32),
    userAgent: '',
  };
}

export async function registerCurrentDevice(): Promise<{ success: boolean; message?: string }> {
  try {
    const token = await getAuthToken();
    if (!token) return { success: false, message: 'No token' };
    const meta = await getDeviceMeta();
    // Try to include push token if previously stored
    let pushToken = '';
    try { pushToken = (await AsyncStorage.getItem('expoPushToken')) || ''; } catch {}
    const res = await fetch(`${API_BASE_URL}/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Device-Id': meta.deviceId },
      body: JSON.stringify({ ...meta, pushToken }),
    });
    const j = await res.json().catch(() => null);
    if (j?.success) return { success: true };
    return { success: false, message: j?.message || 'Register failed' };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Network error' };
  }
}

export function relativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso as any);
  if (isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
