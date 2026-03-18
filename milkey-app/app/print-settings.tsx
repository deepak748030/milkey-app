import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, Printer, Save } from 'lucide-react-native';
import { router } from 'expo-router';
import { printSettingsApi, PrintSettings } from '@/lib/milkeyApi';
import { SuccessModal } from '@/components/SuccessModal';

export default function PrintSettingsScreen() {
    const { colors, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<PrintSettings>({
        dairyName: '',
        ownerName: '',
        mobileNumber: '',
        address: '',
        showMobileOnReceipt: true,
        extraInfo: '',
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
                    extraInfo: res.response.extraInfo || '',
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
            const res = await printSettingsApi.update(settings);
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

                {/* Dairy Name */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Dairy Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter dairy name"
                        value={settings.dairyName}
                        onChangeText={(v) => setSettings({ ...settings, dairyName: v })}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>

                {/* Mobile Number */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Mobile Number</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter mobile number"
                        value={settings.mobileNumber}
                        onChangeText={(v) => setSettings({ ...settings, mobileNumber: v })}
                        keyboardType="phone-pad"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>

                {/* Toggle - Show Mobile on Receipt */}
                <Pressable
                    style={styles.toggleRow}
                    onPress={() => setSettings({ ...settings, showMobileOnReceipt: !settings.showMobileOnReceipt })}
                >
                    <View style={styles.toggleInfo}>
                        <Text style={styles.toggleLabel}>Show Mobile on Receipt</Text>
                        <Text style={styles.toggleDesc}>Display your mobile number on printed receipts</Text>
                    </View>
                    <View style={[styles.switchTrack, settings.showMobileOnReceipt && styles.switchTrackActive]}>
                        <View style={[styles.switchThumb, settings.showMobileOnReceipt && styles.switchThumbActive]} />
                    </View>
                </Pressable>

                {/* Address / Village Name */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Address / Village Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter address or village name"
                        value={settings.address}
                        onChangeText={(v) => setSettings({ ...settings, address: v })}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>

                {/* Note (shown at last on receipt) */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Note (shown at bottom of receipt)</Text>
                    <TextInput
                        style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                        placeholder="Any note for receipt"
                        value={settings.extraInfo}
                        onChangeText={(v) => setSettings({ ...settings, extraInfo: v })}
                        multiline
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>

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
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 14,
        marginBottom: 6,
    },
    toggleInfo: {
        flex: 1,
    },
    toggleLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 2,
    },
    toggleDesc: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    switchTrack: {
        width: 52,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.muted,
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    switchTrackActive: {
        backgroundColor: colors.primary,
    },
    switchThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    switchThumbActive: {
        alignSelf: 'flex-end',
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 10,
        marginTop: 12,
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.white,
    },
});
