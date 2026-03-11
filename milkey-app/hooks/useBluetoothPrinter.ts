import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

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
}

let BleManager: any = null;

// Try to load react-native-ble-plx if available
try {
    if (Platform.OS !== 'web') {
        BleManager = require('react-native-ble-plx').BleManager;
    }
} catch (e) {
    // BLE library not available
}

export const useBluetoothPrinter = () => {
    const [state, setState] = useState<BluetoothPrinterState>({
        isScanning: false,
        isConnected: false,
        connectedDevice: null,
        availableDevices: [],
        error: null,
        isBluetoothEnabled: false,
    });

    const managerRef = useRef<any>(null);
    const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (Platform.OS === 'web') {
            setState(prev => ({ ...prev, error: 'Bluetooth not available on web' }));
            return;
        }

        if (BleManager) {
            try {
                managerRef.current = new BleManager();

                // Listen for Bluetooth state changes
                const subscription = managerRef.current.onStateChange((bleState: string) => {
                    const enabled = bleState === 'PoweredOn';
                    setState(prev => ({ ...prev, isBluetoothEnabled: enabled }));
                    if (!enabled) {
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

    const startScan = useCallback(() => {
        if (!managerRef.current || state.isScanning) return;

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
                // Filter for common printer names
                const name = device.name.toLowerCase();
                const isPrinter = name.includes('printer') ||
                    name.includes('print') ||
                    name.includes('pos') ||
                    name.includes('thermal') ||
                    name.includes('bt-') ||
                    name.includes('spp') ||
                    name.includes('star') ||
                    name.includes('epson') ||
                    name.includes('zebra') ||
                    name.includes('bixolon') ||
                    name.includes('brother');

                if (isPrinter || !foundDevices.size) {
                    // Show printers first, but also show other devices
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
            }
        });

        // Stop scan after 10 seconds
        scanTimeoutRef.current = setTimeout(() => {
            stopScan();
        }, 10000);
    }, [state.isScanning]);

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

            const connectedDevice = await managerRef.current.connectToDevice(device.id);
            await connectedDevice.discoverAllServicesAndCharacteristics();

            // Listen for disconnection
            connectedDevice.onDisconnected(() => {
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
            setState(prev => ({
                ...prev,
                error: e.message || 'Connection failed',
                isConnected: false,
                connectedDevice: null,
            }));
        }
    }, [stopScan]);

    const disconnectDevice = useCallback(async () => {
        if (!managerRef.current || !state.connectedDevice) return;

        try {
            await managerRef.current.cancelDeviceConnection(state.connectedDevice.id);
            setState(prev => ({
                ...prev,
                isConnected: false,
                connectedDevice: null,
            }));
        } catch (e: any) {
            setState(prev => ({ ...prev, error: e.message || 'Disconnect failed' }));
        }
    }, [state.connectedDevice]);

    return {
        ...state,
        startScan,
        stopScan,
        connectToDevice,
        disconnectDevice,
    };
};
