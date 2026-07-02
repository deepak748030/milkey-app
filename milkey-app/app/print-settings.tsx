import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, Printer, Save, Eye, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { printSettingsApi, PrintSettings } from '@/lib/milkeyApi';
import { SuccessModal } from '@/components/SuccessModal';

export default function PrintSettingsScreen() {
    const { colors, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSlipPreview, setShowSlipPreview] = useState(false);
    const [settings, setSettings] = useState<PrintSettings>({
        dairyName: '',
        ownerName: '',
        mobileNumber: '',
        address: '',
        showMobileOnReceipt: true,
        extraInfo: 'Thank You !',
        digitalSlipName: '',
    });

    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');

    const showAlert = (title: string, message: string) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertVisible(true);
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await printSettingsApi.get();
            if (res.success && res.response) {
                setSettings({
                    dairyName: res.response.dairyName || '',
                    ownerName: res.response.ownerName || '',
                    mobileNumber: res.response.mobileNumber || '',
                    address: res.response.address || '',
                    showMobileOnReceipt: res.response.showMobileOnReceipt !== false,
                    // Default the receipt note to "Thank You !" so a fresh user
                    // immediately sees the same footer as the printed slip.
                    extraInfo: res.response.extraInfo || 'Thank You !',
                    digitalSlipName: res.response.digitalSlipName || res.response.dairyName || '',
                });
            }
        } catch (e) {
            // silent
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await printSettingsApi.update({ ...settings, digitalSlipName: settings.dairyName });
            if (res.success) {
                showAlert('Success', 'Print settings saved successfully');
            } else {
                showAlert('Error', res.message || 'Failed to save settings');
            }
        } catch (e) {
            showAlert('Error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const mockSlipData = {
        farmerName: 'Ramesh Kumar',
        farmerCode: 'F-0012',
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        shift: 'Morning',
        milkType: 'Buffalo',
        qty: '12.5 Ltr',
        fat: '6.2',
        snf: '8.8',
        rate: '₹52.00/Ltr',
        amount: '₹650.00',
    };

    const styles = createStyles(colors, isDark);

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <Pressable style={styles.backBtn} onPress={() => router.back()}>
                        <ArrowLeft size={22} color={colors.foreground} />
                    </Pressable>
                    <Text style={styles.headerTitle}>Print Settings</Text>
                    <View style={{ width: 36 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <ArrowLeft size={22} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>Print Settings</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                    <Printer size={32} color={colors.primary} />
                    <Text style={styles.iconLabel}>Receipt Configuration</Text>
                </View>

                {/* Dairy Name — single field used for both printed receipt and digital (WhatsApp/SMS) slip */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Dairy Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter dairy name"
                        value={settings.dairyName}
                        onChangeText={(v) => setSettings({ ...settings, dairyName: v, digitalSlipName: v })}
                        placeholderTextColor={colors.mutedForeground}
                    />
                    <Text style={[styles.phoneHint, { color: colors.mutedForeground, marginTop: 4 }]}>
                        Used on printed receipt and digital slip
                    </Text>
                </View>

                {/* Village / Address */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Village / Address</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter village or address"
                        value={settings.address}
                        onChangeText={(v) => setSettings({ ...settings, address: v })}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>

                {/* Phone Number with Toggle inline on right */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Ph :</Text>
                    <View style={styles.phoneInputRow}>
                        <TextInput
                            style={[
                                styles.phoneInput,
                                !settings.showMobileOnReceipt && { color: colors.mutedForeground, opacity: 0.5 },
                            ]}
                            placeholder="Enter phone number"
                            value={settings.mobileNumber}
                            onChangeText={(v) => setSettings({ ...settings, mobileNumber: v })}
                            keyboardType="phone-pad"
                            placeholderTextColor={colors.mutedForeground}
                        />
                        <Pressable
                            onPress={() => setSettings({ ...settings, showMobileOnReceipt: !settings.showMobileOnReceipt })}
                            style={[
                                styles.inlineSwitch,
                                settings.showMobileOnReceipt
                                    ? { backgroundColor: colors.primary }
                                    : { backgroundColor: colors.muted },
                            ]}
                        >
                            <View style={[
                                styles.inlineSwitchThumb,
                                settings.showMobileOnReceipt
                                    ? { transform: [{ translateX: 18 }] }
                                    : { transform: [{ translateX: 0 }] },
                            ]} />
                        </Pressable>
                    </View>
                    <Text style={[styles.phoneHint, { color: settings.showMobileOnReceipt ? colors.success : colors.mutedForeground }]}>
                        {settings.showMobileOnReceipt ? 'Visible on receipt' : 'Hidden on receipt'}
                    </Text>
                </View>

                {/* Digital slip dairy name is now auto-synced from Dairy Name above */}


                {/* Extra note (footer) */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Extra note</Text>
                    <TextInput
                        style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                        placeholder="Thank You !"
                        value={settings.extraInfo}
                        onChangeText={(v) => setSettings({ ...settings, extraInfo: v })}
                        multiline
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>

                {/* View Slip Button */}
                <Pressable
                    style={styles.viewSlipBtn}
                    onPress={() => setShowSlipPreview(true)}
                >
                    <Eye size={18} color={colors.primary} />
                    <Text style={styles.viewSlipBtnText}>View Slip (Preview)</Text>
                </Pressable>

                {/* Save Button */}
                <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <>
                            <Save size={18} color={colors.white} />
                            <Text style={styles.saveBtnText}>Save Settings</Text>
                        </>
                    )}
                </Pressable>
            </ScrollView>

            {/* Mock Slip Preview Modal */}
            <Modal visible={showSlipPreview} transparent animationType="slide">
                <View style={styles.slipOverlay}>
                    <View style={styles.slipContainer}>
                        <View style={styles.slipHeader}>
                            <Text style={styles.slipHeaderTitle}>Slip Preview</Text>
                            <Pressable onPress={() => setShowSlipPreview(false)} style={styles.slipCloseBtn}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        <View style={styles.slipPaper}>
                            {/* Dairy Header */}
                            <Text style={styles.slipDairyName}>
                                {settings.dairyName || 'Your Dairy Name'}
                            </Text>
                            <Text style={styles.slipAddress}>
                                {settings.address || 'Village / Address'}
                            </Text>
                            {settings.showMobileOnReceipt && settings.mobileNumber ? (
                                <Text style={styles.slipMobile}>Ph: {settings.mobileNumber}</Text>
                            ) : null}

                            <View style={styles.slipDivider} />

                            {/* Farmer Info */}
                            <View style={styles.slipRow}>
                                <Text style={styles.slipLabel}>Farmer</Text>
                                <Text style={styles.slipValue}>{mockSlipData.farmerName} ({mockSlipData.farmerCode})</Text>
                            </View>
                            <View style={styles.slipRow}>
                                <Text style={styles.slipLabel}>Date</Text>
                                <Text style={styles.slipValue}>{mockSlipData.date} | {mockSlipData.time}</Text>
                            </View>
                            <View style={styles.slipRow}>
                                <Text style={styles.slipLabel}>Shift</Text>
                                <Text style={styles.slipValue}>{mockSlipData.shift}</Text>
                            </View>

                            <View style={styles.slipDivider} />

                            {/* Milk Details */}
                            <View style={styles.slipRow}>
                                <Text style={styles.slipLabel}>Milk Type</Text>
                                <Text style={styles.slipValue}>{mockSlipData.milkType}</Text>
                            </View>
                            <View style={styles.slipRow}>
                                <Text style={styles.slipLabel}>Quantity</Text>
                                <Text style={styles.slipValue}>{mockSlipData.qty}</Text>
                            </View>
                            <View style={styles.slipRow}>
                                <Text style={styles.slipLabel}>Fat</Text>
                                <Text style={styles.slipValue}>{mockSlipData.fat}</Text>
                            </View>
                            <View style={styles.slipRow}>
                                <Text style={styles.slipLabel}>SNF</Text>
                                <Text style={styles.slipValue}>{mockSlipData.snf}</Text>
                            </View>
                            <View style={styles.slipRow}>
                                <Text style={styles.slipLabel}>Rate</Text>
                                <Text style={styles.slipValue}>{mockSlipData.rate}</Text>
                            </View>

                            <View style={styles.slipDividerBold} />

                            {/* Total */}
                            <View style={styles.slipRow}>
                                <Text style={styles.slipTotalLabel}>Total Amount</Text>
                                <Text style={styles.slipTotalValue}>{mockSlipData.amount}</Text>
                            </View>

                            <View style={styles.slipDivider} />
                            <Text style={styles.slipFooter}>Thank You! Visit Again</Text>
                        </View>
                    </View>
                </View>
            </Modal>

            <SuccessModal
                isVisible={alertVisible}
                onClose={() => setAlertVisible(false)}
                title={alertTitle}
                message={alertMessage}
                autoClose={alertTitle === 'Success'}
            />
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.card,
    },
    backBtn: {
        padding: 6,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.foreground,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 6,
        paddingTop: 12,
        paddingBottom: 80,
    },
    iconContainer: {
        alignItems: 'center',
        paddingVertical: 16,
        marginBottom: 6,
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
        marginTop: 8,
    },
    inputGroup: {
        marginBottom: 6,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.mutedForeground,
        marginBottom: 4,
    },
    input: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        color: colors.foreground,
    },
    phoneInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    phoneInput: {
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        color: colors.foreground,
    },
    inlineSwitch: {
        width: 44,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    inlineSwitchThumb: {
        alignSelf: 'flex-start',
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    phoneHint: {
        fontSize: 11,
        marginTop: 3,
        fontWeight: '500',
    },
    viewSlipBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.primary,
        backgroundColor: colors.primary + '10',
        marginBottom: 6,
    },
    viewSlipBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.primary,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 10,
        marginTop: 6,
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.white,
    },
    // Slip Preview styles
    slipOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    slipContainer: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    slipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    slipHeaderTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.foreground,
    },
    slipCloseBtn: {
        padding: 4,
    },
    slipPaper: {
        backgroundColor: isDark ? colors.card : '#FFFFF8',
        padding: 16,
        margin: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
    },
    slipDairyName: {
        fontSize: 16,
        fontWeight: '800',
        color: isDark ? colors.foreground : '#1a1a1a',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    slipAddress: {
        fontSize: 11,
        color: isDark ? colors.mutedForeground : '#666',
        textAlign: 'center',
        marginTop: 2,
    },
    slipMobile: {
        fontSize: 11,
        color: isDark ? colors.mutedForeground : '#666',
        textAlign: 'center',
        marginTop: 1,
    },
    slipDivider: {
        height: 1,
        backgroundColor: isDark ? colors.border : '#ddd',
        marginVertical: 8,
        borderStyle: 'dashed',
    },
    slipDividerBold: {
        height: 2,
        backgroundColor: isDark ? colors.foreground : '#333',
        marginVertical: 8,
    },
    slipRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 2,
    },
    slipLabel: {
        fontSize: 12,
        color: isDark ? colors.mutedForeground : '#555',
        fontWeight: '500',
    },
    slipValue: {
        fontSize: 12,
        color: isDark ? colors.foreground : '#1a1a1a',
        fontWeight: '600',
    },
    slipTotalLabel: {
        fontSize: 14,
        fontWeight: '800',
        color: isDark ? colors.foreground : '#1a1a1a',
    },
    slipTotalValue: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.primary,
    },
    slipNote: {
        fontSize: 10,
        color: isDark ? colors.mutedForeground : '#888',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    slipFooter: {
        fontSize: 11,
        color: isDark ? colors.mutedForeground : '#999',
        textAlign: 'center',
        fontWeight: '600',
    },
});