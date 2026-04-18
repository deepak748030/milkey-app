import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bytesToBase64 } from '@/lib/escpos';

// Detect Expo Go — native Bluetooth modules are NOT available there.
// Bluetooth printing only works in a custom dev build or production APK (EAS build).
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type PrinterKind = 'ble' | 'classic';

export interface BluetoothDevice {
    id: string;
    name: string;
    rssi?: number;
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
const BLE_CHUNK_SIZE = 20;
const CLASSIC_CHUNK_SIZE = 180;

const PRINTER_SERVICE_UUIDS = [
    '49535343-FE7D-4AE5-8FA9-9FAFD205E455',
    '0000FF00-0000-1000-8000-00805F9B34FB',
    '000018F0-0000-1000-8000-00805F9B34FB',
    'E7810A71-73AE-499D-8C15-FAA9AEF0C3F2',
];

const PRINTER_WRITE_CHAR_UUIDS = [
    '49535343-8841-43F4-A8D4-ECBE34729BB3',
    '0000FF02-0000-1000-8000-00805F9B34FB',
    '00002AF1-0000-1000-8000-00805F9B34FB',
    'BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F',
];

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

// Lazy-load native modules — guarded so web/Expo Go does not crash
let BleManager: any = null;
let BluetoothManager: any = null; // tp-react-native-bluetooth-printer (Classic SPP)

try {
    if (Platform.OS !== 'web') {
        BleManager = require('react-native-ble-plx').BleManager;
    }
} catch {
    BleManager = null;
}

try {
    if (Platform.OS !== 'web') {
        // tp-react-native-bluetooth-printer exposes BluetoothManager + BluetoothEscposPrinter
        const tp = require('tp-react-native-bluetooth-printer');
        BluetoothManager = tp.BluetoothManager || tp.default?.BluetoothManager || null;
    }
} catch {
    BluetoothManager = null;
}

const normalizeUuid = (uuid?: string | null) => (uuid || '').replace(/-/g, '').toUpperCase();

const formatDeviceName = (device: any): string => {
    const resolvedName = device?.name || device?.localName;
    if (resolvedName && String(resolvedName).trim().length > 0) {
        return String(resolvedName).trim();
    }

    const suffix = typeof device?.id === 'string' ? device.id.slice(-4).toUpperCase() : 'UNKNOWN';
    return `Thermal Printer ${suffix}`;
};

function useBluetoothPrinterController(): BluetoothPrinterContextValue {
    const [state, setState] = useState<BluetoothPrinterState>(initialState);

    const managerRef = useRef<any>(null);
    const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const connectedDeviceRef = useRef<any>(null); // BLE native device
    const connectedKindRef = useRef<PrinterKind | null>(null);
    const classicConnectedAddrRef = useRef<string | null>(null);
    const disconnectSubscriptionRef = useRef<{ remove?: () => void } | null>(null);
    const writeCharRef = useRef<{ serviceUUID: string; characteristicUUID: string } | null>(null);
    const autoConnectAttemptedRef = useRef(false);
    const permissionsGrantedRef = useRef(false);

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
            const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);

            if (apiLevel >= 31) {
                const results = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);

                const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
                const connectGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;

