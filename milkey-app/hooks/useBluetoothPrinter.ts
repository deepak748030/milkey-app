import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid, Linking } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

/**
 * Best-effort check whether the device's GPS / Location Services is ON.
 * On Android 12+ this is NOT required for fetching paired Bluetooth devices,
 * so we never block scan based on it — we only use it for diagnostics.
 */
async function isLocationServiceEnabled(): Promise<boolean> {
    try {
        if (Platform.OS !== 'android') return true;
        const enabled = await Location.hasServicesEnabledAsync();
        return !!enabled;
    } catch {
        // If we can't tell, assume it's fine — never block the scan because of this.
        return true;
    }
}

/**
 * Bluetooth thermal printer integration powered by `react-native-thermal-printer`
 * (DantSu ESC/POS engine for Android, MFi for iOS).
 *
 * Supports 58mm / 80mm Bluetooth thermal printers like:
 *   Shreyans SR588 / SR58B, MTP-2, TVS, XPrinter, Rongta, Sunmi, Epson, etc.
 *
 * IMPORTANT: native Bluetooth modules are NOT available in Expo Go.
 * Bluetooth printing only works inside an EAS dev client / production APK.
 *
 * Production-build hardening (Android 12+):
 *  - Always re-check runtime permissions on every scan / connect / print.
 *  - Retry device list once after a settle delay (Android 12+ quirk).
 *  - Surface real, actionable error messages.
 *  - Auto-reconnect to last used printer on app start.
 *  - Reset connection state on print failure so next attempt reconnects fresh.
 */

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const IS_PRODUCTION_BUILD =
    Constants.executionEnvironment === ExecutionEnvironment.Standalone;

export type PrinterKind = 'ble';

export interface BluetoothDevice {
    id: string;          // MAC address
    name: string;
    kind: PrinterKind;
}

interface BluetoothPrinterState {
    isScanning: boolean;
    isConnected: boolean;
    connectedDevice: BluetoothDevice | null;
    availableDevices: BluetoothDevice[];
    error: string | null;
    isBluetoothEnabled: boolean;
    isPrinting: boolean;
}

export interface PrinterDiagnostics {
    platform: string;
    apiLevel: number | string;
    isExpoGo: boolean;
    isProductionBuild: boolean;
    nativeModuleLoaded: boolean;
    nativeModuleName: string | null;
    nativeMethodsAvailable: {
        getBluetoothDeviceList: boolean;
        printBluetooth: boolean;
    };
    nativeLoadError: string | null;
    permissions: {
        bluetoothConnect: boolean | 'n/a';
        bluetoothScan: boolean | 'n/a';
        accessFineLocation: boolean | 'n/a';
    };
    isBluetoothEnabled: boolean;
    locationServicesEnabled: boolean;
    bondedDeviceCount: number;
    bondedDeviceNames: string[];
    rawNativeResponse: string | null;
    isConnected: boolean;
    connectedDeviceName: string | null;
    rememberedPrinterName: string | null;
    /** Last scan attempt summary: when and how many devices it returned. */
    lastScan: {
        attemptedAt: string | null;
        durationMs: number | null;
        deviceCount: number | null;
        outcome: 'success' | 'empty' | 'error' | 'never';
        error: string | null;
    };
    /** Last connect attempt summary so users see why a tap didn't connect. */
    lastConnect: {
        attemptedAt: string | null;
        deviceName: string | null;
        outcome: 'success' | 'error' | 'never';
        error: string | null;
    };
    /** Last test/real print attempt summary. */
    lastPrint: {
        attemptedAt: string | null;
        outcome: 'success' | 'error' | 'never';
        error: string | null;
    };
    lastRawError: string | null;
    /** Computed list of likely problems with one-line fixes. */
    issues: string[];
    capturedAt: string;
}

interface BluetoothPrinterContextValue extends BluetoothPrinterState {
    requestPermissions: () => Promise<boolean>;
    startScan: () => Promise<void>;
    stopScan: () => void;
    connectToDevice: (device: BluetoothDevice) => Promise<void>;
    disconnectDevice: () => Promise<void>;
    /** Print a tag-formatted string payload (`[C]<b>...</b>` etc.). */
    printText: (payload: string, opts?: { width?: 58 | 80 }) => Promise<boolean>;
    openBluetoothSettings: () => Promise<void>;
    /** Collect a fresh diagnostic snapshot from the native module + OS. */
    getDiagnostics: () => Promise<PrinterDiagnostics>;
}

const LAST_PRINTER_KEY = '@milkey_last_printer';

const initialState: BluetoothPrinterState = {
    isScanning: false,
    isConnected: false,
    connectedDevice: null,
    availableDevices: [],
    error: null,
    isBluetoothEnabled: false,
    isPrinting: false,
};

