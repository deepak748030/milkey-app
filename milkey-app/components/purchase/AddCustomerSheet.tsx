import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { SheetBackdrop } from '@/components/ui/SheetBackdrop';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { X, Check, RotateCcw } from 'lucide-react-native';
import { PurchaseFarmer, purchaseFarmersApi } from '@/lib/milkeyApi';
import { SuccessModal } from '../SuccessModal';
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
    { value: 'fat_snf', label: 'Rate Setting' },
];

const ALERT_METHOD_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'sms', label: 'SMS' },
    { value: 'whatsapp', label: 'WhatsApp' },
];

function AddCustomerSheetInner({ visible, onClose, onSuccess, editingFarmer, colors, isDark }: AddCustomerSheetProps) {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [defaultMilk, setDefaultMilk] = useState<'cow' | 'buffalo'>('buffalo');
    const [priceBasis, setPriceBasis] = useState<'rate' | 'fat' | 'fat_snf'>('rate');
    const [alertMethod, setAlertMethod] = useState<'sms' | 'whatsapp' | 'none'>('none');
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
                setPhone(editingFarmer.mobile || '');
                setAddress((editingFarmer as any).address || '');
                setDefaultMilk(editingFarmer.defaultMilk || 'buffalo');
                setPriceBasis(editingFarmer.priceBasis || 'rate');
                setAlertMethod((editingFarmer as any).alertMethod || 'none');
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
        setCode(''); setName(''); setPhone(''); setAddress('');
        setDefaultMilk('buffalo'); setPriceBasis('rate'); setAlertMethod('none');
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
                code: code.trim().toUpperCase(),
                name: name.trim(),
                mobile: phone.trim(),
                address: address.trim(),
                defaultMilk,
                priceBasis,
                alertMethod,
                // defaults for hidden fields to keep backend happy
                cowEnabled: true,
                buffaloEnabled: true,
                cowRate: 0, buffaloRate: 0, cowFat: 0, buffaloFat: 0, cowSnf: 0, buffaloSnf: 0,
                showRateSetting: false,
                showRateChart: false,
                printEntrySlip: 'default',
            };
            const res = editingFarmer ? await purchaseFarmersApi.update(editingFarmer._id, data) : await purchaseFarmersApi.create(data);
            if (res.success) {
                onSuccess(); onClose(); resetForm();
            } else {
                setAlertTitle('Error'); setAlertMessage(res.message || 'Failed'); setAlertVisible(true);
            }
        } catch {
            setAlertTitle('Error'); setAlertMessage('Something went wrong'); setAlertVisible(true);
        }
        setSaving(false);
    };

    const s = createSheetStyles(colors, isDark);

    const resetOtherSettings = () => {
        setDefaultMilk('buffalo'); setPriceBasis('rate'); setAlertMethod('none');
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={s.overlay}>
                <SheetBackdrop />
                <Pressable style={{ flex: 1 }} onPress={onClose} />
                <View style={s.sheet}>
                    <View style={s.handle} />
                    <View style={s.header}>
                        <Text style={s.title}>{editingFarmer ? 'Edit Customer' : 'Add Customer'}</Text>
                        <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}><X size={26} color="#ef4444" strokeWidth={3} /></Pressable>
                    </View>
                    <View style={s.topActions}>
                        <Pressable style={s.cancelBtn} onPress={() => { onClose(); resetForm(); }}><X size={16} color={colors.foreground} /><Text style={s.cancelBtnText}>Cancel</Text></Pressable>
                        <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>💾 Save</Text>}
                        </Pressable>
                    </View>

                    <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View style={s.sectionCard}>
                            <Text style={s.sectionTitle}>Customer Details — Combined (C+R)</Text>

                            <View style={s.field}>
                                <Text style={s.fieldLabel}>1. Code</Text>
                                <View style={s.inputRow}>
                                    <TextInput style={[s.input, { flex: 1 }, editingFarmer && s.inputDisabled]} value={code} onChangeText={setCode} placeholder="e.g. 1, A01" placeholderTextColor={colors.mutedForeground} editable={!editingFarmer} autoCapitalize="characters" />
                                    {!editingFarmer && code.trim().length > 0 && (
                                        <View style={s.codeStatus}>
                                            {checkingCode ? <ActivityIndicator size="small" color={colors.primary} /> : codeAvailable === true ? <View style={[s.codeIcon, { backgroundColor: colors.primary + '20' }]}><Check size={16} color={colors.primary} /></View> : codeAvailable === false ? <View style={[s.codeIcon, { backgroundColor: '#ef444420' }]}><X size={16} color="#ef4444" /></View> : null}
                                        </View>
                                    )}
                                </View>
                                {!editingFarmer && codeAvailable === true && <Text style={[s.codeHint, { color: colors.primary }]}>Code available</Text>}
                                {!editingFarmer && codeAvailable === false && <Text style={[s.codeHint, { color: '#ef4444' }]}>Code already taken</Text>}
                            </View>

                            <View style={s.field}>
                                <Text style={s.fieldLabel}>2. Name</Text>
                                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Customer name" placeholderTextColor={colors.mutedForeground} />
                            </View>

                            <View style={s.field}>
                                <Text style={s.fieldLabel}>3. Mobile</Text>
                                <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="Mobile number" placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" maxLength={10} />
                            </View>

                            <View style={s.field}>
                                <Text style={s.fieldLabel}>4. Address</Text>
                                <TextInput style={[s.input, { minHeight: 48, textAlignVertical: 'top' }]} value={address} onChangeText={setAddress} placeholder="Address (optional)" placeholderTextColor={colors.mutedForeground} multiline />
                            </View>

                            <View style={s.field}>
                                <Text style={s.fieldLabel}>5. Default Milk</Text>
                                <View style={s.toggleRow}>
                                    <Pressable style={[s.milkChip, defaultMilk === 'cow' && s.milkChipActive]} onPress={() => setDefaultMilk('cow')}>
                                        {defaultMilk === 'cow' && <Check size={12} color="#fff" style={{ marginRight: 3 }} />}
                                        <Text style={[s.milkChipText, defaultMilk === 'cow' && { color: '#fff' }]}>🐄 Cow</Text>
                                    </Pressable>
                                    <Pressable style={[s.milkChip, defaultMilk === 'buffalo' && s.milkChipActive]} onPress={() => setDefaultMilk('buffalo')}>
                                        {defaultMilk === 'buffalo' && <Check size={12} color="#fff" style={{ marginRight: 3 }} />}
                                        <Text style={[s.milkChipText, defaultMilk === 'buffalo' && { color: '#fff' }]}>🐃 Buffalo</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>

                        <View style={s.sectionCard}>
                            <Text style={s.sectionTitle}>6. Rate Based On</Text>
                            <View style={s.priceBasisRow}>
                                {PRICE_BASIS_OPTIONS.map(opt => (
                                    <Pressable key={opt.value} style={[s.priceBasisChip, priceBasis === opt.value && s.priceBasisChipActive]} onPress={() => setPriceBasis(opt.value as any)}>
                                        {priceBasis === opt.value && <Check size={14} color="#fff" style={{ marginRight: 4 }} />}
                                        <Text style={[s.priceBasisText, priceBasis === opt.value && s.priceBasisTextActive]}>{opt.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View style={s.sectionCard}>
                            <Text style={s.sectionTitle}>7. Alert Method</Text>
                            <View style={s.priceBasisRow}>
                                {ALERT_METHOD_OPTIONS.map(opt => (
                                    <Pressable key={opt.value} style={[s.priceBasisChip, alertMethod === opt.value && s.priceBasisChipActive]} onPress={() => setAlertMethod(opt.value as any)}>
                                        {alertMethod === opt.value && <Check size={14} color="#fff" style={{ marginRight: 4 }} />}
                                        <Text style={[s.priceBasisText, alertMethod === opt.value && s.priceBasisTextActive]}>{opt.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View style={{ height: 20 }} />
                        <Pressable style={s.resetBtn} onPress={resetOtherSettings}><RotateCcw size={16} color="#ef4444" /><Text style={s.resetBtnText}>Reset Settings</Text></Pressable>
                        <Text style={s.resetHint}>Resets Milk, Rate, Alerts. Code, Name, Mobile, Address kept.</Text>
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
    overlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
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
    milkChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    milkChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    milkChipText: { fontSize: 13, fontWeight: '500', color: colors.foreground },
    priceBasisRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    priceBasisChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    priceBasisChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    priceBasisText: { fontSize: 13, fontWeight: '500', color: colors.foreground },
    priceBasisTextActive: { color: '#fff' },
    topActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 2, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
    closeBtn: { width: 30, height: 30, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef444415', borderWidth: 1.5, borderColor: '#ef4444' },
    cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#ef4444', backgroundColor: '#ef444410', marginTop: 4 },
    resetBtnText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
    resetHint: { fontSize: 11, color: colors.mutedForeground, marginTop: 6, textAlign: 'center' },
});
