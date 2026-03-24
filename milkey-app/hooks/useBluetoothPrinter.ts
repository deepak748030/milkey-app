import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
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

// Common BLE printer service/characteristic UUIDs
const PRINTER_SERVICE_UUIDS = [
    '49535343-FE7D-4AE5-8FA9-9FAFD205E455', // Generic BLE printer (most common)
    '0000FF00-0000-1000-8000-00805F9B34FB', // Some Chinese BLE printers
    '000018F0-0000-1000-8000-00805F9B34FB', // Nordic UART
    'E7810A71-73AE-499D-8C15-FAA9AEF0C3F2', // Some thermal printers
];

const PRINTER_WRITE_CHAR_UUIDS = [
    '49535343-8841-43F4-A8D4-ECBE34729BB3', // Generic BLE printer write
    '0000FF02-0000-1000-8000-00805F9B34FB', // Some Chinese BLE printers
    '00002AF1-0000-1000-8000-00805F9B34FB', // Nordic UART TX
    'BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F', // Some thermal printers
];

let BleManager: any = null;

try {
    if (Platform.OS !== 'web') {
        BleManager = require('react-native-ble-plx').BleManager;
    }
} catch (e) {
    // BLE library not available
}

// Max bytes per BLE write (most printers support 20, some up to 512)
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
    const connectedDeviceRef = useRef<any>(null); // native BLE device object
    const writeCharRef = useRef<{ serviceUUID: string; characteristicUUID: string } | null>(null);

    useEffect(() => {
        if (Platform.OS === 'web') {
            setState(prev => ({ ...prev, error: 'Bluetooth not available on web' }));
            return;
        }

        if (BleManager) {
            try {
                managerRef.current = new BleManager();

                const subscription = managerRef.current.onStateChange((bleState: string) => {
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
        } else {
            setState(prev => ({ ...prev, error: 'Bluetooth library not installed. Install react-native-ble-plx for native BLE support.' }));
        }
    }, []);

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        if (Platform.OS === 'web') return false;
        if (Platform.OS === 'ios') return true;

        try {
            const apiLevel = Platform.Version;
            if (typeof apiLevel === 'number' && apiLevel >= 31) {
                const results = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);
                const allGranted = Object.values(results).every(
                    (r) => r === PermissionsAndroid.RESULTS.GRANTED
                );
                if (!allGranted) {
                    setState(prev => ({ ...prev, error: 'Bluetooth permissions denied. Please grant permissions in Settings.' }));
                    return false;
                }
                return true;
            } else {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: 'Location Permission',
                        message: 'Bluetooth scanning requires location permission.',
                        buttonPositive: 'OK',
                    }
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    setState(prev => ({ ...prev, error: 'Location permission denied. Required for Bluetooth scanning.' }));
                    return false;
                }
                return true;
            }
        } catch (e) {
            setState(prev => ({ ...prev, error: 'Failed to request permissions' }));
            return false;
        }
    }, []);

    const startScan = useCallback(async () => {
        if (!managerRef.current || state.isScanning) return;

        const hasPermission = await requestPermissions();
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
                // Show ALL named devices so user can find their printer
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
        }, 15000); // 15 seconds scan
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

    /**
     * After connecting, discover the writable characteristic for ESC/POS printing
     */
    const discoverPrintCharacteristic = useCallback(async (device: any): Promise<boolean> => {
        try {
            const services = await device.services();
            for (const service of services) {
                const serviceUUID = service.uuid.toUpperCase();
                const chars = await service.characteristics();

                for (const char of chars) {
                    const charUUID = char.uuid.toUpperCase();
                    // Check if this characteristic is writable
                    const isWritable = char.isWritableWithResponse || char.isWritableWithoutResponse;

                    if (isWritable) {
                        // Check known printer UUIDs first
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

                // If no known UUID matched, use the first writable characteristic
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

    const connectToDevice = useCallback(async (device: BluetoothDevice) => {
        if (!managerRef.current) return;

        try {
            stopScan();
            setState(prev => ({ ...prev, error: null }));

            const nativeDevice = await managerRef.current.connectToDevice(device.id);
            await nativeDevice.discoverAllServicesAndCharacteristics();

            connectedDeviceRef.current = nativeDevice;

            // Discover the writable characteristic for printing
            const found = await discoverPrintCharacteristic(nativeDevice);
            if (!found) {
                console.warn('No writable characteristic found, printing may not work');
            }

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
                connectedDevice: device,
            }));
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
    }, [stopScan, discoverPrintCharacteristic]);

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
     * Send raw ESC/POS bytes to the connected printer via BLE
     * Splits data into chunks since BLE has MTU limits
     */
    const printData = useCallback(async (data: Uint8Array): Promise<boolean> => {
        if (!connectedDeviceRef.current || !writeCharRef.current) {
            setState(prev => ({ ...prev, error: 'Printer not connected or characteristic not found' }));
            return false;
        }

        setState(prev => ({ ...prev, isPrinting: true, error: null }));

        try {
            const { serviceUUID, characteristicUUID } = writeCharRef.current;
            const device = connectedDeviceRef.current;

            // Send data in chunks
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
                    // Try without response if with-response fails
                    await device.writeCharacteristicWithoutResponseForService(
                        serviceUUID,
                        characteristicUUID,
                        base64Chunk
                    );
                }

                // Small delay between chunks to avoid overwhelming the printer
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
                error: e.message || 'Print failed',
            }));
            return false;
        }
    }, []);

    return {
        ...state,
        startScan,
        stopScan,
        connectToDevice,
        disconnectDevice,
        printData,
    };
};