const BluetoothPrinterContext = createContext<BluetoothPrinterContextValue | undefined>(undefined);

// Lazy-load native module — guarded so web / Expo Go don't crash at import time.
let ThermalPrinter: any = null;
let nativeLoadError: string | null = null;
try {
    if (Platform.OS !== 'web' && !IS_EXPO_GO) {
        const mod = require('react-native-thermal-printer');
        ThermalPrinter = mod.default || mod.ThermalPrinterModule || mod;
        if (!ThermalPrinter || typeof ThermalPrinter.printBluetooth !== 'function') {
            nativeLoadError = 'react-native-thermal-printer native module not linked.';
            ThermalPrinter = null;
        }
    }
} catch (e: any) {
    nativeLoadError = e?.message || 'Failed to load react-native-thermal-printer.';
    ThermalPrinter = null;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const formatDeviceName = (raw: string | undefined, mac: string): string => {
    const name = (raw || '').trim();
    if (name.length > 0) return name;
    const suffix = mac ? mac.slice(-4).toUpperCase() : 'UNKNOWN';
    return `Thermal Printer ${suffix}`;
};

const isProbablyPrinter = (name: string) =>
    /print|pos|thermal|rpp|mtp|btp|hm|spp|escpos|srs|sr5|sr8|sr588|tm-|tvs|xprinter|rongta|sunmi|epson|innerprinter|bt-spp|bluetooth printer/i.test(name);

const normalizeDeviceList = (list: any[]): BluetoothDevice[] => {
    const byMac = new Map<string, BluetoothDevice>();

    for (const device of list || []) {
        const mac = [device?.macAddress, device?.address, device?.inner_mac_address, device?.id]
            .find((value): value is string => typeof value === 'string' && value.trim().length > 0);

        if (!mac) continue;

        const name = device?.deviceName || device?.name || device?.device_name;
        byMac.set(mac, {
            id: mac,
            name: formatDeviceName(name, mac),
            kind: 'ble',
        });
    }

    return Array.from(byMac.values()).sort((a, b) => {
        const printerDelta = Number(isProbablyPrinter(b.name)) - Number(isProbablyPrinter(a.name));
        if (printerDelta !== 0) return printerDelta;
        return a.name.localeCompare(b.name);
    });
};

const buildBluetoothPrintOptions = (
    payload: string,
    widthMM: 58 | 80,
    charsPerLine: number,
    macAddress?: string,
) => ({
    macAddress: macAddress ?? '',
    payload,
    printerNbrCharactersPerLine: charsPerLine,
    printerWidthMM: widthMM,
    printerDpi: 203,
    autoCut: false,
    openCashbox: false,
    mmFeedPaper: 12,
    timeout: 30000,
});

function useBluetoothPrinterController(): BluetoothPrinterContextValue {
    const [state, setState] = useState<BluetoothPrinterState>(initialState);

    const connectedMacRef = useRef<string | null>(null);
    const autoConnectAttemptedRef = useRef(false);
    const scanInFlightRef = useRef(false);
    const lastRawErrorRef = useRef<string | null>(null);
    const lastBondedListRef = useRef<BluetoothDevice[]>([]);
    const rawNativeResponseRef = useRef<string | null>(null);
    const lastScanRef = useRef<PrinterDiagnostics['lastScan']>({
        attemptedAt: null, durationMs: null, deviceCount: null, outcome: 'never', error: null,
    });
    const lastConnectRef = useRef<PrinterDiagnostics['lastConnect']>({
        attemptedAt: null, deviceName: null, outcome: 'never', error: null,
    });
    const lastPrintRef = useRef<PrinterDiagnostics['lastPrint']>({
        attemptedAt: null, outcome: 'never', error: null,
    });

    // ---------------- Permissions ----------------
    /**
     * Check-first, then request — never prompt unnecessarily.
     * On Android 12+ we only need BLUETOOTH_CONNECT to enumerate paired devices
     * and to print. BLUETOOTH_SCAN is only needed for active discovery (which
     * we don't do — we only query bonded devices). We still request both so a
     * future "discover unpaired" feature works without re-prompting.
     */
    const checkPermissionsGranted = useCallback(async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return true;
        const apiLevel = typeof Platform.Version === 'number'
            ? Platform.Version
            : Number(Platform.Version);
        try {
            if (apiLevel >= 31) {
                const connect = await PermissionsAndroid.check(
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                );
                // CONNECT alone is sufficient to list bonded devices + print.
                return connect;
            }
            const loc = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            );
            return loc;
        } catch {
            return false;
        }
    }, []);

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === 'web') {
            setState(prev => ({ ...prev, error: 'Bluetooth printing is not available on web.' }));
            return false;
        }
        if (Platform.OS === 'ios') return true;

        try {
            const apiLevel = typeof Platform.Version === 'number'
                ? Platform.Version
                : Number(Platform.Version);

            if (apiLevel >= 31) {
                // Track whether the user has already granted CONNECT before this
                // request. If they had it, no UI dialog will pop and we don't
                // need a settle delay. If they DIDN'T have it and we're about
                // to prompt, we sleep 500ms after the grant so the Android
                // Bluetooth stack finishes finalizing the permission before
                // we hit the radio. Skipping this causes intermittent
                // "permission denied" / silent scan failures right after the
                // user taps "Allow" on the Nearby devices dialog.
                const hadConnectAlready = await PermissionsAndroid.check(
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                );

                // Android 12+: request BLUETOOTH_SCAN + BLUETOOTH_CONNECT together.
                // Manifest declares BLUETOOTH_SCAN with neverForLocation, so the
                // OS will NOT prompt for Location at all — single "Nearby devices"
                // dialog covers both. We MUST NOT request ACCESS_FINE_LOCATION on
                // API 31+ — it pops a second, confusing Location dialog.
                const results = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                ]);
                const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]
                    === PermissionsAndroid.RESULTS.GRANTED;
                const connectGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
                    === PermissionsAndroid.RESULTS.GRANTED;
                // CONNECT is the critical one — without it we can't enumerate
                // bonded devices or open a socket. SCAN is nice-to-have for
                // future discovery; if denied we still proceed since we only
                // query bonded (paired) devices on the SR588 / SR58B / etc.
                if (!connectGranted) {
                    setState(prev => ({
                        ...prev,
                        error: 'Bluetooth permission denied. Open Settings → Apps → Milkey → Permissions → Nearby devices → Allow.',
                    }));
                    return false;
                }
                if (!scanGranted) {
                    console.warn('[BluetoothPrinter] BLUETOOTH_SCAN denied — proceeding with bonded-only flow.');
                }

                // Permission settle delay — only when we just prompted the user.
                if (!hadConnectAlready) {
                    console.log('[BluetoothPrinter] permission just granted — settling 500ms before native call.');
                    await sleep(500);
                }
            } else {
                // Android <= 11: needs ACCESS_FINE_LOCATION to enumerate paired BT.
                const hadLocationAlready = await PermissionsAndroid.check(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                );
                const locationResult = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: 'Location Permission',
                        message: 'Milkey needs location access to find nearby Bluetooth printers.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );

                if (locationResult !== PermissionsAndroid.RESULTS.GRANTED) {
                    setState(prev => ({
                        ...prev,
                        error: 'Location permission denied. Allow Location to load paired printers on this Android version.',
                    }));
                    return false;
                }
                if (!hadLocationAlready) {
                    console.log('[BluetoothPrinter] location permission just granted — settling 500ms.');
                    await sleep(500);
                }
            }

            setState(prev => ({ ...prev, error: null, isBluetoothEnabled: true }));
            return true;
        } catch (e: any) {
            setState(prev => ({
                ...prev,
                error: e?.message || 'Failed to request Bluetooth permissions.',
            }));
            return false;
        }
    }, []);

    // ---------------- Persistence ----------------
    const saveLastPrinter = useCallback(async (device: BluetoothDevice) => {
        try { await AsyncStorage.setItem(LAST_PRINTER_KEY, JSON.stringify(device)); } catch { /* ignore */ }
    }, []);

    const getLastPrinter = useCallback(async (): Promise<BluetoothDevice | null> => {
        try {
            const data = await AsyncStorage.getItem(LAST_PRINTER_KEY);
            if (!data) return null;
            const parsed = JSON.parse(data);
            return { id: parsed.id, name: parsed.name, kind: 'ble' };
        } catch {
            return null;
        }
    }, []);

    // ---------------- Open OS Bluetooth settings ----------------
    const openBluetoothSettings = useCallback(async () => {
        try {
            if (Platform.OS === 'android') {
                await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
            } else {
                await Linking.openURL('App-Prefs:Bluetooth');
            }
        } catch {
            try { await Linking.openSettings(); } catch { /* ignore */ }
        }
    }, []);

    // ---------------- Device list (paired) ----------------
    /**
     * Fetch the paired/bonded Bluetooth device list with one automatic retry.
     * Different versions of react-native-thermal-printer expose this under
     * slightly different names — try them all, then return what we get.
     */
    const fetchDeviceList = useCallback(async (): Promise<any[]> => {
        if (!ThermalPrinter) {
            rawNativeResponseRef.current = '(native module not loaded)';
            return [];
        }

        if (typeof ThermalPrinter.getBluetoothDeviceList !== 'function') {
            rawNativeResponseRef.current = '(method getBluetoothDeviceList not available on native module)';
            console.warn('[BluetoothPrinter] getBluetoothDeviceList is not available on the native module.');
            return [];
        }

        try {
            const list = await ThermalPrinter.getBluetoothDeviceList();
            try { rawNativeResponseRef.current = JSON.stringify(list); } catch { rawNativeResponseRef.current = String(list); }
            if (Array.isArray(list) && list.length > 0) return list;
        } catch (e: any) {
            rawNativeResponseRef.current = `error: ${e?.message || String(e)}`;
            console.warn('[BluetoothPrinter] getBluetoothDeviceList failed:', e?.message || e);
        }

        await sleep(400);

        try {
            const list = await ThermalPrinter.getBluetoothDeviceList();
            try { rawNativeResponseRef.current = `(retry) ${JSON.stringify(list)}`; } catch { rawNativeResponseRef.current = `(retry) ${String(list)}`; }
            if (Array.isArray(list)) return list;
        } catch (e: any) {
            rawNativeResponseRef.current = `(retry) error: ${e?.message || String(e)}`;
            console.warn('[BluetoothPrinter] retry getBluetoothDeviceList failed:', e?.message || e);
        }

        return [];
    }, []);

    const resolvePreferredDevice = useCallback(async (devices: BluetoothDevice[]): Promise<BluetoothDevice | null> => {
        const currentMac = connectedMacRef.current;
        if (currentMac) {
            const current = devices.find(device => device.id === currentMac);
            if (current) return current;
        }

        const last = await getLastPrinter();
        if (last) {
            const remembered = devices.find(device => device.id === last.id);
            if (remembered) return remembered;
        }

        if (devices.length === 1) return devices[0];
        return null;
    }, [getLastPrinter]);

    // ---------------- Init effect (auto-reconnect) ----------------
    useEffect(() => {
        if (Platform.OS === 'web') {
            setState(prev => ({ ...prev, error: 'Bluetooth printing is not available on web.' }));
            return;
        }
        if (IS_EXPO_GO) {
            console.warn('[BluetoothPrinter] Expo Go detected — native printer modules unavailable.');
            setState(prev => ({
                ...prev,
                error: 'Bluetooth printing requires a production APK or EAS dev build (not Expo Go).',
            }));
            return;
        }
        if (!ThermalPrinter) {
            setState(prev => ({
                ...prev,
                error: nativeLoadError
                    ? `Printer module unavailable: ${nativeLoadError}`
                    : 'Bluetooth printer module not installed. Rebuild with EAS.',
            }));
            return;
        }

        // Configure printer defaults if available (per react-native-thermal-printer docs).
        try {
            if (ThermalPrinter.defaultConfig) {
                ThermalPrinter.defaultConfig = {
                    ...ThermalPrinter.defaultConfig,
                    timeout: 30000,
                    autoCut: false,
                    printerNbrCharactersPerLine: 32,
                    printerWidthMM: 58,
                    printerDpi: 203,
                };
            }
        } catch { /* ignore */ }

        let cancelled = false;

        (async () => {
            // Don't prompt on cold start — only auto-load if user already
            // granted permissions in a previous session. First-time users will
            // see the prompt when they tap the printer icon / Scan button.
            const alreadyGranted = await checkPermissionsGranted();
            if (!alreadyGranted || cancelled) return;
            setState(prev => ({ ...prev, isBluetoothEnabled: true }));

            if (autoConnectAttemptedRef.current) return;
            autoConnectAttemptedRef.current = true;

            // Remember the last-used printer in-memory so it shows up in the list,
            // but DO NOT mark as "connected" until we've actually verified the
            // socket. Otherwise the topbar lies (shows green Connected) when the
            // printer is OFF / out of range — confusing the user.
            const last = await getLastPrinter();
            if (last && !cancelled) {
                setState(prev => ({
                    ...prev,
                    availableDevices: prev.availableDevices.find(d => d.id === last.id)
                        ? prev.availableDevices
                        : [last, ...prev.availableDevices],
                }));
            }

            // Auto-load paired Bluetooth devices on app start so the user sees
            // their already-paired printer in the list without having to tap Scan.
            try {
                await sleep(500);
                const list = await fetchDeviceList();
                if (cancelled) return;
                const devices = normalizeDeviceList(list);
                console.log('[BluetoothPrinter] auto-loaded paired devices on init:', devices.length);

                // Merge connected device into the list if it's not already there
                // (paired list sometimes omits currently-connected printers).
                const merged = [...devices];
                if (last && !merged.find(d => d.id === last.id)) {
                    merged.unshift(last);
                }

                setState(prev => ({
                    ...prev,
                    availableDevices: merged,
                }));
            } catch (e: any) {
                console.warn('[BluetoothPrinter] auto-load paired devices failed:', e?.message || e);
            }
        })();

        return () => { cancelled = true; };
    }, [getLastPrinter, checkPermissionsGranted, fetchDeviceList]);

    // ---------------- Scan ----------------
    const stopScan = useCallback(() => {
        scanInFlightRef.current = false;
        setState(prev => ({ ...prev, isScanning: false }));
    }, []);

    const startScan = useCallback(async () => {
        // Don't silently bail — that's exactly what made the Scan button feel
        // unresponsive in production after a previous scan. Instead, force-reset
        // the in-flight flag so a fresh tap always starts a new scan.
        if (scanInFlightRef.current) {
            console.warn('[BluetoothPrinter] previous scan still flagged in-flight; forcing reset.');
            scanInFlightRef.current = false;
        }
        scanInFlightRef.current = true;

        if (IS_EXPO_GO || !ThermalPrinter) {
            scanInFlightRef.current = false;
            setState(prev => ({
                ...prev,
                isScanning: false,
                error: 'Bluetooth printing requires a production APK (EAS build).',
            }));
            return;
        }

        // ALWAYS re-check permissions at scan time (Android may have revoked).
        // Note: do NOT clear availableDevices here — keep the previous list visible
        // so the user doesn't see an empty list flash if the scan briefly fails.
        setState(prev => ({ ...prev, isScanning: true, error: null }));
        const scanStart = Date.now();
        lastScanRef.current = {
            attemptedAt: new Date().toISOString(),
            durationMs: null, deviceCount: null, outcome: 'never', error: null,
        };

        try {
            const granted = await requestPermissions();
            if (!granted) {
                lastScanRef.current = {
                    ...lastScanRef.current,
                    durationMs: Date.now() - scanStart,
                    deviceCount: 0,
                    outcome: 'error',
                    error: 'Permission denied',
                };
                setState(prev => ({ ...prev, isScanning: false }));
                return;
            }

            // Soft check — log but never block. paired-device fetch on Android does
            // not require GPS to be ON in modern react-native-thermal-printer.
            const locationEnabled = await isLocationServiceEnabled();
            if (!locationEnabled) {
                console.warn('[BluetoothPrinter] Location services are OFF — proceeding anyway for paired list.');
            }

            await sleep(300);
            const list = await fetchDeviceList();
            console.log('[BluetoothPrinter] raw paired list from native:', JSON.stringify(list));

            const devices = normalizeDeviceList(list);
            lastBondedListRef.current = devices;
            console.log('[BluetoothPrinter] normalized devices:', devices.length, devices);

            // Always include the currently-connected device in the list, even if
            // the native paired-device call momentarily omits it.
            const connectedMac = connectedMacRef.current;
            const last = await getLastPrinter();
            const merged = [...devices];
            if (connectedMac && last && !merged.find(d => d.id === connectedMac)) {
                merged.unshift(last);
            }

            lastScanRef.current = {
                attemptedAt: lastScanRef.current.attemptedAt,
                durationMs: Date.now() - scanStart,
                deviceCount: merged.length,
                outcome: merged.length > 0 ? 'success' : 'empty',
                error: null,
            };

            setState(prev => ({
                ...prev,
                availableDevices: merged,
                isScanning: false,
                isBluetoothEnabled: true,
                error: merged.length === 0
                    ? 'No paired Bluetooth printers found.\n\n• Make sure Bluetooth is ON on this phone\n• Turn ON the printer (light should be solid)\n• Open Android Settings → Connected devices → Pair new device → pair the printer (PIN 0000 or 1234)\n• On Android 12+, also allow "Nearby devices" in App permissions\n• Come back and tap Scan again.'
                    : null,
            }));
        } catch (e: any) {
            const raw = e?.message || String(e);
            lastRawErrorRef.current = raw;
            console.warn('[BluetoothPrinter] scan failed:', raw);

            let friendly = raw;
            if (/permission|denied/i.test(raw)) {
                friendly = 'Bluetooth permission missing. Open Settings → Apps → Milkey → Permissions → Nearby devices → Allow.';
            } else if (/enable|turn on|adapter|disabled|not enabled/i.test(raw)) {
                friendly = 'Bluetooth is OFF. Please turn it ON and tap Scan again.';
            } else if (/null|undefined/i.test(raw)) {
                friendly = 'Bluetooth scan failed. Make sure Bluetooth is on and the printer is paired in Android settings, then try again.';
            }

            lastScanRef.current = {
                attemptedAt: lastScanRef.current.attemptedAt,
                durationMs: Date.now() - scanStart,
                deviceCount: 0,
                outcome: 'error',
                error: raw,
            };

            setState(prev => ({
                ...prev,
                isScanning: false,
                error: friendly,
            }));
        } finally {
            scanInFlightRef.current = false;
        }
    }, [requestPermissions, fetchDeviceList, getLastPrinter]);

    // ---------------- Connect / Disconnect ----------------
    /**
     * react-native-thermal-printer is "stateless" — there's no persistent
     * connectPrinter() call. Instead, the printBluetooth() call takes a
     * macAddress and connects+prints+disconnects in one shot.
     *
     * To preserve the UX of "connect once, then print many times", we just
     * remember the chosen MAC and reuse it on every print.
     */
    const connectToDevice = useCallback(async (device: BluetoothDevice) => {
        if (!ThermalPrinter) {
            setState(prev => ({ ...prev, error: 'Printer module unavailable. Build the app with EAS.' }));
            return;
        }
        const granted = await requestPermissions();
        if (!granted) return;

        stopScan();
        lastConnectRef.current = {
            attemptedAt: new Date().toISOString(),
            deviceName: `${device.name} (${device.id})`,
            outcome: 'success',
            error: null,
        };

        connectedMacRef.current = device.id;
        const info: BluetoothDevice = { id: device.id, name: device.name, kind: 'ble' };
        setState(prev => {
            const exists = prev.availableDevices.find(d => d.id === info.id);
            const list = exists ? prev.availableDevices : [info, ...prev.availableDevices];
            return {
                ...prev,
                isConnected: true,
                connectedDevice: info,
                availableDevices: list,
                error: null,
            };
        });
        await saveLastPrinter(info);
    }, [saveLastPrinter, stopScan, requestPermissions]);

    const disconnectDevice = useCallback(async () => {
        // Only clear the in-memory connection. Keep LAST_PRINTER_KEY so the
        // user's last-used printer is still remembered for the next session —
        // they can switch printers from the scan sheet without losing history.
        connectedMacRef.current = null;
        setState(prev => ({
            ...prev,
            isConnected: false,
            connectedDevice: null,
            error: null,
        }));
    }, []);

    // ---------------- Print ----------------
    const printText = useCallback(async (
        payload: string,
        opts: { width?: 58 | 80 } = {},
    ): Promise<boolean> => {
        if (!ThermalPrinter) {
            setState(prev => ({
                ...prev,
                error: 'Printer module unavailable. Build the app with EAS.',
            }));
            return false;
        }

        const granted = await requestPermissions();
        if (!granted) return false;

        let mac = connectedMacRef.current;
        if (!mac) {
            const last = await getLastPrinter();
            if (last) {
                mac = last.id;
                connectedMacRef.current = last.id;
                setState(prev => ({
                    ...prev,
                    isConnected: true,
                    connectedDevice: last,
                }));
            }
        }

        if (!mac) {
            setState(prev => ({
                ...prev,
                error: 'No printer selected. Tap the printer icon in the top bar and connect a printer first.',
            }));
            return false;
        }

        setState(prev => ({ ...prev, isPrinting: true, error: null }));
        lastPrintRef.current = {
            attemptedAt: new Date().toISOString(),
            outcome: 'never',
            error: null,
        };

        const widthMM = opts.width ?? 58;
        const charsPerLine = widthMM === 80 ? 48 : 32;

        try {
            let refreshedBonded = lastBondedListRef.current;
            let activeDevice = state.connectedDevice && state.connectedDevice.id === mac
                ? state.connectedDevice
                : null;

            const runPrintAttempt = async (macAddress: string) => {
                await ThermalPrinter.printBluetooth(
                    buildBluetoothPrintOptions(payload, widthMM, charsPerLine, macAddress),
                );
            };

            try {
                await runPrintAttempt(mac);
            } catch (primaryError: any) {
                const primaryRaw = primaryError?.message || String(primaryError);
                lastRawErrorRef.current = primaryRaw;
                console.warn('[BluetoothPrinter] primary print attempt failed:', primaryRaw);

                const freshRawList = await fetchDeviceList();
                refreshedBonded = normalizeDeviceList(freshRawList);
                lastBondedListRef.current = refreshedBonded;

                const refreshedMatch = refreshedBonded.find(device => device.id === mac);
                if (refreshedMatch) {
                    activeDevice = refreshedMatch;
                }

                let retried = false;
                if (/not found|bluetooth device not found/i.test(primaryRaw) || refreshedMatch) {
                    retried = true;
                    try {
                        await runPrintAttempt(activeDevice?.id ?? mac);
                    } catch (retryError: any) {
                        const retryRaw = retryError?.message || String(retryError);
                        lastRawErrorRef.current = retryRaw;
                        console.warn('[BluetoothPrinter] print retry after refresh failed:', retryRaw);
                        throw new Error(`${primaryRaw} | retry failed: ${retryRaw}`);
                    }
                } else {
                    throw primaryError;
                }

                if (!retried) {
                    throw primaryError;
                }
            }

            if (!activeDevice && refreshedBonded.length === 1) {
                activeDevice = refreshedBonded[0];
            }

            if (!activeDevice && lastBondedListRef.current.length === 1) {
                activeDevice = lastBondedListRef.current[0];
            }

            if (!activeDevice) {
                activeDevice = { id: mac, name: state.connectedDevice?.name ?? 'Bluetooth Printer', kind: 'ble' };
            }

            connectedMacRef.current = activeDevice.id;
            await saveLastPrinter(activeDevice);
            lastPrintRef.current = { ...lastPrintRef.current, outcome: 'success', error: null };
            setState(prev => ({
                ...prev,
                isPrinting: false,
                isConnected: true,
                connectedDevice: activeDevice,
                error: null,
            }));
            return true;
        } catch (e: any) {
            const raw = e?.message || String(e);
            lastRawErrorRef.current = raw;
            lastPrintRef.current = { ...lastPrintRef.current, outcome: 'error', error: raw };
            console.warn('[BluetoothPrinter] print failed:', raw);

            let friendly = raw;
            if (/socket|broken pipe|write|closed|unable to connect/i.test(raw)) {
                const bondedCount = lastBondedListRef.current.length;
                if (bondedCount === 1) {
                    try {
                        const onlyPrinter = lastBondedListRef.current[0];
                        await ThermalPrinter.printBluetooth(
                            buildBluetoothPrintOptions(payload, widthMM, charsPerLine),
                        );
                        connectedMacRef.current = onlyPrinter.id;
                        await saveLastPrinter(onlyPrinter);
                        lastPrintRef.current = { ...lastPrintRef.current, outcome: 'success', error: null };
                        setState(prev => ({
                            ...prev,
                            isPrinting: false,
                            isConnected: true,
                            connectedDevice: onlyPrinter,
                            error: null,
                        }));
                        return true;
                    } catch (fallbackError: any) {
                        const fallbackRaw = fallbackError?.message || String(fallbackError);
                        lastRawErrorRef.current = fallbackRaw;
                        lastPrintRef.current = { ...lastPrintRef.current, outcome: 'error', error: `${raw} | fallback failed: ${fallbackRaw}` };
                        friendly = 'Print failed: the printer is paired but Android refused the Bluetooth socket. This usually means SR588 is connected to another phone, paired in the wrong Bluetooth mode, or needs to be unpaired and paired again.';
                    }
                } else {
                    friendly = 'Print failed: connection lost. Make sure the printer is ON and in range, then try again.';
                }
            } else if (/permission/i.test(raw)) {
                friendly = 'Bluetooth Connect permission missing. Allow "Nearby devices" in app permissions.';
            } else if (/not paired|bonded/i.test(raw)) {
                friendly = 'Printer is no longer paired. Open Bluetooth Settings, pair it again, then reconnect.';
                connectedMacRef.current = null;
                setState(prev => ({ ...prev, isConnected: false, connectedDevice: null }));
            }

            setState(prev => ({
                ...prev,
                isPrinting: false,
                error: friendly,
            }));
            return false;
        }
    }, [requestPermissions, getLastPrinter]);

    // ---------------- Diagnostics ----------------
    const getDiagnostics = useCallback(async (): Promise<PrinterDiagnostics> => {
        const platform = Platform.OS;
        const apiLevel = Platform.OS === 'android'
            ? (typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version))
            : 'n/a';

        let btConnect: boolean | 'n/a' = 'n/a';
        let btScan: boolean | 'n/a' = 'n/a';
        let fineLoc: boolean | 'n/a' = 'n/a';

        if (Platform.OS === 'android') {
            try {
                btConnect = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
            } catch { btConnect = false; }
            try {
                btScan = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
            } catch { btScan = false; }
            try {
                fineLoc = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
            } catch { fineLoc = false; }
        }

        // Re-fetch bonded list fresh so the diagnostic reflects ground truth
        // rather than whatever the last scan happened to leave behind.
        let bonded: BluetoothDevice[] = lastBondedListRef.current;
        let btEnabled = state.isBluetoothEnabled;
        if (ThermalPrinter && (btConnect === true || Platform.OS !== 'android')) {
            try {
                const raw = await fetchDeviceList();
                bonded = normalizeDeviceList(raw);
                lastBondedListRef.current = bonded;
                btEnabled = true; // a successful native call implies adapter is ON
            } catch (e: any) {
                lastRawErrorRef.current = e?.message || String(e);
                btEnabled = false;
            }
        }

        const locEnabled = await isLocationServiceEnabled();

        // Also surface the last-remembered printer (saved after a successful
        // connect) so users understand why "Connected: no" can be shown even
        // though they previously connected to a printer — the app deliberately
        // does NOT mark a remembered printer as live-connected until a probe
        // or print succeeds again. This avoids a false-green status when the
        // printer is OFF / out of range.
        let rememberedName: string | null = null;
        try {
            const last = await getLastPrinter();
            if (last) rememberedName = `${last.name} (${last.id})`;
        } catch { /* ignore */ }

        // Compute likely problems from the captured signals so users see
        // an actionable summary, not just raw fields.
        const issues: string[] = [];
        if (IS_EXPO_GO) {
            issues.push('Running in Expo Go — Bluetooth printing requires an EAS build / production APK.');
        }
        if (!ThermalPrinter) {
            issues.push('Native printer module not loaded — rebuild the app with EAS.');
        } else if (typeof ThermalPrinter.getBluetoothDeviceList !== 'function') {
            issues.push('Native method getBluetoothDeviceList missing — installed printer module is incompatible.');
        }
        if (Platform.OS === 'android') {
            if (btConnect !== true) {
                issues.push('BLUETOOTH_CONNECT permission denied — Settings → Apps → Milkey → Permissions → Nearby devices → Allow.');
            }
            const apiNum = typeof apiLevel === 'number' ? apiLevel : 0;
            if (apiNum > 0 && apiNum < 31 && fineLoc !== true) {
                issues.push('Location permission denied — required on Android 11 and below to list paired Bluetooth devices.');
            }
        }
        if (!btEnabled) {
            issues.push('Bluetooth adapter is OFF or unreachable — turn ON Bluetooth and try Scan again.');
        }
        if (btEnabled && bonded.length === 0) {
            issues.push('No paired devices found — pair the printer in Android Settings → Connected devices first.');
        }
        if (lastScanRef.current.outcome === 'success' && bonded.length > 0 && !state.isConnected) {
            issues.push('Devices visible but not connected — tap your printer in the list and run Test Print.');
        }
        if (lastConnectRef.current.outcome === 'error' && lastConnectRef.current.error) {
            const err = lastConnectRef.current.error;
            if (/socket|unable to connect|read failed|broken pipe|closed/i.test(err)) {
                issues.push('Last connect failed: socket error — printer is OFF, out of range, or paired with another phone.');
            } else if (/timeout/i.test(err)) {
                issues.push('Last connect timed out — power-cycle the printer and try again.');
            } else if (/not paired|bonded/i.test(err)) {
                issues.push('Last connect failed: not paired — re-pair the printer in Android Bluetooth settings.');
            } else {
                issues.push(`Last connect failed: ${err}`);
            }
        }
        if (lastPrintRef.current.outcome === 'error' && lastPrintRef.current.error) {
            issues.push(`Last print failed: ${lastPrintRef.current.error}`);
        }

        const moduleName = ThermalPrinter
            ? (ThermalPrinter.constructor?.name || 'react-native-thermal-printer')
            : null;

        return {
            platform,
            apiLevel,
            isExpoGo: IS_EXPO_GO,
            isProductionBuild: IS_PRODUCTION_BUILD,
            nativeModuleLoaded: !!ThermalPrinter,
            nativeModuleName: moduleName,
            nativeMethodsAvailable: {
                getBluetoothDeviceList: !!(ThermalPrinter && typeof ThermalPrinter.getBluetoothDeviceList === 'function'),
                printBluetooth: !!(ThermalPrinter && typeof ThermalPrinter.printBluetooth === 'function'),
            },
            nativeLoadError,
            permissions: {
                bluetoothConnect: btConnect,
                bluetoothScan: btScan,
                accessFineLocation: fineLoc,
            },
            isBluetoothEnabled: btEnabled,
            locationServicesEnabled: locEnabled,
            bondedDeviceCount: bonded.length,
            bondedDeviceNames: bonded.map(d => `${d.name} (${d.id})`),
            rawNativeResponse: rawNativeResponseRef.current,
            isConnected: state.isConnected,
            connectedDeviceName: state.connectedDevice?.name ?? null,
            rememberedPrinterName: rememberedName,
            lastScan: { ...lastScanRef.current },
            lastConnect: { ...lastConnectRef.current },
            lastPrint: { ...lastPrintRef.current },
            lastRawError: lastRawErrorRef.current,
            issues,
            capturedAt: new Date().toISOString(),
        };
    }, [state.isBluetoothEnabled, state.isConnected, state.connectedDevice, fetchDeviceList, getLastPrinter]);

    return {
        ...state,
        requestPermissions,
        startScan,
        stopScan,
        connectToDevice,
        disconnectDevice,
        printText,
        openBluetoothSettings,
        getDiagnostics,
    };
}

export function BluetoothPrinterProvider({ children }: { children: React.ReactNode }) {
    const value = useBluetoothPrinterController();
    return React.createElement(BluetoothPrinterContext.Provider, { value }, children);
}

export const useBluetoothPrinter = () => {
    const context = useContext(BluetoothPrinterContext);
    if (!context) {
        throw new Error('useBluetoothPrinter must be used within BluetoothPrinterProvider');
    }
    return context;
};
