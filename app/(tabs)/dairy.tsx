import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Droplets, Sun, Moon, Plus, X, Wallet, Check } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import { milkCollectionsApi, paymentsApi, farmersApi, MilkCollection, TodaySummary, Farmer, FarmerPaymentSummary } from '@/lib/milkeyApi';

type TabType = 'Collection' | 'Settlement';

export default function DairyScreen() {
    const { colors, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<TabType>('Collection');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
    const [collections, setCollections] = useState<MilkCollection[]>([]);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [collectionForm, setCollectionForm] = useState({ farmerCode: '', farmerName: '', quantity: '', rate: '60', shift: new Date().getHours() < 12 ? 'morning' : 'evening' });
    const [settlementCode, setSettlementCode] = useState('');
    const [farmerSummary, setFarmerSummary] = useState<FarmerPaymentSummary | null>(null);

    const styles = createStyles(colors, isDark);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [summaryRes, collectionsRes, farmersRes] = await Promise.all([
                milkCollectionsApi.getTodaySummary().catch(() => null),
                milkCollectionsApi.getAll({ limit: 20 }).catch(() => null),
                farmersApi.getAll().catch(() => null),
            ]);
            if (summaryRes?.success) setTodaySummary(summaryRes.response || null);
            if (collectionsRes?.success) setCollections(collectionsRes.response?.data || []);
            if (farmersRes?.success) setFarmers(farmersRes.response?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, []);

    const handleFarmerCodeChange = (code: string) => {
        const farmer = farmers.find(f => f.code === code);
        setCollectionForm(prev => ({ ...prev, farmerCode: code, farmerName: farmer?.name || '' }));
    };

    const handleAddCollection = async () => {
        if (!collectionForm.farmerCode || !collectionForm.quantity || !collectionForm.rate) {
            Alert.alert('Error', 'Please fill farmer code, quantity, and rate'); return;
        }
        setLoading(true);
        const res = await milkCollectionsApi.create({
            farmerCode: collectionForm.farmerCode, quantity: parseFloat(collectionForm.quantity),
            rate: parseFloat(collectionForm.rate), shift: collectionForm.shift as 'morning' | 'evening',
        });
        if (res.success) {
            Alert.alert('Success', 'Milk collection recorded');
            setShowAddModal(false);
            setCollectionForm({ farmerCode: '', farmerName: '', quantity: '', rate: '60', shift: new Date().getHours() < 12 ? 'morning' : 'evening' });
            fetchData();
        } else Alert.alert('Error', res.message || 'Failed');
        setLoading(false);
    };

    const handleFetchSettlement = async () => {
        if (!settlementCode) { Alert.alert('Error', 'Enter farmer code'); return; }
        setLoading(true);
        const res = await paymentsApi.getFarmerSummary(settlementCode);
        if (res.success) setFarmerSummary(res.response || null);
        else { Alert.alert('Error', res.message || 'Not found'); setFarmerSummary(null); }
        setLoading(false);
    };

    const handleSettlePayment = async () => {
        if (!farmerSummary) return;
        Alert.alert('Confirm Payment', `Pay ₹${farmerSummary.netPayable} to ${farmerSummary.farmer.name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Pay', onPress: async () => {
                    setLoading(true);
                    const res = await paymentsApi.create({ farmerCode: farmerSummary.farmer.code, amount: farmerSummary.netPayable });
                    if (res.success) { Alert.alert('Success', 'Payment recorded'); setFarmerSummary(null); setSettlementCode(''); fetchData(); }
                    else Alert.alert('Error', res.message || 'Failed');
                    setLoading(false);
                }
            },
        ]);
    };

    return (
        <View style={styles.container}>
            <TopBar />
            <View style={styles.tabRow}>
                {(['Collection', 'Settlement'] as TabType[]).map(tab => (
                    <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
                        {tab === 'Collection' ? <Droplets size={16} color={activeTab === tab ? colors.white : colors.foreground} /> : <Wallet size={16} color={activeTab === tab ? colors.white : colors.foreground} />}
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                    </Pressable>
                ))}
            </View>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
                {activeTab === 'Collection' ? (
                    <>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryTitle}>Today's Collection</Text>
                            <View style={styles.shiftRow}>
                                <View style={styles.shiftCard}><Sun size={16} color={colors.warning} /><Text style={styles.shiftQty}>{todaySummary?.morning.quantity.toFixed(1) || '0'} L</Text><Text style={styles.shiftAmt}>₹{todaySummary?.morning.amount.toFixed(0) || '0'}</Text></View>
                                <View style={styles.shiftCard}><Moon size={16} color={colors.primary} /><Text style={styles.shiftQty}>{todaySummary?.evening.quantity.toFixed(1) || '0'} L</Text><Text style={styles.shiftAmt}>₹{todaySummary?.evening.amount.toFixed(0) || '0'}</Text></View>
                            </View>
                            <View style={styles.totalRow}><Text style={styles.totalLabel}>Total: {todaySummary?.total.quantity.toFixed(1) || '0'} L</Text><Text style={styles.totalAmt}>₹{todaySummary?.total.amount.toFixed(0) || '0'}</Text></View>
                        </View>
                        <Pressable style={styles.addBtn} onPress={() => setShowAddModal(true)}><Plus size={18} color={colors.white} /><Text style={styles.addBtnText}>Add Collection</Text></Pressable>
                        <Text style={styles.sectionTitle}>Recent Collections</Text>
                        {collections.length > 0 ? collections.slice(0, 10).map(item => (
                            <View key={item._id} style={styles.collectionRow}>
                                <Text style={[styles.collectionCode, { color: colors.primary }]}>{item.farmer?.code}</Text>
                                <Text style={styles.collectionShift}>{item.shift === 'morning' ? '☀️' : '🌙'}</Text>
                                <Text style={styles.collectionQty}>{item.quantity}L</Text>
                                <Text style={[styles.collectionAmt, { color: colors.success }]}>₹{item.amount.toFixed(0)}</Text>
                            </View>
                        )) : <Text style={styles.emptyText}>No collections yet</Text>}
                    </>
                ) : (
                    <>
                        <View style={styles.searchCard}>
                            <Text style={styles.cardTitle}>Find Farmer</Text>
                            <View style={styles.searchRow}>
                                <TextInput style={styles.searchInput} placeholder="Farmer Code" value={settlementCode} onChangeText={setSettlementCode} placeholderTextColor={colors.mutedForeground} />
                                <Pressable style={styles.searchBtn} onPress={handleFetchSettlement}><Text style={styles.searchBtnText}>Go</Text></Pressable>
                            </View>
                        </View>
                        {farmerSummary && (
                            <View style={styles.settlementCard}>
                                <Text style={styles.farmerName}>{farmerSummary.farmer.name} (Code: {farmerSummary.farmer.code})</Text>
                                <View style={styles.summarySection}><Text style={styles.summaryLabel}>Milk Amount</Text><Text style={[styles.summaryValue, { color: colors.success }]}>₹{farmerSummary.milk.totalAmount.toFixed(0)}</Text></View>
                                {farmerSummary.advances.totalPending > 0 && <View style={styles.summarySection}><Text style={styles.summaryLabel}>Advance Deduction</Text><Text style={[styles.summaryValue, { color: colors.warning }]}>-₹{farmerSummary.advances.totalPending.toFixed(0)}</Text></View>}
                                <View style={styles.netRow}><Text style={styles.netLabel}>Net Payable:</Text><Text style={styles.netAmt}>₹{farmerSummary.netPayable.toFixed(0)}</Text></View>
                                {farmerSummary.netPayable > 0 ? <Pressable style={styles.payBtn} onPress={handleSettlePayment}><Wallet size={18} color={colors.white} /><Text style={styles.payBtnText}>Pay ₹{farmerSummary.netPayable.toFixed(0)}</Text></Pressable>
                                    : <View style={styles.clearedBadge}><Check size={18} color={colors.success} /><Text style={styles.clearedText}>All cleared!</Text></View>}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
            <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Add Collection</Text><Pressable onPress={() => setShowAddModal(false)}><X size={20} color={colors.foreground} /></Pressable></View>
                        <View style={styles.modalBody}>
                            <View style={styles.shiftSelector}>
                                <Pressable style={[styles.shiftOpt, collectionForm.shift === 'morning' && styles.shiftOptActive]} onPress={() => setCollectionForm(p => ({ ...p, shift: 'morning' }))}><Sun size={16} color={collectionForm.shift === 'morning' ? colors.white : colors.warning} /><Text style={[styles.shiftOptText, collectionForm.shift === 'morning' && { color: colors.white }]}>Morning</Text></Pressable>
                                <Pressable style={[styles.shiftOpt, collectionForm.shift === 'evening' && styles.shiftOptActive]} onPress={() => setCollectionForm(p => ({ ...p, shift: 'evening' }))}><Moon size={16} color={collectionForm.shift === 'evening' ? colors.white : colors.primary} /><Text style={[styles.shiftOptText, collectionForm.shift === 'evening' && { color: colors.white }]}>Evening</Text></Pressable>
                            </View>
                            <View style={styles.formRow}><TextInput style={[styles.input, { flex: 0.4 }]} placeholder="Code" value={collectionForm.farmerCode} onChangeText={handleFarmerCodeChange} placeholderTextColor={colors.mutedForeground} /><TextInput style={[styles.input, { flex: 1, backgroundColor: colors.muted }]} placeholder="Name" value={collectionForm.farmerName} editable={false} placeholderTextColor={colors.mutedForeground} /></View>
                            <View style={styles.formRow}><TextInput style={styles.input} placeholder="Qty (L)" value={collectionForm.quantity} onChangeText={v => setCollectionForm(p => ({ ...p, quantity: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} /><TextInput style={styles.input} placeholder="Rate" value={collectionForm.rate} onChangeText={v => setCollectionForm(p => ({ ...p, rate: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} /></View>
                            {collectionForm.quantity && collectionForm.rate && <View style={styles.amtPreview}><Text style={styles.amtPreviewText}>Amount: ₹{(parseFloat(collectionForm.quantity || '0') * parseFloat(collectionForm.rate || '0')).toFixed(0)}</Text></View>}
                        </View>
                        <View style={styles.modalFooter}><Pressable style={styles.cancelBtn} onPress={() => setShowAddModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></Pressable><Pressable style={styles.saveBtn} onPress={handleAddCollection}><Text style={styles.saveBtnText}>{loading ? '...' : 'Save'}</Text></Pressable></View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    tabRow: { flexDirection: 'row', paddingHorizontal: 6, gap: 6, marginBottom: 12, marginTop: 4 },
    tab: { flex: 1, flexDirection: 'row', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    tabTextActive: { color: colors.white },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 6, paddingBottom: 80 },
    summaryCard: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 10 },
    shiftRow: { flexDirection: 'row', gap: 10 },
    shiftCard: { flex: 1, backgroundColor: colors.secondary, borderRadius: 8, padding: 10, alignItems: 'center' },
    shiftQty: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginTop: 4 },
    shiftAmt: { fontSize: 13, fontWeight: '600', color: colors.success },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
    totalLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    totalAmt: { fontSize: 16, fontWeight: '700', color: colors.success },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, gap: 6, marginBottom: 16 },
    addBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 8 },
    collectionRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 8, padding: 10, marginBottom: 6, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    collectionCode: { flex: 1, fontSize: 13, fontWeight: '600' },
    collectionShift: { fontSize: 14, marginHorizontal: 8 },
    collectionQty: { fontSize: 13, color: colors.foreground, marginRight: 10 },
    collectionAmt: { fontSize: 14, fontWeight: '700' },
    emptyText: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: 30 },
    searchCard: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    cardTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 10 },
    searchRow: { flexDirection: 'row', gap: 8 },
    searchInput: { flex: 1, backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.foreground },
    searchBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' },
    searchBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
    settlementCard: { backgroundColor: colors.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border },
    farmerName: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
    summarySection: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    summaryLabel: { fontSize: 13, color: colors.mutedForeground },
    summaryValue: { fontSize: 14, fontWeight: '600' },
    netRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 },
    netLabel: { fontSize: 15, fontWeight: '600', color: colors.foreground },
    netAmt: { fontSize: 22, fontWeight: '700', color: colors.primary },
    payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success, borderRadius: 8, paddingVertical: 12, gap: 8, marginTop: 8 },
    payBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    clearedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success + '15', borderRadius: 8, paddingVertical: 12, gap: 6, marginTop: 8 },
    clearedText: { color: colors.success, fontSize: 14, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    modalBody: { padding: 16 },
    modalFooter: { flexDirection: 'row', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
    shiftSelector: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    shiftOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
    shiftOptActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    shiftOptText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    formRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    input: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.foreground },
    amtPreview: { backgroundColor: colors.success + '15', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    amtPreviewText: { fontSize: 16, fontWeight: '700', color: colors.success },
    cancelBtn: { flex: 1, backgroundColor: colors.muted, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    cancelBtnText: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
    saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    saveBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
});