                if (!scanGranted || !connectGranted) {
                    setState(prev => ({
                        ...prev,
                        error: 'Bluetooth scan/connect permission denied. Please allow Bluetooth access in Settings.',
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

    const saveLastPrinter = useCallback(async (device: BluetoothDevice) => {
        try {
            await AsyncStorage.setItem(LAST_PRINTER_KEY, JSON.stringify(device));
        } catch {
            // ignore
        }
    }, []);

    const getLastPrinter = useCallback(async (): Promise<BluetoothDevice | null> => {
        try {
            const data = await AsyncStorage.getItem(LAST_PRINTER_KEY);
            if (!data) return null;
            const parsed = JSON.parse(data);
            // Backward compatibility: old saved devices had no `kind`
            if (!parsed.kind) parsed.kind = 'ble';
            return parsed;
        } catch {
            return null;
        }
    }, []);

    const clearActiveConnection = useCallback(() => {
        disconnectSubscriptionRef.current?.remove?.();
        disconnectSubscriptionRef.current = null;
        connectedDeviceRef.current = null;
        classicConnectedAddrRef.current = null;
        connectedKindRef.current = null;
        writeCharRef.current = null;
        setState(prev => ({
            ...prev,
            isConnected: false,
            connectedDevice: null,
        }));
    }, []);

    const discoverPrintCharacteristic = useCallback(async (device: any): Promise<boolean> => {
        try {
            const services = await device.services();

            for (const service of services) {
                const chars = await service.characteristics();
                const normalizedService = normalizeUuid(service.uuid);

                for (const char of chars) {
                    const normalizedChar = normalizeUuid(char.uuid);
                    const isWritable = char.isWritableWithResponse || char.isWritableWithoutResponse;
                    if (!isWritable) continue;

                    const isKnownService = PRINTER_SERVICE_UUIDS.some(uuid => normalizedService.includes(normalizeUuid(uuid)));
                    const isKnownChar = PRINTER_WRITE_CHAR_UUIDS.some(uuid => normalizedChar.includes(normalizeUuid(uuid)));

                    if (isKnownService || isKnownChar) {
                        writeCharRef.current = { serviceUUID: service.uuid, characteristicUUID: char.uuid };
                        return true;
                    }
                }
            }

            for (const service of services) {
                const chars = await service.characteristics();
                for (const char of chars) {
                    const isWritable = char.isWritableWithResponse || char.isWritableWithoutResponse;
                    if (!isWritable) continue;
                    writeCharRef.current = { serviceUUID: service.uuid, characteristicUUID: char.uuid };
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.warn('Failed to discover print characteristic:', error);
            return false;
        }
    }, []);

    // ---------------- BLE connect ----------------
    const connectBleDeviceById = useCallback(async (deviceId: string, fallbackName?: string): Promise<boolean> => {
        if (!managerRef.current) return false;

        try {
            let nativeDevice;
            try {
                const isAlreadyConnected = await managerRef.current.isDeviceConnected(deviceId);
                if (isAlreadyConnected) {
                    const connectedDevices = await managerRef.current.devices([deviceId]);
                    nativeDevice = connectedDevices?.[0];
                }
            } catch {
                nativeDevice = null;
            }

            if (!nativeDevice) {
                nativeDevice = await managerRef.current.connectToDevice(deviceId, { timeout: 15000, autoConnect: false });
            }

            try {
                if (Platform.OS === 'android' && typeof nativeDevice.requestMTU === 'function') {
                    const mtuDevice = await nativeDevice.requestMTU(247);
                    console.log('[ble-printer] MTU:', mtuDevice?.mtu);
                }
            } catch (mtuErr) {
                console.warn('[ble-printer] MTU request failed:', mtuErr);
            }

            await nativeDevice.discoverAllServicesAndCharacteristics();

            const found = await discoverPrintCharacteristic(nativeDevice);
            if (!found) {
                setState(prev => ({
                    ...prev,
                    error: 'Connected via BLE but no writable printer characteristic was found. Try connecting as a Classic (SPP) printer instead.',
                }));
                return false;
            }

            connectedDeviceRef.current = nativeDevice;
            connectedKindRef.current = 'ble';
            disconnectSubscriptionRef.current?.remove?.();
            disconnectSubscriptionRef.current = nativeDevice.onDisconnected(() => {
                console.log('[ble-printer] disconnected:', deviceId);
                clearActiveConnection();
            });

            const deviceInfo: BluetoothDevice = {
                id: deviceId,
                name: fallbackName || formatDeviceName(nativeDevice),
                rssi: nativeDevice.rssi,
                kind: 'ble',
            };

            setState(prev => ({ ...prev, isConnected: true, connectedDevice: deviceInfo, error: null }));
            await saveLastPrinter(deviceInfo);
            return true;
        } catch (error: any) {
            console.warn('[ble-printer] connection failed:', error?.message || error);
            clearActiveConnection();
            setState(prev => ({ ...prev, error: error?.message || 'Failed to connect to BLE printer.' }));
            return false;
        }
    }, [clearActiveConnection, discoverPrintCharacteristic, saveLastPrinter]);

    // ---------------- Classic (SPP) connect ----------------
    const connectClassicDevice = useCallback(async (deviceId: string, fallbackName?: string): Promise<boolean> => {
        if (!BluetoothManager) {
            setState(prev => ({ ...prev, error: 'Classic Bluetooth library not available. Rebuild the app with EAS Build.' }));
            return false;
        }
        try {
            await BluetoothManager.connect(deviceId);
            classicConnectedAddrRef.current = deviceId;
            connectedKindRef.current = 'classic';

            const deviceInfo: BluetoothDevice = {
                id: deviceId,
                name: fallbackName || `Classic Printer ${deviceId.slice(-4)}`,
                kind: 'classic',
            };

            setState(prev => ({ ...prev, isConnected: true, connectedDevice: deviceInfo, error: null }));
            await saveLastPrinter(deviceInfo);
            console.log('[classic-printer] connected:', deviceId);
            return true;
        } catch (error: any) {
            console.warn('[classic-printer] connection failed:', error?.message || error);
            clearActiveConnection();
            setState(prev => ({ ...prev, error: error?.message || 'Failed to connect to Classic printer. Make sure it is paired in Android Bluetooth settings first.' }));
            return false;
        }
    }, [clearActiveConnection, saveLastPrinter]);

    const connectToDeviceById = useCallback(async (device: BluetoothDevice): Promise<boolean> => {
        if (device.kind === 'classic') return connectClassicDevice(device.id, device.name);
        return connectBleDeviceById(device.id, device.name);
    }, [connectBleDeviceById, connectClassicDevice]);

    // ---------------- Init ----------------
    useEffect(() => {
        if (Platform.OS === 'web') {
            setState(prev => ({ ...prev, error: 'Bluetooth printing is not available on web.' }));
            return;
        }

        if (IS_EXPO_GO) {
            console.warn('[BluetoothPrinter] Running in Expo Go — native Bluetooth modules are unavailable. Use an EAS dev build or production APK.');
            setState(prev => ({
                ...prev,
                error: 'Bluetooth printing requires a production APK (EAS build). It does NOT work in Expo Go. Build the APK to test printing.',
            }));
            return;
        }

        if (!BleManager) {
            setState(prev => ({ ...prev, error: 'Bluetooth library not installed. Run an EAS build.' }));
            return;
        }

        try {
            managerRef.current = new BleManager();

            const subscription = managerRef.current.onStateChange(async (bleState: string) => {
                const enabled = bleState === 'PoweredOn';
                setState(prev => ({
                    ...prev,
                    isBluetoothEnabled: enabled,
                    error: enabled ? prev.error : 'Bluetooth is turned off. Please enable Bluetooth to print.',
                }));

                if (!enabled) {
                    if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
                    managerRef.current?.stopDeviceScan();
                    clearActiveConnection();
                    setState(prev => ({ ...prev, availableDevices: [], isScanning: false }));
                    return;
                }

                if (!autoConnectAttemptedRef.current) {
                    autoConnectAttemptedRef.current = true;
                    const hasPermission = await requestPermissions();
                    if (!hasPermission) return;

                    const lastPrinter = await getLastPrinter();
                    if (lastPrinter) {
                        await connectToDeviceById(lastPrinter);
                    }
                }
            }, true);

            return () => {
                subscription?.remove();
                disconnectSubscriptionRef.current?.remove?.();
                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                managerRef.current?.stopDeviceScan?.();
                managerRef.current?.destroy();
                managerRef.current = null;
            };
        } catch (e) {
            console.error('[BluetoothPrinter] Failed to initialize BleManager:', e);
            setState(prev => ({ ...prev, error: 'Failed to initialize Bluetooth. Make sure you are running an EAS build (not Expo Go).' }));
        }
    }, [clearActiveConnection, connectToDeviceById, getLastPrinter, requestPermissions]);

    const stopScan = useCallback(() => {
        managerRef.current?.stopDeviceScan?.();
        try { BluetoothManager?.stopScan?.(); } catch { /* ignore */ }
        if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
        setState(prev => ({ ...prev, isScanning: false }));
    }, []);

    const startScan = useCallback(async () => {
        if (!managerRef.current || state.isScanning) return;

        if (!state.isBluetoothEnabled) {
            setState(prev => ({ ...prev, error: 'Turn on Bluetooth first, then scan for your thermal printer.' }));
            return;
        }

        const hasPermission = permissionsGrantedRef.current || await requestPermissions();
        if (!hasPermission) return;

        setState(prev => ({ ...prev, isScanning: true, availableDevices: [], error: null }));

        const foundDevices = new Map<string, BluetoothDevice>();
        const isPrinterLike = (n: string) => /print|pos|thermal|rpp|mtp|btp|hm|spp|escpos|srs|tm-/i.test(n);

        const updateList = () => {
            setState(prev => ({
                ...prev,
                availableDevices: Array.from(foundDevices.values()).sort((a, b) => {
                    const ap = isPrinterLike(a.name) ? 1 : 0;
                    const bp = isPrinterLike(b.name) ? 1 : 0;
                    if (ap !== bp) return bp - ap;
                    return (b.rssi || -999) - (a.rssi || -999);
                }),
            }));
        };

        // 1) BLE scan
        managerRef.current.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
            if (error) {
                stopScan();
                setState(prev => ({ ...prev, error: error.message || 'Bluetooth scan failed.' }));
                return;
            }
            if (!device?.id) return;
            foundDevices.set(device.id, {
                id: device.id,
                name: formatDeviceName(device),
                rssi: device.rssi,
                kind: 'ble',
            });
            updateList();
        });

        // 2) Classic (SPP) — list paired devices and start discovery for unpaired
        if (BluetoothManager) {
            try {
                const result: any = await BluetoothManager.enableBluetooth();
                // result may be array of paired device JSON strings, or undefined
                const parsePaired = (raw: any) => {
                    if (!raw) return [];
                    if (Array.isArray(raw)) {
                        return raw.map((d: any) => {
                            try { return typeof d === 'string' ? JSON.parse(d) : d; } catch { return null; }
                        }).filter(Boolean);
                    }
                    return [];
                };
                parsePaired(result).forEach((d: any) => {
                    const addr = d.address || d.id;
                    if (!addr) return;
                    const key = `classic:${addr}`;
                    foundDevices.set(key, {
                        id: addr,
                        name: (d.name || `Paired Printer ${addr.slice(-4)}`) + ' (Paired)',
                        kind: 'classic',
                    });
                });

                // Also fetch via scanDevices for already-paired devices
                try {
                    const scanRes: any = await BluetoothManager.scanDevices();
                    const obj = typeof scanRes === 'string' ? JSON.parse(scanRes) : scanRes;
                    const paired = obj?.paired || [];
                    const found = obj?.found || [];
                    [...paired, ...found].forEach((d: any) => {
                        const addr = d.address || d.id;
                        if (!addr) return;
                        const key = `classic:${addr}`;
                        if (foundDevices.has(key)) return;
                        foundDevices.set(key, {
                            id: addr,
                            name: d.name || `Classic ${addr.slice(-4)}`,
                            kind: 'classic',
                        });
                    });
                } catch (scanErr) {
                    console.warn('[classic-printer] scanDevices failed:', scanErr);
                }
                updateList();
            } catch (clsErr) {
                console.warn('[classic-printer] enable/scan failed:', clsErr);
            }
        }

        scanTimeoutRef.current = setTimeout(() => { stopScan(); }, 15000);
    }, [requestPermissions, state.isBluetoothEnabled, state.isScanning, stopScan]);

    const connectToDevice = useCallback(async (device: BluetoothDevice) => {
        stopScan();
        setState(prev => ({ ...prev, error: null }));
        const ok = await connectToDeviceById(device);
        if (!ok) {
            setState(prev => ({ ...prev, isConnected: false, connectedDevice: null }));
        }
    }, [connectToDeviceById, stopScan]);

    const disconnectDevice = useCallback(async () => {
        try {
            if (connectedKindRef.current === 'classic' && classicConnectedAddrRef.current && BluetoothManager) {
                await BluetoothManager.disconnect(classicConnectedAddrRef.current);
            } else if (connectedKindRef.current === 'ble' && managerRef.current && connectedDeviceRef.current) {
                await managerRef.current.cancelDeviceConnection(connectedDeviceRef.current.id);
            }
        } catch (error: any) {
            setState(prev => ({ ...prev, error: error?.message || 'Failed to disconnect printer.' }));
        } finally {
            clearActiveConnection();
        }
    }, [clearActiveConnection]);

    const ensureConnected = useCallback(async (): Promise<boolean> => {
        if (!managerRef.current) return false;

        const hasPermission = permissionsGrantedRef.current || await requestPermissions();
        if (!hasPermission) return false;

        if (!state.isBluetoothEnabled) {
            setState(prev => ({ ...prev, error: 'Bluetooth is off. Please enable Bluetooth and try again.' }));
            return false;
        }

        // Already connected?
        if (connectedKindRef.current === 'ble' && connectedDeviceRef.current && writeCharRef.current) {
            try {
                const alive = await managerRef.current.isDeviceConnected(connectedDeviceRef.current.id);
                if (alive) return true;
            } catch { /* reconnect below */ }
        }
        if (connectedKindRef.current === 'classic' && classicConnectedAddrRef.current && BluetoothManager) {
            try {
                const alive = await BluetoothManager.isDeviceConnected?.(classicConnectedAddrRef.current);
                if (alive) return true;
            } catch { /* reconnect below */ }
        }

        const lastPrinter = await getLastPrinter();
        if (!lastPrinter) {
            setState(prev => ({ ...prev, error: 'No printer selected. Open the Bluetooth printer panel and connect a printer first.' }));
            return false;
        }

        return connectToDeviceById(lastPrinter);
    }, [connectToDeviceById, getLastPrinter, requestPermissions, state.isBluetoothEnabled]);

    // ---------------- Print ----------------
    const printDataBle = async (data: Uint8Array): Promise<boolean> => {
        if (!connectedDeviceRef.current || !writeCharRef.current) return false;
        const { serviceUUID, characteristicUUID } = writeCharRef.current;
        const device = connectedDeviceRef.current;

        for (let index = 0; index < data.length; index += BLE_CHUNK_SIZE) {
            const chunk = data.slice(index, Math.min(index + BLE_CHUNK_SIZE, data.length));
            const base64Chunk = bytesToBase64(chunk);

            let written = false;
            let lastErr: any = null;
            for (let attempt = 0; attempt < 2 && !written; attempt++) {
                try {
                    await device.writeCharacteristicWithResponseForService(serviceUUID, characteristicUUID, base64Chunk);
                    written = true;
                } catch (e1) {
                    lastErr = e1;
                    try {
                        await device.writeCharacteristicWithoutResponseForService(serviceUUID, characteristicUUID, base64Chunk);
                        written = true;
                    } catch (e2) {
                        lastErr = e2;
                        await new Promise(r => setTimeout(r, 50));
                    }
                }
            }
            if (!written) throw lastErr || new Error('Chunk write failed');

            if (index + BLE_CHUNK_SIZE < data.length) {
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }
        return true;
    };

    const printDataClassic = async (data: Uint8Array): Promise<boolean> => {
        if (!BluetoothManager) throw new Error('Classic Bluetooth library not available.');
        // tp-react-native-bluetooth-printer accepts base64 raw bytes via writeRawDataToPrinter (preferred)
        // Fallback to chunked sendData if writeRaw not present.
        const writeRaw = (BluetoothManager as any).writeRawDataToPrinter;
        if (typeof writeRaw === 'function') {
            const base64All = bytesToBase64(data);
            await writeRaw.call(BluetoothManager, base64All);
            return true;
        }
        const sendData = (BluetoothManager as any).sendData || (BluetoothManager as any).write;
        if (typeof sendData !== 'function') {
            throw new Error('Classic printer write API not found in tp-react-native-bluetooth-printer build.');
        }
        for (let index = 0; index < data.length; index += CLASSIC_CHUNK_SIZE) {
            const chunk = data.slice(index, Math.min(index + CLASSIC_CHUNK_SIZE, data.length));
            await sendData.call(BluetoothManager, bytesToBase64(chunk));
            if (index + CLASSIC_CHUNK_SIZE < data.length) {
                await new Promise(r => setTimeout(r, 20));
            }
        }
        return true;
    };

    const printData = useCallback(async (data: Uint8Array): Promise<boolean> => {
        setState(prev => ({ ...prev, isPrinting: true, error: null }));

        const ready = await ensureConnected();
        if (!ready) {
            setState(prev => ({ ...prev, isPrinting: false }));
            return false;
        }

        try {
            console.log('[printer] sending', data.length, 'bytes via', connectedKindRef.current);
            if (connectedKindRef.current === 'classic') {
                await printDataClassic(data);
            } else {
                await printDataBle(data);
            }
            setState(prev => ({ ...prev, isPrinting: false, error: null }));
            return true;
        } catch (error: any) {
            console.warn('[printer] print failed:', error?.message || error);
            setState(prev => ({
                ...prev,
                isPrinting: false,
                error: error?.message || 'Print failed. Reconnect the thermal printer and try again.',
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
