import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bytesToBase64 } from '@/lib/escpos';

/**
 * Bluetooth thermal printer integration powered by
 * `react-native-thermal-receipt-printer-image-qr`.
 *
 * Supports 58mm / 80mm Bluetooth thermal printers (TVS, Epson, XPrinter,
 * Rongta, Sunmi, generic dairy printers).
 *
 * IMPORTANT: native Bluetooth modules are NOT available in Expo Go.
 * Bluetooth printing only works inside an EAS dev client / production APK.
 */

// Detect Expo Go — native Bluetooth modules are unavailable there.
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
// Production / standalone APK detection (informational only)
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
    printData: (data: Uint8Array) => Promise<boolean>;
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

// Lazy-load native module — guarded so web / Expo Go do not crash at import time.
let BLEPrinter: any = null;
try {
    if (Platform.OS !== 'web' && !IS_EXPO_GO) {
        const mod = require('react-native-thermal-receipt-printer-image-qr');
        BLEPrinter = mod.BLEPrinter || mod.default?.BLEPrinter || null;
    }
} catch {
    BLEPrinter = null;
}

const formatDeviceName = (raw: string | undefined, mac: string): string => {
    const name = (raw || '').trim();
    if (name.length > 0) return name;
    const suffix = mac ? mac.slice(-4).toUpperCase() : 'UNKNOWN';
    return `Thermal Printer ${suffix}`;
};

