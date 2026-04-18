import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid, Linking } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

interface BluetoothPrinterContextValue extends BluetoothPrinterState {
    requestPermissions: () => Promise<boolean>;
    startScan: () => Promise<void>;
    stopScan: () => void;
    connectToDevice: (device: BluetoothDevice) => Promise<void>;
    disconnectDevice: () => Promise<void>;
    /** Print a tag-formatted string payload (`[C]<b>...</b>` etc.). */
    printText: (payload: string, opts?: { width?: 58 | 80 }) => Promise<boolean>;
    openBluetoothSettings: () => Promise<void>;
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

function useBluetoothPrinterController(): BluetoothPrinterContextValue {
    const [state, setState] = useState<BluetoothPrinterState>(initialState);

    const connectedMacRef = useRef<string | null>(null);
    const autoConnectAttemptedRef = useRef(false);

    // ---------------- Permissions ----------------
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
                const results = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                ]);
                const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]
                    === PermissionsAndroid.RESULTS.GRANTED;
                const connectGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
                    === PermissionsAndroid.RESULTS.GRANTED;
                if (!scanGranted || !connectGranted) {
                    setState(prev => ({
                        ...prev,
                        error: 'Bluetooth permission denied. Open Settings → Apps → Milkey → Permissions and allow "Nearby devices".',
                    }));
                    return false;
                }
            } else {
                const result = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                );
                if (result !== PermissionsAndroid.RESULTS.GRANTED) {
                    setState(prev => ({
                        ...prev,
                        error: 'Location permission denied. Older Android needs it to scan Bluetooth printers.',
                    }));
                    return false;
                }
            }

            setState(prev => ({ ...prev, error: null }));
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
        if (!ThermalPrinter) return [];

        const tryCalls = [
            'getBluetoothDeviceList',
            'getDeviceList',
            'getBondedDevices',
        ];

        for (const fn of tryCalls) {
            if (typeof ThermalPrinter[fn] === 'function') {
                try {
                    const list = await ThermalPrinter[fn]();
                    if (Array.isArray(list) && list.length > 0) return list;
                } catch (e: any) {
                    console.warn(`[BluetoothPrinter] ${fn} failed:`, e?.message || e);
                }
            }
        }

        // Single retry after a small settle delay (Android 12+ quirk where
        // bonded devices aren't enumerated immediately after permission grant).
        await sleep(400);
        for (const fn of tryCalls) {
            if (typeof ThermalPrinter[fn] === 'function') {
                try {
                    const list = await ThermalPrinter[fn]();
                    if (Array.isArray(list)) return list;
                } catch (e: any) {
                    console.warn(`[BluetoothPrinter] retry ${fn} failed:`, e?.message || e);
                }
            }
        }
        return [];
    }, []);

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
            const granted = await requestPermissions();
            if (!granted || cancelled) return;
            setState(prev => ({ ...prev, isBluetoothEnabled: true }));

            if (autoConnectAttemptedRef.current) return;
            autoConnectAttemptedRef.current = true;

            const last = await getLastPrinter();
            if (last && !cancelled) {
                connectedMacRef.current = last.id;
                setState(prev => ({
                    ...prev,
                    isConnected: true,
                    connectedDevice: last,
                    error: null,
                }));
            }
        })();

        return () => { cancelled = true; };
    }, [getLastPrinter, requestPermissions]);

    // ---------------- Scan ----------------
    const stopScan = useCallback(() => {
        setState(prev => ({ ...prev, isScanning: false }));
    }, []);

    const startScan = useCallback(async () => {
        if (state.isScanning) return;

        if (IS_EXPO_GO || !ThermalPrinter) {
            setState(prev => ({
                ...prev,
                error: 'Bluetooth printing requires a production APK (EAS build).',
            }));
            return;
        }

        // ALWAYS re-check permissions at scan time (Android may have revoked).
        const granted = await requestPermissions();
        if (!granted) return;

        setState(prev => ({ ...prev, isScanning: true, availableDevices: [], error: null }));

        try {
            const list = await fetchDeviceList();

            const devices: BluetoothDevice[] = (list || [])
                .map((d: any) => {
                    const mac = d?.macAddress || d?.address || d?.inner_mac_address || d?.id;
                    const name = d?.deviceName || d?.name || d?.device_name;
                    if (!mac) return null;
                    return {
                        id: mac,
                        name: formatDeviceName(name, mac),
                        kind: 'ble' as const,
                    };
                })
                .filter(Boolean) as BluetoothDevice[];

            // Heuristic: probable thermal printers float to the top.
            const isPrinterLike = (n: string) =>
                /print|pos|thermal|rpp|mtp|btp|hm|spp|escpos|srs|sr5|sr8|tm-|tvs|xprinter|rongta|sunmi|epson|innerprinter/i.test(n);

            devices.sort((a, b) => {
                const ap = isPrinterLike(a.name) ? 1 : 0;
                const bp = isPrinterLike(b.name) ? 1 : 0;
                if (bp !== ap) return bp - ap;
                return a.name.localeCompare(b.name);
            });

            setState(prev => ({
                ...prev,
                availableDevices: devices,
                isScanning: false,
                isBluetoothEnabled: true,
                error: devices.length === 0
                    ? 'No paired Bluetooth printers found.\n\n1. Turn ON the printer\n2. Tap "Open Bluetooth Settings" below\n3. Pair the printer (PIN is usually 0000 or 1234)\n4. Come back here and tap Scan again.'
                    : null,
            }));
        } catch (e: any) {
            const raw = e?.message || String(e);
            console.warn('[BluetoothPrinter] scan failed:', raw);

            let friendly = raw;
            if (/permission|denied/i.test(raw)) {
                friendly = 'Bluetooth permission missing. Open Settings → Apps → Milkey → Permissions → Nearby devices → Allow.';
            } else if (/enable|turn on|adapter|disabled|not enabled/i.test(raw)) {
                friendly = 'Bluetooth is OFF. Please turn it ON and tap Scan again.';
            } else if (/null|undefined/i.test(raw)) {
                friendly = 'Bluetooth scan failed. Make sure Bluetooth is on and the printer is paired in Android settings, then try again.';
            }

            setState(prev => ({
                ...prev,
                isScanning: false,
                error: friendly,
            }));
        }
    }, [requestPermissions, state.isScanning, fetchDeviceList]);

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
        connectedMacRef.current = device.id;
        const info: BluetoothDevice = { id: device.id, name: device.name, kind: 'ble' };
        setState(prev => ({
            ...prev,
            isConnected: true,
            connectedDevice: info,
            error: null,
        }));
        await saveLastPrinter(info);
    }, [saveLastPrinter, stopScan, requestPermissions]);

    const disconnectDevice = useCallback(async () => {
        connectedMacRef.current = null;
        try { await AsyncStorage.removeItem(LAST_PRINTER_KEY); } catch { /* ignore */ }
        setState(prev => ({
            ...prev,
            isConnected: false,
            connectedDevice: null,
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

        const widthMM = opts.width ?? 58;
        const charsPerLine = widthMM === 80 ? 48 : 32;

        try {
            await ThermalPrinter.printBluetooth({
                macAddress: mac,
                payload,
                printerNbrCharactersPerLine: charsPerLine,
                printerWidthMM: widthMM,
                printerDpi: 203,
                autoCut: false,
                openCashbox: false,
                mmFeedPaper: 25,
                timeout: 30000,
            });
            setState(prev => ({ ...prev, isPrinting: false, error: null }));
            return true;
        } catch (e: any) {
            const raw = e?.message || String(e);
            console.warn('[BluetoothPrinter] print failed:', raw);

            let friendly = raw;
            if (/socket|broken pipe|write|closed|unable to connect/i.test(raw)) {
                friendly = 'Print failed: connection lost. Make sure the printer is ON and in range, then try again.';
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

    return {
        ...state,
        requestPermissions,
        startScan,
        stopScan,
        connectToDevice,
        disconnectDevice,
        printText,
        openBluetoothSettings,
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
