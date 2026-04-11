import { useState, useEffect, useCallback, useRef } from 'react';
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

const LAST_PRINTER_KEY = '@milkey_last_printer';

// Common BLE printer service/characteristic UUIDs
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

let BleManager: any = null;

try {
    if (Platform.OS !== 'web') {
        BleManager = require('react-native-ble-plx').BleManager;
    }
} catch (e) {
    // BLE library not available
}

const BLE_CHUNK_SIZE = 20;

export const useBluetoothPrinter = () => {
    const [state, setState] = useState<BluetoothPrinterState>({
        isScanning: false,
        isConnected: false,
        connectedDevice: null,
        availableDevices: [],
        error: null,
        isBluetoothEnabled: false,
        isPrinting: false,
    });

    const managerRef = useRef<any>(null);
    const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const connectedDeviceRef = useRef<any>(null);
    const writeCharRef = useRef<{ serviceUUID: string; characteristicUUID: string } | null>(null);
    const autoConnectAttemptedRef = useRef(false);
    const permissionsGrantedRef = useRef(false);

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === 'web') return false;
        if (Platform.OS === 'ios') {
            permissionsGrantedRef.current = true;
            return true;
        }

        try {
            const apiLevel = Platform.Version;
            if (typeof apiLevel === 'number' && apiLevel >= 31) {
                const results = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
                ]);
                const allGranted = Object.values(results).every(
                    (r) => r === PermissionsAndroid.RESULTS.GRANTED
                );
                if (!allGranted) {
                    setState(prev => ({ ...prev, error: 'Bluetooth permissions denied. Please grant permissions in Settings.' }));
                    return false;
                }
                permissionsGrantedRef.current = true;
                return true;
            } else {
                const results = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
                ]);
                const allGranted = Object.values(results).every(
                    (r) => r === PermissionsAndroid.RESULTS.GRANTED
                );
                if (!allGranted) {
                    setState(prev => ({ ...prev, error: 'Location permission denied. Required for Bluetooth scanning.' }));
                    return false;
                }
                permissionsGrantedRef.current = true;
                return true;
            }
        } catch (e) {
            setState(prev => ({ ...prev, error: 'Failed to request permissions' }));
            return false;
        }
    }, []);

    const saveLastPrinter = useCallback(async (device: BluetoothDevice) => {
        try {
            await AsyncStorage.setItem(LAST_PRINTER_KEY, JSON.stringify(device));
        } catch (e) {
            // ignore
        }
    }, []);

    const getLastPrinter = useCallback(async (): Promise<BluetoothDevice | null> => {
        try {
            const data = await AsyncStorage.getItem(LAST_PRINTER_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }, []);

    const discoverPrintCharacteristic = useCallback(async (device: any): Promise<boolean> => {
        try {
            const services = await device.services();
            for (const service of services) {
                const serviceUUID = service.uuid.toUpperCase();
                const chars = await service.characteristics();

                for (const char of chars) {
                    const charUUID = char.uuid.toUpperCase();
                    const isWritable = char.isWritableWithResponse || char.isWritableWithoutResponse;

                    if (isWritable) {
                        const isKnownService = PRINTER_SERVICE_UUIDS.some(
                            s => serviceUUID.includes(s.toUpperCase())
                        );
                        const isKnownChar = PRINTER_WRITE_CHAR_UUIDS.some(
                            c => charUUID.includes(c.toUpperCase())
                        );

                        if (isKnownService || isKnownChar) {
                            writeCharRef.current = {
                                serviceUUID: service.uuid,
                                characteristicUUID: char.uuid,
                            };
                            return true;
                        }
                    }
                }

                for (const char of chars) {
                    const isWritable = char.isWritableWithResponse || char.isWritableWithoutResponse;
                    if (isWritable) {
                        writeCharRef.current = {
                            serviceUUID: service.uuid,
                            characteristicUUID: char.uuid,
                        };
                        return true;
                    }
                }
            }
            return false;
        } catch (e) {
            console.warn('Failed to discover print characteristic:', e);
            return false;
        }
    }, []);

    const connectToDeviceById = useCallback(async (deviceId: string, deviceName: string): Promise<boolean> => {
        if (!managerRef.current) return false;

        try {
            // Check if already connected
            const isAlreadyConnected = await managerRef.current.isDeviceConnected(deviceId);
            let nativeDevice;

            if (isAlreadyConnected) {
                nativeDevice = await managerRef.current.devices([deviceId]);
                if (nativeDevice && nativeDevice.length > 0) {
                    nativeDevice = nativeDevice[0];
                    await nativeDevice.discoverAllServicesAndCharacteristics();
                } else {
                    return false;
                }
            } else {
                nativeDevice = await managerRef.current.connectToDevice(deviceId, {
                    timeout: 10000,
                    autoConnect: true,
                });
                await nativeDevice.discoverAllServicesAndCharacteristics();
            }

            connectedDeviceRef.current = nativeDevice;

            const found = await discoverPrintCharacteristic(nativeDevice);
            if (!found) {
                console.warn('No writable characteristic found, printing may not work');
            }

            const deviceInfo: BluetoothDevice = { id: deviceId, name: deviceName || nativeDevice.name || 'Printer' };

            nativeDevice.onDisconnected(() => {
                connectedDeviceRef.current = null;
                writeCharRef.current = null;
                setState(prev => ({
                    ...prev,
                    isConnected: false,
                    connectedDevice: null,
                }));
            });

            setState(prev => ({
                ...prev,
                isConnected: true,
                connectedDevice: deviceInfo,
                error: null,
            }));

            await saveLastPrinter(deviceInfo);
            return true;
        } catch (e: any) {
            console.warn('Auto-connect failed:', e?.message);
            connectedDeviceRef.current = null;
            writeCharRef.current = null;
            return false;
        }
    }, [discoverPrintCharacteristic, saveLastPrinter]);

    // Auto-request permissions and auto-connect on app start
    useEffect(() => {
        if (Platform.OS === 'web') {
            setState(prev => ({ ...prev, error: 'Bluetooth not available on web' }));
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
                setState(prev => ({ ...prev, isBluetoothEnabled: enabled }));

                if (!enabled) {
                    connectedDeviceRef.current = null;
                    writeCharRef.current = null;
                    setState(prev => ({
                        ...prev,
                        isConnected: false,
                        connectedDevice: null,
                        availableDevices: [],
                        isScanning: false,
                    }));
                    return;
                }

                // Auto-request permissions and auto-reconnect when Bluetooth is on
                if (!autoConnectAttemptedRef.current) {
                    autoConnectAttemptedRef.current = true;

                    const hasPermission = await requestPermissions();
                    if (!hasPermission) return;

                    // Try to reconnect to last known printer
                    const lastPrinter = await getLastPrinter();
                    if (lastPrinter) {
                        await connectToDeviceById(lastPrinter.id, lastPrinter.name);
                    }
                }
            }, true);

            return () => {
                subscription?.remove();
                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                managerRef.current?.destroy();
            };
        } catch (e) {
            setState(prev => ({ ...prev, error: 'Failed to initialize Bluetooth' }));
        }
    }, []);

    const startScan = useCallback(async () => {
        if (!managerRef.current || state.isScanning) return;

        const hasPermission = permissionsGrantedRef.current || await requestPermissions();
        if (!hasPermission) return;

        setState(prev => ({
            ...prev,
            isScanning: true,
            availableDevices: [],
            error: null,
        }));

        const foundDevices: Map<string, BluetoothDevice> = new Map();

        managerRef.current.startDeviceScan(null, null, (error: any, device: any) => {
            if (error) {
                setState(prev => ({
                    ...prev,
                    isScanning: false,
                    error: error.message || 'Scan failed',
                }));
                return;
            }

            if (device && device.name) {
                foundDevices.set(device.id, {
                    id: device.id,
                    name: device.name,
                    rssi: device.rssi,
                });

                setState(prev => ({
                    ...prev,
                    availableDevices: Array.from(foundDevices.values()),
                }));
            }
        });

        scanTimeoutRef.current = setTimeout(() => {
            stopScan();
        }, 15000);
    }, [state.isScanning, requestPermissions]);

    const stopScan = useCallback(() => {
        if (managerRef.current) {
            managerRef.current.stopDeviceScan();
        }
        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
        }
        setState(prev => ({ ...prev, isScanning: false }));
    }, []);

    const connectToDevice = useCallback(async (device: BluetoothDevice) => {
        if (!managerRef.current) return;

        try {
            stopScan();
            setState(prev => ({ ...prev, error: null }));

            const success = await connectToDeviceById(device.id, device.name);
            if (!success) {
                setState(prev => ({
                    ...prev,
                    error: 'Connection failed. Please try again.',
                    isConnected: false,
                    connectedDevice: null,
                }));
            }
        } catch (e: any) {
            connectedDeviceRef.current = null;
            writeCharRef.current = null;
            setState(prev => ({
                ...prev,
                error: e.message || 'Connection failed',
                isConnected: false,
                connectedDevice: null,
            }));
        }
    }, [stopScan, connectToDeviceById]);

    const disconnectDevice = useCallback(async () => {
        if (!managerRef.current || !state.connectedDevice) return;

        try {
            await managerRef.current.cancelDeviceConnection(state.connectedDevice.id);
            connectedDeviceRef.current = null;
            writeCharRef.current = null;
            setState(prev => ({
                ...prev,
                isConnected: false,
                connectedDevice: null,
            }));
        } catch (e: any) {
            setState(prev => ({ ...prev, error: e.message || 'Disconnect failed' }));
        }
    }, [state.connectedDevice]);

    /**
     * Try to reconnect to the last known printer before printing
     */
    const ensureConnected = useCallback(async (): Promise<boolean> => {
        // Already connected
        if (connectedDeviceRef.current && writeCharRef.current) {
            // Verify connection is still alive
            try {
                const isConnected = await managerRef.current?.isDeviceConnected(connectedDeviceRef.current.id);
                if (isConnected) return true;
            } catch {
                // Connection lost, try to reconnect
            }
        }

        // Try reconnecting to last printer
        const lastPrinter = await getLastPrinter();
        if (lastPrinter) {
            const success = await connectToDeviceById(lastPrinter.id, lastPrinter.name);
            if (success) return true;
        }

        return false;
    }, [getLastPrinter, connectToDeviceById]);

    /**
     * Send raw ESC/POS bytes to the connected printer via BLE
     * Automatically tries to reconnect if not connected
     */
    const printData = useCallback(async (data: Uint8Array): Promise<boolean> => {
        setState(prev => ({ ...prev, isPrinting: true, error: null }));

        // Try to ensure we're connected
        const connected = await ensureConnected();
        if (!connected || !connectedDeviceRef.current || !writeCharRef.current) {
            setState(prev => ({
                ...prev,
                isPrinting: false,
                error: 'Printer not connected. Please connect a printer from the top bar.',
            }));
            return false;
        }

        try {
            const { serviceUUID, characteristicUUID } = writeCharRef.current;
            const device = connectedDeviceRef.current;

            for (let i = 0; i < data.length; i += BLE_CHUNK_SIZE) {
                const chunk = data.slice(i, Math.min(i + BLE_CHUNK_SIZE, data.length));
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

                if (i + BLE_CHUNK_SIZE < data.length) {
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
            }

            setState(prev => ({ ...prev, isPrinting: false }));
            return true;
        } catch (e: any) {
            setState(prev => ({
                ...prev,
                isPrinting: false,
                error: e.message || 'Print failed. Please reconnect the printer.',
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
};
