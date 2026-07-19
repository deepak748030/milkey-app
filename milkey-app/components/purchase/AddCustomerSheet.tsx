import React, { useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView, ActivityIndicator, Switch, FlatList } from 'react-native';
import { X, Check, ChevronDown, Search, RotateCcw } from 'lucide-react-native';
import { PurchaseFarmer, purchaseFarmersApi } from '@/lib/milkeyApi';
import { SuccessModal } from '../SuccessModal';
import { ConfirmationModal } from '../ConfirmationModal';
import { useDebounce } from '@/hooks/useDebounce';

interface AddCustomerSheetProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingFarmer?: PurchaseFarmer | null;
    colors: any;
    isDark: boolean;
}

const PRICE_BASIS_OPTIONS = [
    { value: 'fat', label: 'Fat' },
    { value: 'rate', label: 'Rate' },
    { value: 'fat_snf', label: 'Rate Chart' },
];

const ALERT_METHOD_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'sms', label: 'SMS' },
    { value: 'whatsapp', label: 'WhatsApp' },
];

const PRINT_SLIP_OPTIONS = [
    { value: 'default', label: 'Default' },
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
];

function AddCustomerSheetInner({ visible, onClose, onSuccess, editingFarmer, colors, isDark }: AddCustomerSheetProps) {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [defaultMilk, setDefaultMilk] = useState<'cow' | 'buffalo'>('buffalo');
    const [cowEnabled, setCowEnabled] = useState(true);
    const [buffaloEnabled, setBuffaloEnabled] = useState(true);
    const [priceBasis, setPriceBasis] = useState<'rate' | 'fat' | 'fat_snf'>('rate');
    const [showRateChart, setShowRateChart] = useState(false);
    const [buffaloRate, setBuffaloRate] = useState('');
    const [cowRate, setCowRate] = useState('');
    const [buffaloFat, setBuffaloFat] = useState('');
    const [cowFat, setCowFat] = useState('');
    const [alertMethod, setAlertMethod] = useState<'sms' | 'whatsapp' | 'none'>('none');
    const [printEntrySlip, setPrintEntrySlip] = useState<'default' | 'yes' | 'no'>('default');
    const [saving, setSaving] = useState(false);
    const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null);
    const [checkingCode, setCheckingCode] = useState(false);

    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');

    const debouncedCode = useDebounce(code, 400);

    React.useEffect(() => {
        if (visible) {
            if (editingFarmer) {
                setCode(editingFarmer.code);
                setName(editingFarmer.name);
                setPhone(editingFarmer.mobile);
                setDefaultMilk(editingFarmer.defaultMilk || 'buffalo');
                setCowEnabled(editingFarmer.cowEnabled ?? true);
                setBuffaloEnabled(editingFarmer.buffaloEnabled ?? true);
                setPriceBasis(editingFarmer.priceBasis || 'rate');
                setShowRateChart(
                    (editingFarmer as any).showRateChart === true
                );

                setBuffaloRate(editingFarmer.buffaloRate ? String(editingFarmer.buffaloRate) : '');
                setCowRate(editingFarmer.cowRate ? String(editingFarmer.cowRate) : '');
                setBuffaloFat(editingFarmer.buffaloFat ? String(editingFarmer.buffaloFat) : '');
                setCowFat(editingFarmer.cowFat ? String(editingFarmer.cowFat) : '');
                setAlertMethod((editingFarmer as any).alertMethod || 'none');
                setPrintEntrySlip((editingFarmer as any).printEntrySlip || 'default');
                setCodeAvailable(null);
            } else {
                resetForm();
            }
        }
    }, [visible, editingFarmer]);

    React.useEffect(() => {
        if (debouncedCode && !editingFarmer && debouncedCode.trim().length > 0) {
            checkCodeAvailability(debouncedCode.trim());
        }
    }, [debouncedCode]);

    const resetForm = () => {
        setCode(''); setName(''); setPhone(''); setDefaultMilk('buffalo');
        setCowEnabled(true); setBuffaloEnabled(true); setPriceBasis('rate');
        setShowRateChart(false);
        setBuffaloRate(''); setCowRate(''); setBuffaloFat(''); setCowFat('');
        setAlertMethod('none'); setPrintEntrySlip('default');
        setCodeAvailable(null);
    };

    const checkCodeAvailability = async (c: string) => {
        setCheckingCode(true);
        try {
            const res = await purchaseFarmersApi.checkCode(c);
            if (res.success) setCodeAvailable(res.response?.available ?? null);
        } catch { }
        setCheckingCode(false);
    };

    const handleSave = async () => {
        if (!code.trim() || !name.trim()) {
            setAlertTitle('Error'); setAlertMessage('Code and Name are required'); setAlertVisible(true);
            return;
        }
        setSaving(true);
        try {
            const data: any = {
                code: code.trim().toUpperCase(), name: name.trim(), mobile: phone.trim(),
                cowEnabled, buffaloEnabled, defaultMilk, priceBasis,
                cowRate: parseFloat(cowRate) || 0, buffaloRate: parseFloat(buffaloRate) || 0,
                cowFat: parseFloat(cowFat) || 0, buffaloFat: parseFloat(buffaloFat) || 0,
                alertMethod, printEntrySlip,
                // Rate Chart icon: user-controlled toggle applies for every price basis
                showRateChart: !!showRateChart,
            };
            const res = editingFarmer
                ? await purchaseFarmersApi.update(editingFarmer._id, data)
                : await purchaseFarmersApi.create(data);
            if (res.success) {
                onSuccess();
                onClose();
                resetForm();
            } else {
                setAlertTitle('Error'); setAlertMessage(res.message || 'Failed'); setAlertVisible(true);
            }
        } catch {
            setAlertTitle('Error'); setAlertMessage('Something went wrong'); setAlertVisible(true);
        }
        setSaving(false);
    };

    const s = createSheetStyles(colors, isDark);

    // Reset everything EXCEPT code, name, phone back to defaults.
    const resetOtherSettings = () => {
        setDefaultMilk('buffalo');
        setCowEnabled(true);
        setBuffaloEnabled(true);
        setPriceBasis('rate');
        setShowRateChart(false);
        setBuffaloRate(''); setCowRate('');
        setBuffaloFat(''); setCowFat('');
        setAlertMethod('none');
        setPrintEntrySlip('default');
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={s.overlay}>
                <Pressable style={{ flex: 1 }} onPress={onClose} />
                <View style={s.sheet}>
                    <View style={s.handle} />

                    {/* Header with title + larger red X on the side */}
                    <View style={s.header}>
                        <Text style={s.title}>{editingFarmer ? 'Edit Customer' : 'Add Customer'}</Text>
                        <Pressable
                            onPress={onClose}
                            hitSlop={12}
                            style={s.closeBtn}
                        >
                            <X size={26} color="#ef4444" strokeWidth={3} />
                        </Pressable>
                    </View>

                    {/* Action buttons moved to TOP so they aren't cut by phone navigation bar */}
                    <View style={s.topActions}>
                        <Pressable style={s.cancelBtn} onPress={() => { onClose(); resetForm(); }}>
                            <X size={16} color={colors.foreground} />
                            <Text style={s.cancelBtnText}>Cancel</Text>
                        </Pressable>
                        <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>💾 Save</Text>}
                        </Pressable>
                    </View>

                    <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {/* Customer Details Card */}
                        <View style={s.sectionCard}>
                            <Text style={s.sectionTitle}>Customer Details</Text>

                            <View style={s.field}>
                                <Text style={s.fieldLabel}>1. Code</Text>
                                <View style={s.inputRow}>
                                    <TextInput
                                        style={[s.input, { flex: 1 }, editingFarmer && s.inputDisabled]}
                                        value={code}
                                        onChangeText={setCode}
                                        placeholder="e.g. 1, A01"
                                        placeholderTextColor={colors.mutedForeground}
                                        editable={!editingFarmer}
                                        autoCapitalize="characters"
                                    />
                                    {!editingFarmer && code.trim().length > 0 && (
                                        <View style={s.codeStatus}>
                                            {checkingCode ? (
                                                <ActivityIndicator size="small" color={colors.primary} />
                                            ) : codeAvailable === true ? (
                                                <View style={[s.codeIcon, { backgroundColor: colors.primary + '20' }]}>
                                                    <Check size={16} color={colors.primary} />
                                                </View>
                                            ) : codeAvailable === false ? (
                                                <View style={[s.codeIcon, { backgroundColor: '#ef444420' }]}>
                                                    <X size={16} color="#ef4444" />
                                                </View>
                                            ) : null}
                                        </View>
                                    )}
                                </View>
                                {!editingFarmer && codeAvailable === true && (
                                    <Text style={[s.codeHint, { color: colors.primary }]}>Code available</Text>
                                )}
                                {!editingFarmer && codeAvailable === false && (
                                    <Text style={[s.codeHint, { color: '#ef4444' }]}>Code already taken</Text>
                                )}
                            </View>

                            <View style={s.field}>
                                <Text style={s.fieldLabel}>2. Name</Text>
                                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Customer name" placeholderTextColor={colors.mutedForeground} />
                            </View>

                            <View style={s.field}>
                                <Text style={s.fieldLabel}>3. Phone (Optional)</Text>
                                <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="Mobile number" placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" maxLength={10} />
                            </View>

                            {priceBasis !== 'fat_snf' && (
                            <View style={s.field}>
                                <Text style={s.fieldLabel}>4. Default Milk</Text>
                                <View style={s.toggleRow}>
                                    <Pressable
                                        style={[s.milkChip, defaultMilk === 'cow' && s.milkChipActive]}
                                        onPress={() => setDefaultMilk('cow')}
                                    >
                                        {defaultMilk === 'cow' && <Check size={12} color="#fff" style={{ marginRight: 3 }} />}
                                        <Text style={[s.milkChipText, defaultMilk === 'cow' && { color: '#fff' }]}>🐄 Cow</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[s.milkChip, defaultMilk === 'buffalo' && s.milkChipActive]}
                                        onPress={() => setDefaultMilk('buffalo')}
                                    >
                                        {defaultMilk === 'buffalo' && <Check size={12} color="#fff" style={{ marginRight: 3 }} />}
                                        <Text style={[s.milkChipText, defaultMilk === 'buffalo' && { color: '#fff' }]}>🐃 Buffalo</Text>
                                    </Pressable>
                                </View>
                            </View>
                            )}

                        </View>

                        {/* Price Basis Card */}
                        <View style={s.sectionCard}>
                            <Text style={s.sectionTitle}>5. Rate Based On</Text>
                            <View style={s.priceBasisRow}>
                                {PRICE_BASIS_OPTIONS.map(opt => (
                                    <Pressable
                                        key={opt.value}
                                        style={[s.priceBasisChip, priceBasis === opt.value && s.priceBasisChipActive]}
                                        onPress={() => setPriceBasis(opt.value as any)}
                                    >
                                        {priceBasis === opt.value && <Check size={14} color="#fff" style={{ marginRight: 4 }} />}
                                        <Text style={[s.priceBasisText, priceBasis === opt.value && s.priceBasisTextActive]}>{opt.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        {/* Show Rate Chart Icon toggle — only for Rate Chart (fat_snf) pricing */}
                        {priceBasis === 'fat_snf' && (
                        <View style={s.sectionCard}>
                            <Text style={s.sectionTitle}>Show Rate Chart Icon</Text>
                            <View style={s.priceBasisRow}>
                                {[
                                    { value: true, label: 'Yes' },
                                    { value: false, label: 'No' },
                                ].map(opt => (
                                    <Pressable
                                        key={String(opt.value)}
                                        style={[s.priceBasisChip, showRateChart === opt.value && s.priceBasisChipActive]}
                                        onPress={() => setShowRateChart(opt.value)}
                                    >
                                        {showRateChart === opt.value && <Check size={14} color="#fff" style={{ marginRight: 4 }} />}
                                        <Text style={[s.priceBasisText, showRateChart === opt.value && s.priceBasisTextActive]}>{opt.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                        )}

                        {/* Buffalo Milk Card — hidden when Rate Chart is the pricing mode */}
                        {priceBasis !== 'fat_snf' && buffaloEnabled && (
                            <View style={s.sectionCard}>
                                <Text style={s.sectionTitle}>🐃 Buffalo Milk</Text>
                                <View style={s.inputRow}>
                                    <TextInput
                                        style={[s.input, { flex: 1 }]}
                                        value={priceBasis === 'rate' ? buffaloRate : buffaloFat}
                                        onChangeText={priceBasis === 'rate' ? setBuffaloRate : setBuffaloFat}
                                        placeholder={priceBasis === 'rate' ? 'Rate / litre' : 'Fat value'}
                                        placeholderTextColor={colors.mutedForeground}
                                        keyboardType="decimal-pad"
                                    />
                                    <Switch value={buffaloEnabled} onValueChange={setBuffaloEnabled} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
                                </View>
                            </View>
                        )}

                        {/* Cow Milk Card — hidden when Rate Chart is the pricing mode */}
                        {priceBasis !== 'fat_snf' && cowEnabled && (
                            <View style={s.sectionCard}>
                                <Text style={s.sectionTitle}>🐄 Cow Milk</Text>
                                <View style={s.inputRow}>
                                    <TextInput
                                        style={[s.input, { flex: 1 }]}
                                        value={priceBasis === 'rate' ? cowRate : cowFat}
                                        onChangeText={priceBasis === 'rate' ? setCowRate : setCowFat}
                                        placeholder={priceBasis === 'rate' ? 'Rate / litre' : 'Fat value'}
                                        placeholderTextColor={colors.mutedForeground}
                                        keyboardType="decimal-pad"
                                    />
                                    <Switch value={cowEnabled} onValueChange={setCowEnabled} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
                                </View>
                            </View>
                        )}

                        {/* Alert Method Card */}
                        <View style={s.sectionCard}>
                            <Text style={s.sectionTitle}>6. Alert Method</Text>
                            <View style={s.priceBasisRow}>
                                {ALERT_METHOD_OPTIONS.map(opt => (
                                    <Pressable
                                        key={opt.value}
                                        style={[s.priceBasisChip, alertMethod === opt.value && s.priceBasisChipActive]}
                                        onPress={() => setAlertMethod(opt.value as any)}
                                    >
                                        {alertMethod === opt.value && <Check size={14} color="#fff" style={{ marginRight: 4 }} />}
                                        <Text style={[s.priceBasisText, alertMethod === opt.value && s.priceBasisTextActive]}>{opt.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>


                        <View style={{ height: 20 }} />

                        {/* Reset Settings — clears everything except Code, Name, Phone */}
                        <Pressable style={s.resetBtn} onPress={resetOtherSettings}>
                            <RotateCcw size={16} color="#ef4444" />
                            <Text style={s.resetBtnText}>Reset Settings</Text>
                        </Pressable>
                        <Text style={s.resetHint}>
                            Resets Milk, Rate, Alerts and Print settings. Code, Name and Phone are kept.
                        </Text>

                        <View style={{ height: 20 }} />
                    </ScrollView>
                </View>
            </View>
            <SuccessModal isVisible={alertVisible} title={alertTitle} message={alertMessage} onClose={() => setAlertVisible(false)} />
        </Modal>
    );
}

export const AddCustomerSheet = memo(AddCustomerSheetInner);

const createSheetStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
    handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 12 },
    title: { fontSize: 18, fontWeight: '700', color: colors.foreground },
    body: { paddingHorizontal: 6 },
    sectionCard: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 10 },
    field: { marginBottom: 10 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground, marginBottom: 4 },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.foreground },
    inputDisabled: { backgroundColor: colors.muted, opacity: 0.7 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    codeStatus: { width: 32, alignItems: 'center' },
    codeIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    codeHint: { fontSize: 11, marginTop: 2, fontWeight: '500' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    toggleLabel: { fontSize: 13, color: colors.foreground },
    milkChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    milkChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    milkChipText: { fontSize: 13, fontWeight: '500', color: colors.foreground },
    priceBasisRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    priceBasisChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    priceBasisChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    priceBasisText: { fontSize: 13, fontWeight: '500', color: colors.foreground },
    priceBasisTextActive: { color: '#fff' },
    footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
    topActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 2, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
    closeBtn: { width: 30, height: 30, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef444415', borderWidth: 1.5, borderColor: '#ef4444' },
    cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    resetBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 12, borderRadius: 10,
        borderWidth: 1.5, borderColor: '#ef4444',
        backgroundColor: '#ef444410', marginTop: 4,
    },
    resetBtnText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
    resetHint: { fontSize: 11, color: colors.mutedForeground, marginTop: 6, textAlign: 'center' },
});