function useBluetoothPrinterController(): BluetoothPrinterContextValue {
    const [state, setState] = useState<BluetoothPrinterState>(initialState);

    const initializedRef = useRef(false);
    const connectedMacRef = useRef<string | null>(null);
    const autoConnectAttemptedRef = useRef(false);
    const permissionsGrantedRef = useRef(false);

    // ---------------- Permissions ----------------
    const requestPermissions = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === 'web') {
            setState(prev => ({ ...prev, error: 'Bluetooth printing is not available on web.' }));
            return false;
        }

        if (Platform.OS === 'ios') {
            permissionsGrantedRef.current = true;
            return true;
        }

        try {
            const apiLevel = typeof Platform.Version === 'number'
                ? Platform.Version
                : Number(Platform.Version);

            if (apiLevel >= 31) {
                // Android 12+
                const results = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);

                const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]
                    === PermissionsAndroid.RESULTS.GRANTED;
                const connectGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
                    === PermissionsAndroid.RESULTS.GRANTED;

                if (!scanGranted || !connectGranted) {
                    setState(prev => ({
                        ...prev,
                        error: 'Bluetooth scan/connect permission denied. Please allow Bluetooth access in Settings.',
                    }));
                    return false;
                }
            } else {
                // Android < 12 needs location for BT scan
                const result = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                );
                if (result !== PermissionsAndroid.RESULTS.GRANTED) {
                    setState(prev => ({
                        ...prev,
                        error: 'Location permission denied. Older Android devices need it to scan Bluetooth printers.',
                    }));
                    return false;
                }
            }

            permissionsGrantedRef.current = true;
            setState(prev => ({ ...prev, error: null }));
            return true;
        } catch {
            setState(prev => ({ ...prev, error: 'Failed to request Bluetooth permissions.' }));
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

    // ---------------- Init ----------------
    useEffect(() => {
        if (Platform.OS === 'web') {
            setState(prev => ({ ...prev, error: 'Bluetooth printing is not available on web.' }));
            return;
        }

        if (IS_EXPO_GO) {
            console.warn('[BluetoothPrinter] Expo Go detected — native printer modules unavailable. Use an EAS dev / production build.');
            setState(prev => ({
                ...prev,
                error: 'Bluetooth printing requires a production APK or EAS dev build. It does NOT work in Expo Go.',
            }));
            return;
        }

        if (!BLEPrinter) {
            setState(prev => ({
                ...prev,
                error: 'Bluetooth printer module not installed. Rebuild the app with EAS Build.',
            }));
            return;
        }

        let cancelled = false;

        (async () => {
            const granted = await requestPermissions();
            if (!granted || cancelled) return;

            try {
                await BLEPrinter.init();
                if (cancelled) return;
                initializedRef.current = true;
                setState(prev => ({ ...prev, isBluetoothEnabled: true, error: null }));

                if (!autoConnectAttemptedRef.current) {
                    autoConnectAttemptedRef.current = true;
                    const last = await getLastPrinter();
                    if (last && !cancelled) {
                        try {
                            await BLEPrinter.connectPrinter(last.id);
                            connectedMacRef.current = last.id;
                            setState(prev => ({
                                ...prev,
                                isConnected: true,
                                connectedDevice: last,
                                error: null,
                            }));
                        } catch (e: any) {
                            console.warn('[BluetoothPrinter] auto-connect failed:', e?.message || e);
                        }
                    }
                }
            } catch (e: any) {
                console.error('[BluetoothPrinter] init failed:', e);
                setState(prev => ({
                    ...prev,
                    isBluetoothEnabled: false,
                    error: e?.message || 'Failed to initialize Bluetooth. Please enable Bluetooth and try again.',
                }));
            }
        })();

        return () => {
            cancelled = true;
            try { BLEPrinter?.closeConn?.(); } catch { /* ignore */ }
        };
    }, [getLastPrinter, requestPermissions]);

    // ---------------- Scan ----------------
    const stopScan = useCallback(() => {
        // The library does a one-shot getDeviceList; nothing async to cancel.
        setState(prev => ({ ...prev, isScanning: false }));
    }, []);

    const startScan = useCallback(async () => {
        if (state.isScanning) return;

        if (IS_EXPO_GO || !BLEPrinter) {
            setState(prev => ({
                ...prev,
                error: 'Bluetooth printing requires a production APK (EAS build).',
            }));
            return;
        }

        const granted = permissionsGrantedRef.current || await requestPermissions();
        if (!granted) return;

        setState(prev => ({ ...prev, isScanning: true, availableDevices: [], error: null }));

        try {
            if (!initializedRef.current) {
                await BLEPrinter.init();
                initializedRef.current = true;
            }

            const list: { device_name: string; inner_mac_address: string }[] =
                await BLEPrinter.getDeviceList();

            const devices: BluetoothDevice[] = (list || [])
                .filter(d => !!d?.inner_mac_address)
                .map(d => ({
                    id: d.inner_mac_address,
                    name: formatDeviceName(d.device_name, d.inner_mac_address),
                    kind: 'ble' as const,
                }));

            const isPrinterLike = (n: string) =>
                /print|pos|thermal|rpp|mtp|btp|hm|spp|escpos|srs|tm-|tvs|xprinter|rongta|sunmi|epson/i.test(n);

            devices.sort((a, b) => {
                const ap = isPrinterLike(a.name) ? 1 : 0;
                const bp = isPrinterLike(b.name) ? 1 : 0;
                return bp - ap;
            });

            setState(prev => ({
                ...prev,
                availableDevices: devices,
                isScanning: false,
                isBluetoothEnabled: true,
                error: devices.length === 0
                    ? 'No paired Bluetooth printers found. Pair your printer in Android Bluetooth settings, then try again.'
                    : null,
            }));
        } catch (e: any) {
            console.warn('[BluetoothPrinter] scan failed:', e?.message || e);
            setState(prev => ({
                ...prev,
                isScanning: false,
                error: e?.message || 'Bluetooth scan failed. Please make sure Bluetooth is on.',
            }));
        }
    }, [requestPermissions, state.isScanning]);

    // ---------------- Connect / Disconnect ----------------
    const connectToDevice = useCallback(async (device: BluetoothDevice) => {
        if (!BLEPrinter) {
            setState(prev => ({ ...prev, error: 'Printer module unavailable. Build the app with EAS.' }));
            return;
        }
        stopScan();
        setState(prev => ({ ...prev, error: null }));

        try {
            await BLEPrinter.connectPrinter(device.id);
            connectedMacRef.current = device.id;
            const info: BluetoothDevice = { id: device.id, name: device.name, kind: 'ble' };
            setState(prev => ({
                ...prev,
                isConnected: true,
                connectedDevice: info,
                error: null,
            }));
            await saveLastPrinter(info);
        } catch (e: any) {
            console.warn('[BluetoothPrinter] connect failed:', e?.message || e);
            connectedMacRef.current = null;
            setState(prev => ({
                ...prev,
                isConnected: false,
                connectedDevice: null,
                error: e?.message || 'Failed to connect. Make sure the printer is on and paired in Android settings.',
            }));
        }
    }, [saveLastPrinter, stopScan]);

    const disconnectDevice = useCallback(async () => {
        try { await BLEPrinter?.closeConn?.(); } catch { /* ignore */ }
        connectedMacRef.current = null;
        setState(prev => ({
            ...prev,
            isConnected: false,
            connectedDevice: null,
        }));
    }, []);

    // ---------------- Print ----------------
    const ensureConnected = useCallback(async (): Promise<boolean> => {
        if (!BLEPrinter) {
            setState(prev => ({ ...prev, error: 'Printer module unavailable. Build the app with EAS.' }));
            return false;
        }
        const granted = permissionsGrantedRef.current || await requestPermissions();
        if (!granted) return false;

        if (connectedMacRef.current) return true;

        const last = await getLastPrinter();
        if (!last) {
            setState(prev => ({
                ...prev,
                error: 'No printer selected. Open the Bluetooth printer panel and connect a printer first.',
            }));
            return false;
        }

        try {
            await BLEPrinter.connectPrinter(last.id);
            connectedMacRef.current = last.id;
            setState(prev => ({
                ...prev,
                isConnected: true,
                connectedDevice: last,
                error: null,
            }));
            return true;
        } catch (e: any) {
            setState(prev => ({
                ...prev,
                error: e?.message || 'Could not reconnect to the printer.',
            }));
            return false;
        }
    }, [getLastPrinter, requestPermissions]);

    const printData = useCallback(async (data: Uint8Array): Promise<boolean> => {
        setState(prev => ({ ...prev, isPrinting: true, error: null }));

        const ready = await ensureConnected();
        if (!ready) {
            setState(prev => ({ ...prev, isPrinting: false }));
            return false;
        }

        try {
            // The library accepts raw ESC/POS bytes as a base64 string via printRaw().
            const base64 = bytesToBase64(data);
            await BLEPrinter.printRaw(base64);
            setState(prev => ({ ...prev, isPrinting: false, error: null }));
            return true;
        } catch (e: any) {
            console.warn('[BluetoothPrinter] print failed:', e?.message || e);
            // Reset connection so the next attempt reconnects from scratch.
            connectedMacRef.current = null;
            setState(prev => ({
                ...prev,
                isPrinting: false,
                isConnected: false,
                connectedDevice: null,
                error: e?.message || 'Print failed. Reconnect the thermal printer and try again.',
            }));
            return false;
        }
    }, [ensureConnected]);

    return {
        ...state,
        requestPermissions,
        startScan,
        stopScan,
        connectToDevice,
        disconnectDevice,
        printData,
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
