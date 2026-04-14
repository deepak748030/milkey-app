import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, FlatList, Linking, Platform } from 'react-native';
import { X, Bluetooth, BluetoothOff, RefreshCw, Unplug, Wifi, Printer, ExternalLink } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { BluetoothDevice } from '@/hooks/useBluetoothPrinter';
import { buildTestPrint } from '@/lib/escpos';
import { printViaBluetoothPrintApp, buildBluetoothPrintTest } from '@/lib/bluetoothPrintApp';

interface PrinterScanSheetProps {
    visible: boolean;
    onClose: () => void;
    isScanning: boolean;
    isConnected: boolean;
    connectedDevice: BluetoothDevice | null;
    availableDevices: BluetoothDevice[];
    error: string | null;
    isBluetoothEnabled: boolean;
    isPrinting?: boolean;
    onStartScan: () => void;
    onStopScan: () => void;
    onConnect: (device: BluetoothDevice) => void;
    onDisconnect: () => void;
    onPrintData?: (data: Uint8Array) => Promise<boolean>;
}

export default function PrinterScanSheet({
    visible,
    onClose,
    isScanning,
    isConnected,
    connectedDevice,
    availableDevices,
    error,
    isBluetoothEnabled,
    isPrinting,
    onStartScan,
    onStopScan,
    onConnect,
    onDisconnect,
    onPrintData,
}: PrinterScanSheetProps) {
    const { colors } = useTheme();
    const [testPrintDone, setTestPrintDone] = useState(false);

    const [appPrintLoading, setAppPrintLoading] = useState(false);

    const handleTestPrint = async () => {
        if (!onPrintData) return;
        setTestPrintDone(false);
        const data = buildTestPrint();
        const success = await onPrintData(data);
        if (success) setTestPrintDone(true);
    };

    const handleTestPrintViaApp = async () => {
        setAppPrintLoading(true);
        const data = buildBluetoothPrintTest();
        await printViaBluetoothPrintApp(data);
        setAppPrintLoading(false);
    };

    const handleInstallApp = () => {
        const url = 'https://play.google.com/store/apps/details?id=mate.bluetoothprint';
        Linking.openURL(url).catch(() => { });
    };

    const renderDevice = ({ item }: { item: BluetoothDevice }) => (
        <Pressable
            style={[styles.deviceItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => onConnect(item)}
        >
            <View style={styles.deviceInfo}>
                <Bluetooth size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.deviceName, { color: colors.foreground }]}>{item.name}</Text>
                    {item.rssi && (
                        <Text style={[styles.deviceRssi, { color: colors.mutedForeground }]}>
                            Signal: {item.rssi} dBm
                        </Text>
                    )}
                </View>
            </View>
            <Text style={[styles.connectText, { color: colors.primary }]}>Connect</Text>
        </Pressable>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.overlayBg} onPress={onClose} />
                <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={[styles.handle, { backgroundColor: colors.border }]} />

                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.foreground }]}>Bluetooth Printer</Text>
                        <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.secondary }]}>
                            <X size={18} color={colors.foreground} />
                        </Pressable>
                    </View>

                    {/* Connected Device */}
                    {isConnected && connectedDevice && (
                        <View style={[styles.connectedCard, { backgroundColor: colors.secondary, borderColor: colors.success }]}>
                            <View style={styles.connectedInfo}>
                                <Wifi size={16} color={colors.success} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.connectedLabel, { color: colors.success }]}>Connected</Text>
                                    <Text style={[styles.connectedName, { color: colors.foreground }]}>{connectedDevice.name}</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <Pressable
                                    style={[styles.testPrintBtn, { backgroundColor: colors.primary, opacity: isPrinting ? 0.6 : 1 }]}
                                    onPress={handleTestPrint}
                                    disabled={isPrinting}
                                >
                                    {isPrinting ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <Printer size={14} color={colors.white} />
                                    )}
                                    <Text style={[styles.disconnectText, { color: colors.white }]}>
                                        {isPrinting ? 'Printing...' : testPrintDone ? 'Print Again' : 'Test Print'}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.disconnectBtn, { backgroundColor: colors.destructive }]}
                                    onPress={onDisconnect}
                                >
                                    <Unplug size={14} color={colors.white} />
                                    <Text style={[styles.disconnectText, { color: colors.white }]}>Disconnect</Text>
                                </Pressable>
                            </View>
                            {testPrintDone && (
                                <Text style={{ color: colors.success, fontSize: 12, textAlign: 'center', fontWeight: '600' }}>
                                    ✓ Test print sent successfully!
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Error */}
                    {error && (
                        <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: colors.destructive }]}>
                            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
                        </View>
                    )}

                    {/* Scan Button */}
                    {!isConnected && (
                        <Pressable
                            style={[styles.scanBtn, { backgroundColor: isScanning ? colors.muted : colors.primary }]}
                            onPress={isScanning ? onStopScan : onStartScan}
                        >
                            {isScanning ? (
                                <>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text style={[styles.scanBtnText, { color: colors.foreground }]}>Stop Scanning</Text>
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={16} color={colors.white} />
                                    <Text style={[styles.scanBtnText, { color: colors.white }]}>Scan for Printers</Text>
                                </>
                            )}
                        </Pressable>
                    )}

                    {/* Device List */}
                    {!isConnected && (
                        <View style={{ flex: 1, marginTop: 6 }}>
                            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                                {isScanning ? 'Scanning...' : `Available Devices (${availableDevices.length})`}
                            </Text>
                            <FlatList
                                data={availableDevices}
                                keyExtractor={(item) => item.id}
                                renderItem={renderDevice}
                                contentContainerStyle={{ gap: 6 }}
                                ListEmptyComponent={
                                    <View style={styles.emptyState}>
                                        <BluetoothOff size={32} color={colors.mutedForeground} />
                                        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                                            {isScanning ? 'Searching for devices...' : 'No devices found. Tap scan to search.'}
                                        </Text>
                                    </View>
                                }
                            />
                        </View>
                    )}

                    {/* Bluetooth Print App Section */}
                    {Platform.OS === 'android' && (
                        <View style={[styles.appSection, { borderColor: colors.border, backgroundColor: colors.card }]}>
                            <Text style={[styles.appSectionTitle, { color: colors.foreground }]}>
                                🖨️ Print via Bluetooth Print App
                            </Text>
                            <Text style={[styles.appSectionDesc, { color: colors.mutedForeground }]}>
                                If direct BLE scan doesn't find your printer, use the Bluetooth Print app for reliable printing.
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <Pressable
                                    style={[styles.appBtn, { backgroundColor: colors.primary, opacity: appPrintLoading ? 0.6 : 1 }]}
                                    onPress={handleTestPrintViaApp}
                                    disabled={appPrintLoading}
                                >
                                    <Printer size={14} color={'#fff'} />
                                    <Text style={[styles.appBtnText, { color: '#fff' }]}>
                                        {appPrintLoading ? 'Opening...' : 'Test Print'}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.appBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
                                    onPress={handleInstallApp}
                                >
                                    <ExternalLink size={14} color={colors.primary} />
                                    <Text style={[styles.appBtnText, { color: colors.primary }]}>Install App</Text>
                                </Pressable>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingHorizontal: 6, paddingBottom: 30, maxHeight: '70%', borderTopWidth: 1,
    },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingHorizontal: 6 },
    title: { fontSize: 18, fontWeight: '700' },
    closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    connectedCard: { flexDirection: 'column', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 6, marginHorizontal: 6, gap: 8 },
    connectedInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    connectedLabel: { fontSize: 11, fontWeight: '600' },
    connectedName: { fontSize: 14, fontWeight: '600' },
    testPrintBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
    disconnectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
    disconnectText: { fontSize: 13, fontWeight: '600' },
    errorBox: { padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 6, marginHorizontal: 6 },
    errorText: { fontSize: 12, fontWeight: '500' },
    scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, marginHorizontal: 6 },
    scanBtnText: { fontSize: 14, fontWeight: '600' },
    sectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, paddingHorizontal: 6 },
    deviceItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10, borderWidth: 1, marginHorizontal: 6 },
    deviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    deviceName: { fontSize: 14, fontWeight: '600' },
    deviceRssi: { fontSize: 11 },
    connectText: { fontSize: 13, fontWeight: '600' },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30, gap: 10 },
    emptyText: { fontSize: 13, textAlign: 'center' },
    appSection: { marginTop: 10, marginHorizontal: 6, padding: 12, borderRadius: 12, borderWidth: 1, gap: 8 },
    appSectionTitle: { fontSize: 14, fontWeight: '700' },
    appSectionDesc: { fontSize: 12, lineHeight: 16 },
    appBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
    appBtnText: { fontSize: 13, fontWeight: '600' },
});
