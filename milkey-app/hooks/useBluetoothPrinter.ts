import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bytesToBase64 } from '@/lib/escpos';

export interface BluetoothDevice {
    id: string;
    name: string;
    rssi?: number;
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

let BleManager: any = null;

try {
    if (Platform.OS !== 'web') {
        BleManager = require('react-native-ble-plx').BleManager;
    }
} catch {
    BleManager = null;
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
    const connectedDeviceRef = useRef<any>(null);
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
            // ignore persistence failures
        }
    }, []);

    const getLastPrinter = useCallback(async (): Promise<BluetoothDevice | null> => {
        try {
            const data = await AsyncStorage.getItem(LAST_PRINTER_KEY);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }, []);

    const clearActiveConnection = useCallback(() => {
        disconnectSubscriptionRef.current?.remove?.();
        disconnectSubscriptionRef.current = null;
        connectedDeviceRef.current = null;
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
                        writeCharRef.current = {
                            serviceUUID: service.uuid,
                            characteristicUUID: char.uuid,
                        };
                        return true;
                    }
                }
            }

            for (const service of services) {
                const chars = await service.characteristics();
                for (const char of chars) {
                    const isWritable = char.isWritableWithResponse || char.isWritableWithoutResponse;
                    if (!isWritable) continue;

                    writeCharRef.current = {
                        serviceUUID: service.uuid,
                        characteristicUUID: char.uuid,
                    };
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.warn('Failed to discover print characteristic:', error);
            return false;
        }
    }, []);

    const connectToDeviceById = useCallback(async (deviceId: string, fallbackName?: string): Promise<boolean> => {
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
                nativeDevice = await managerRef.current.connectToDevice(deviceId, {
                    timeout: 15000,
                    autoConnect: false,
                });
            }

            await nativeDevice.discoverAllServicesAndCharacteristics();

            const foundCharacteristic = await discoverPrintCharacteristic(nativeDevice);
            if (!foundCharacteristic) {
                setState(prev => ({
                    ...prev,
                    error: 'Connected to the device, but no writable printer characteristic was found.',
                }));
                return false;
            }

            connectedDeviceRef.current = nativeDevice;
            disconnectSubscriptionRef.current?.remove?.();
            disconnectSubscriptionRef.current = nativeDevice.onDisconnected(() => {
                clearActiveConnection();
            });

            const deviceInfo: BluetoothDevice = {
                id: deviceId,
                name: fallbackName || formatDeviceName(nativeDevice),
                rssi: nativeDevice.rssi,
            };

            setState(prev => ({
                ...prev,
                isConnected: true,
                connectedDevice: deviceInfo,
                error: null,
            }));

            await saveLastPrinter(deviceInfo);
            return true;
        } catch (error: any) {
            console.warn('Printer connection failed:', error?.message || error);
            clearActiveConnection();
            setState(prev => ({
                ...prev,
                error: error?.message || 'Failed to connect to the printer.',
            }));
            return false;
        }
    }, [clearActiveConnection, discoverPrintCharacteristic, saveLastPrinter]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            setState(prev => ({ ...prev, error: 'Bluetooth printing is not available on web.' }));
            return;
        }

        if (!BleManager) {
            setState(prev => ({ ...prev, error: 'Bluetooth library not installed.' }));
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
                    if (scanTimeoutRef.current) {
                        clearTimeout(scanTimeoutRef.current);
                        scanTimeoutRef.current = null;
                    }
                    managerRef.current?.stopDeviceScan();
                    clearActiveConnection();
                    setState(prev => ({
                        ...prev,
                        availableDevices: [],
                        isScanning: false,
                    }));
                    return;
                }

                if (!autoConnectAttemptedRef.current) {
                    autoConnectAttemptedRef.current = true;
                    const hasPermission = await requestPermissions();
                    if (!hasPermission) return;

                    const lastPrinter = await getLastPrinter();
                    if (lastPrinter) {
                        await connectToDeviceById(lastPrinter.id, lastPrinter.name);
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
        } catch {
            setState(prev => ({ ...prev, error: 'Failed to initialize Bluetooth.' }));
        }
    }, [clearActiveConnection, connectToDeviceById, getLastPrinter, requestPermissions]);

    const stopScan = useCallback(() => {
        managerRef.current?.stopDeviceScan?.();
        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
        }
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

        setState(prev => ({
            ...prev,
            isScanning: true,
            availableDevices: [],
            error: null,
        }));

        const foundDevices = new Map<string, BluetoothDevice>();

        managerRef.current.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
            if (error) {
                stopScan();
                setState(prev => ({
                    ...prev,
                    error: error.message || 'Bluetooth scan failed.',
                }));
                return;
            }

            if (!device?.id) return;

            const deviceName = formatDeviceName(device);
            foundDevices.set(device.id, {
                id: device.id,
                name: deviceName,
                rssi: device.rssi,
            });

            setState(prev => ({
                ...prev,
                availableDevices: Array.from(foundDevices.values()).sort((a, b) => (b.rssi || -999) - (a.rssi || -999)),
            }));
        });

        scanTimeoutRef.current = setTimeout(() => {
            stopScan();
        }, 15000);
    }, [requestPermissions, state.isBluetoothEnabled, state.isScanning, stopScan]);

    const connectToDevice = useCallback(async (device: BluetoothDevice) => {
        stopScan();
        setState(prev => ({ ...prev, error: null }));
        const connected = await connectToDeviceById(device.id, device.name);
        if (!connected) {
            setState(prev => ({
                ...prev,
                isConnected: false,
                connectedDevice: null,
            }));
        }
    }, [connectToDeviceById, stopScan]);

    const disconnectDevice = useCallback(async () => {
        if (!managerRef.current || !connectedDeviceRef.current) {
            clearActiveConnection();
            return;
        }

        try {
            await managerRef.current.cancelDeviceConnection(connectedDeviceRef.current.id);
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                error: error?.message || 'Failed to disconnect printer.',
            }));
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

        if (connectedDeviceRef.current && writeCharRef.current) {
            try {
                const alive = await managerRef.current.isDeviceConnected(connectedDeviceRef.current.id);
                if (alive) {
                    return true;
                }
            } catch {
                // ignore and reconnect below
            }
        }

        const lastPrinter = await getLastPrinter();
        if (!lastPrinter) {
            setState(prev => ({ ...prev, error: 'No printer selected. Open the Bluetooth printer panel and connect a thermal printer first.' }));
            return false;
        }

        return connectToDeviceById(lastPrinter.id, lastPrinter.name);
    }, [connectToDeviceById, getLastPrinter, requestPermissions, state.isBluetoothEnabled]);

    const printData = useCallback(async (data: Uint8Array): Promise<boolean> => {
        setState(prev => ({ ...prev, isPrinting: true, error: null }));

        const ready = await ensureConnected();
        if (!ready || !connectedDeviceRef.current || !writeCharRef.current) {
            setState(prev => ({ ...prev, isPrinting: false }));
            return false;
        }

        try {
            const { serviceUUID, characteristicUUID } = writeCharRef.current;
            const device = connectedDeviceRef.current;

            for (let index = 0; index < data.length; index += BLE_CHUNK_SIZE) {
                const chunk = data.slice(index, Math.min(index + BLE_CHUNK_SIZE, data.length));
                const base64Chunk = bytesToBase64(chunk);

                try {
                    await device.writeCharacteristicWithResponseForService(
                        serviceUUID,
                        characteristicUUID,
                        base64Chunk
                    );
                } catch {
                    await device.writeCharacteristicWithoutResponseForService(
                        serviceUUID,
                        characteristicUUID,
                        base64Chunk
                    );
                }

                if (index + BLE_CHUNK_SIZE < data.length) {
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
            }

            setState(prev => ({ ...prev, isPrinting: false, error: null }));
            return true;
        } catch (error: any) {
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
