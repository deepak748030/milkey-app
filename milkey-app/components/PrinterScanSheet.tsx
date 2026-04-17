import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, FlatList } from 'react-native';
import { X, Bluetooth, BluetoothOff, RefreshCw, Unplug, Wifi, Printer } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { BluetoothDevice, PrinterKind } from '@/hooks/useBluetoothPrinter';
import { buildTestPrint } from '@/lib/escpos';

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

type FilterMode = 'all' | PrinterKind;

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
    const [filter, setFilter] = useState<FilterMode>('all');

    const handleTestPrint = async () => {
        if (!onPrintData) return;
        setTestPrintDone(false);
        const success = await onPrintData(buildTestPrint());
        if (success) setTestPrintDone(true);
    };

    const filteredDevices = useMemo(() => {
        if (filter === 'all') return availableDevices;
        return availableDevices.filter(d => d.kind === filter);
    }, [availableDevices, filter]);

    const counts = useMemo(() => ({
        all: availableDevices.length,
        ble: availableDevices.filter(d => d.kind === 'ble').length,
        classic: availableDevices.filter(d => d.kind === 'classic').length,
    }), [availableDevices]);

    const renderDevice = ({ item }: { item: BluetoothDevice }) => {
        const isClassic = item.kind === 'classic';
        return (
            <Pressable
                style={[styles.deviceItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => onConnect(item)}
            >
                <View style={styles.deviceInfo}>
                    <Bluetooth size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.deviceName, { color: colors.foreground }]}>{item.name}</Text>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 2 }}>
                            <View style={[styles.kindBadge, { backgroundColor: isClassic ? '#F59E0B' : colors.primary }]}>
                                <Text style={styles.kindBadgeText}>{isClassic ? 'CLASSIC' : 'BLE'}</Text>
                            </View>
                            {typeof item.rssi === 'number' && (
                                <Text style={[styles.deviceRssi, { color: colors.mutedForeground }]}>
                                    {item.rssi} dBm
                                </Text>
                            )}
                        </View>
                    </View>
                </View>
                <Text style={[styles.connectText, { color: colors.primary }]}>Connect</Text>
            </Pressable>
        );
    };

    const renderFilterTab = (mode: FilterMode, label: string, count: number) => {
        const active = filter === mode;
        return (
            <Pressable
                key={mode}
                onPress={() => setFilter(mode)}
                style={[
                    styles.filterTab,
                    { backgroundColor: active ? colors.primary : colors.card, borderColor: colors.border },
                ]}
            >
                <Text style={[styles.filterTabText, { color: active ? colors.white : colors.foreground }]}>
                    {label} ({count})
                </Text>
            </Pressable>
        );
    };

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

                    {!isBluetoothEnabled && (
                        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.infoText, { color: colors.foreground }]}>
                                Turn on Bluetooth AND Location services, then scan.
                            </Text>
                        </View>
                    )}

                    {isBluetoothEnabled && !isConnected && (
                        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                                Both BLE and Classic (SPP) printers are supported. For Classic printers, pair them in Android Bluetooth settings first.
                            </Text>
                        </View>
                    )}

                    {isConnected && connectedDevice && (
                        <View style={[styles.connectedCard, { backgroundColor: colors.secondary, borderColor: colors.success }]}>
                            <View style={styles.connectedInfo}>
                                <Wifi size={16} color={colors.success} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.connectedLabel, { color: colors.success }]}>
                                        Connected ({connectedDevice.kind === 'classic' ? 'Classic SPP' : 'BLE'})
                                    </Text>
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

                    {error && (
                        <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: colors.destructive }]}>
                            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
                        </View>
                    )}

                    {!isConnected && (
                        <Pressable
                            style={[styles.scanBtn, { backgroundColor: isScanning ? colors.muted : colors.primary, opacity: !isBluetoothEnabled && !isScanning ? 0.7 : 1 }]}
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

                    {!isConnected && (
                        <View style={styles.filterRow}>
                            {renderFilterTab('all', 'All', counts.all)}
                            {renderFilterTab('ble', 'BLE', counts.ble)}
                            {renderFilterTab('classic', 'Classic', counts.classic)}
                        </View>
                    )}

                    {!isConnected && (
                        <View style={{ flex: 1, marginTop: 6 }}>
                            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                                {isScanning ? 'Scanning...' : `Available Devices (${filteredDevices.length})`}
                            </Text>
                            <FlatList
                                data={filteredDevices}
                                keyExtractor={(item) => `${item.kind}:${item.id}`}
                                renderItem={renderDevice}
                                contentContainerStyle={{ gap: 6 }}
                                ListEmptyComponent={
                                    <View style={styles.emptyState}>
                                        <BluetoothOff size={32} color={colors.mutedForeground} />
                                        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                                            {isScanning ? 'Searching for nearby Bluetooth printers...' : 'No printers found yet. For Classic printers, pair in Android settings first.'}
                                        </Text>
                                    </View>
                                }
                            />
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
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 6,
        paddingBottom: 30,
        maxHeight: '75%',
        borderTopWidth: 1,
    },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingHorizontal: 6 },
    title: { fontSize: 18, fontWeight: '700' },
    closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    infoBox: { padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 6, marginHorizontal: 6 },
    infoText: { fontSize: 12, fontWeight: '500' },
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
    filterRow: { flexDirection: 'row', gap: 6, marginTop: 8, marginHorizontal: 6 },
    filterTab: { flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
    filterTabText: { fontSize: 12, fontWeight: '600' },
    sectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, paddingHorizontal: 6, marginTop: 6 },
    deviceItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10, borderWidth: 1, marginHorizontal: 6 },
    deviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    deviceName: { fontSize: 14, fontWeight: '600' },
    deviceRssi: { fontSize: 11 },
    kindBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    kindBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
    connectText: { fontSize: 13, fontWeight: '600' },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30, gap: 10 },
    emptyText: { fontSize: 13, textAlign: 'center' },
});
