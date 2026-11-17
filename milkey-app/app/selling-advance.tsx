import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import TopBar from '@/components/TopBar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
    Home,
    Droplets,
    Store,
    Package,
    User,
    Search,
    Trash2,
    Users,
    CalendarDays,
    FileText,
    Printer,
    X,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { useSubscriptionCheck } from '@/hooks/useSubscriptionCheck';
import { membersApi, Member } from '@/lib/milkeyApi';
import { Calendar } from '@/components/Calendar';
import AmountFilterIcon from '@/components/AmountFilterIcon';
import {
    remainingSellingAdvance,
    sellingAdvancesApi,
    SellingAdvance,
    SellingAdvanceType,
} from '@/lib/sellingAdvancesApi';

const money = (value: number | string | undefined) => {
    const n = Number(value || 0);
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const dateLabel = (value?: string) => {
    if (!value) return '--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const shortDateLabel = (value?: string) => {
    if (!value) return '--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function SellingAdvanceScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const {
        hasAccess,
        showSubscriptionModal,
        setShowSubscriptionModal,
        handleModalClose,
        handleSubscriptionSuccess,
    } = useSubscriptionCheck('selling');

    const [members, setMembers] = useState<Member[]>([]);
    const [advances, setAdvances] = useState<SellingAdvance[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPending, setTotalPending] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [customerQuery, setCustomerQuery] = useState('');
    const [amountSort, setAmountSort] = useState<'asc' | 'desc' | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [form, setForm] = useState<{
        memberId: string;
        amount: string;
        type: SellingAdvanceType;
        date: string;
        note: string;
    }>({ memberId: '', amount: '', type: 'given', date: todayIso(), note: '' });

    const load = useCallback(async (isRefresh = false, page = 1, append = false) => {
        if (append) setLoadingMore(true);
        else if (!isRefresh) setLoading(true);
        setError('');
        try {
            const [membersRes, advancesRes] = await Promise.all([
                membersApi.getAll({ limit: 100, includeInactive: false }),
                sellingAdvancesApi.getAll({ limit: 10, page, status: 'all', search: search.trim() || undefined, sortBy: amountSort ? 'amount' : undefined, order: amountSort || undefined }),
            ]);
            if (membersRes.success && membersRes.response?.data) {
                setMembers(membersRes.response.data);
            } else {
                setMembers([]);
            }
            if (advancesRes.success && advancesRes.response) {
                const data = advancesRes.response.data || [];
                setAdvances((current) => append ? [...current, ...data] : data);
                setTotalCount(advancesRes.response.total || 0);
                setTotalPending(advancesRes.response.summary?.advancePending || 0);
                setHasMore(page < (advancesRes.response.pagination?.pages || 1));
            } else {
                setError(advancesRes.message || 'Could not load selling advances.');
                setAdvances([]);
                setTotalCount(0);
                setTotalPending(0);
                setHasMore(false);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [amountSort, search]);

    useEffect(() => {
        const timer = setTimeout(() => void load(false), search ? 300 : 0);
        return () => clearTimeout(timer);
    }, [load, search, amountSort]);

    const memberName = useCallback((advance: SellingAdvance) => {
        if (advance.member && typeof advance.member === 'object') return advance.member.name || 'Customer';
        const found = members.find((m) => m._id === String(advance.member));
        return found?.name || 'Customer';
    }, [members]);

    const customerSuggestions = useMemo(() => {
        const query = customerQuery.trim().toLowerCase();
        if (!query || form.memberId) return [];
        return members.filter((member) => member.name.toLowerCase().includes(query) || String(member.mobile || '').includes(query)).slice(0, 8);
    }, [customerQuery, form.memberId, members]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const rows = advances.filter((advance) => {
            if (!q) return true;
            const name = memberName(advance).toLowerCase();
            return name.includes(q) || String(advance.note || '').toLowerCase().includes(q);
        });
        if (amountSort) rows.sort((a, b) => amountSort === 'asc' ? Number(a.amount) - Number(b.amount) : Number(b.amount) - Number(a.amount));
        return rows;
    }, [advances, search, memberName, amountSort]);

    const clearForm = useCallback(() => {
        setForm({ memberId: '', amount: '', type: 'given', date: todayIso(), note: '' });
        setCustomerQuery('');
    }, []);


    const submit = useCallback(async () => {
        if (!form.memberId) {
            Alert.alert('Select customer', 'Please choose a selling customer first.');
            return;
        }
        const amount = Number(form.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            Alert.alert('Invalid amount', 'Please enter an amount greater than zero.');
            return;
        }
        if (!hasAccess) {
            setShowSubscriptionModal(true);
            return;
        }
        setSaving(true);
        const result = await sellingAdvancesApi.create({
            memberId: form.memberId,
            amount,
            type: form.type,
            date: form.date || undefined,
            note: form.note.trim() || undefined,
        });
        setSaving(false);
        if (result.success) {
            clearForm();
            await load(false);
            Alert.alert('Saved', form.type === 'adjusted' ? 'Advance adjustment saved.' : 'Selling advance added.');
        } else if (result.code === 'SUBSCRIPTION_REQUIRED') {
            setShowSubscriptionModal(true);
        } else {
            Alert.alert('Could not save', result.message || 'Please try again.');
        }
    }, [form, hasAccess, load, setShowSubscriptionModal, clearForm]);

    const remove = useCallback((advance: SellingAdvance) => {
        if (!hasAccess) {
            setShowSubscriptionModal(true);
            return;
        }
        Alert.alert(
            'Delete advance?',
            'This removes only the isolated selling advance record. Old selling data will not change.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        void (async () => {
                            setBusyId(advance._id);
                            const result = await sellingAdvancesApi.remove(advance._id);
                            setBusyId(null);
                            if (result.success) {
                                await load(false);
                            } else if (result.code === 'SUBSCRIPTION_REQUIRED') {
                                setShowSubscriptionModal(true);
                            } else {
                                Alert.alert('Could not delete', result.message || 'Please try again.');
                            }
                        })();
                    },
                },
            ],
        );
    }, [hasAccess, load, setShowSubscriptionModal]);

    const reportHtml = useCallback(() => {
        const rows = filtered.map((advance) => `<tr><td>${memberName(advance)}</td><td>${advance.note || '-'}</td><td>₹${Number(advance.amount || 0).toLocaleString('en-IN')}</td><td>${dateLabel(advance.date)}</td><td>${remainingSellingAdvance(advance) > 0 ? 'Pending' : 'Settled'}</td></tr>`).join('');
        return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:Arial,sans-serif;padding:20px}h2{text-align:center;color:#168548}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:center}th{background:#168548;color:white}tr:nth-child(even){background:#f5f5f5}</style></head><body><h2>Selling Advances Report</h2><p>Total records: ${filtered.length}</p><table><thead><tr><th>Customer</th><th>Note</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    }, [filtered, memberName]);

    const exportPdf = useCallback(async () => {
        try {
            const { uri } = await Print.printToFileAsync({ html: reportHtml() });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
            else Alert.alert('PDF generated', uri);
        } catch {
            Alert.alert('Error', 'Failed to generate advances PDF.');
        }
    }, [reportHtml]);

    const printReport = useCallback(async () => {
        try { await Print.printAsync({ html: reportHtml() }); }
        catch { Alert.alert('Error', 'Failed to print advances.'); }
    }, [reportHtml]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void load(true);
    }, [load]);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <TopBar />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: Math.max(insets.bottom + 28, 36) }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.foreground, marginBottom: 6 }}>Customer</Text>
                    <View style={{ position: 'relative', zIndex: 10, marginBottom: 8 }}>
                        <TextInput
                            value={customerQuery}
                            onChangeText={(value) => {
                                setCustomerQuery(value);
                                setForm((prev) => ({ ...prev, memberId: '' }));
                            }}
                            placeholder={members.length ? 'Name or mobile number' : 'Add a selling customer first'}
                            placeholderTextColor={colors.mutedForeground}
                            autoCapitalize="none"
                            style={{ borderWidth: 1.2, borderColor: '#9CA3AF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, color: colors.foreground, fontSize: 14, backgroundColor: colors.card }}
                        />
                        {customerSuggestions.length > 0 && (
                            <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 3, overflow: 'hidden', elevation: 8, zIndex: 20 }}>
                                {customerSuggestions.map((member, index) => (
                                    <Pressable key={member._id} onPress={() => {
                                        setForm((prev) => ({ ...prev, memberId: member._id }));
                                        setCustomerQuery(member.name);
                                    }} style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: colors.border }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.foreground }}>{member.name}</Text>
                                        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{member.mobile || 'No mobile number'}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.foreground, marginBottom: 5 }}>Amount</Text>
                            <TextInput value={form.amount} onChangeText={(value) => setForm((prev) => ({ ...prev, amount: value.replace(/[^0-9.]/g, '') }))} keyboardType="numeric" placeholder="Amount" placeholderTextColor={colors.mutedForeground} style={{ borderWidth: 1.2, borderColor: '#9CA3AF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 14, backgroundColor: colors.card }} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.foreground, marginBottom: 5 }}>Date</Text>
                            <Pressable onPress={() => setShowDatePicker(true)} style={{ borderWidth: 1.2, borderColor: '#9CA3AF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card }}>
                                <Text style={{ color: colors.foreground, fontSize: 12 }}>{new Date(`${form.date}T00:00:00`).toLocaleDateString('en-GB')}</Text>
                                <CalendarDays size={15} color={colors.mutedForeground} />
                            </Pressable>
                        </View>
                    </View>
                    <View style={{ marginTop: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.foreground, marginBottom: 5 }}>Note</Text>
                        <TextInput value={form.note} onChangeText={(value) => setForm((prev) => ({ ...prev, note: value }))} placeholder="Note (e.g. Feed, medicine)" placeholderTextColor={colors.mutedForeground} style={{ borderWidth: 1.2, borderColor: '#9CA3AF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 14, backgroundColor: colors.card }} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <Pressable onPress={() => void submit()} disabled={saving || !form.memberId} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center', opacity: saving || !form.memberId ? 0.6 : 1 }}>
                            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={{ color: colors.white, fontSize: 12, fontWeight: '800' }}>Save Advance</Text>}
                        </Pressable>
                        <Pressable onPress={clearForm} style={{ borderWidth: 1.2, borderColor: '#9CA3AF', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.card }}>
                            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>Clear</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, marginBottom: 12 }}>
                    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.2, borderColor: '#9CA3AF', borderRadius: 6, paddingHorizontal: 9, height: 42 }}>
                        <Search size={15} color={colors.mutedForeground} />
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Search customer or note"
                            placeholderTextColor={colors.mutedForeground + '99'}
                            style={{ flex: 1, minWidth: 0, marginLeft: 7, color: colors.foreground, fontSize: 12 }}
                        />
                        {!!search && <Pressable onPress={() => setSearch('')} hitSlop={8}><X size={14} color={colors.mutedForeground} /></Pressable>}
                    </View>
                    <Pressable onPress={() => void exportPdf()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#EAAA00', borderRadius: 6, paddingHorizontal: 10, height: 42 }}>
                        <FileText size={15} color={colors.white} /><Text style={{ fontSize: 11, fontWeight: '700', color: colors.white }}>PDF</Text>
                    </Pressable>
                    <Pressable onPress={() => void printReport()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 10, height: 42 }}>
                        <Printer size={15} color={colors.white} /><Text style={{ fontSize: 11, fontWeight: '700', color: colors.white }}>Print</Text>
                    </Pressable>
                    <AmountFilterIcon sort={amountSort} onToggle={() => setAmountSort((prev) => prev === 'asc' ? 'desc' : 'asc')} />
                </View>


                <View style={{ marginTop: 2, marginBottom: 10, padding: 11, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primary + '15', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Total Records</Text>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{totalCount} records • {advances.length} shown</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Total Amount</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>{money(totalPending)}</Text>
                    </View>
                </View>


                {loading ? (
                    <View style={{ padding: 28, alignItems: 'center' }}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 10 }}>Loading advances...</Text>
                    </View>
                ) : !!error ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center' }}>{error}</Text>
                        <Pressable onPress={() => void load(false)} style={{ marginTop: 12, backgroundColor: colors.primary, borderRadius: 9, paddingHorizontal: 16, paddingVertical: 9 }}>
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Retry</Text>
                        </Pressable>
                    </View>
                ) : filtered.length === 0 ? (
                    <View style={{ padding: 28, alignItems: 'center' }}>
                        <Users size={28} color={colors.mutedForeground} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.foreground, marginTop: 10 }}>No advances yet</Text>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
                            Add a selling customer advance using the form above.
                        </Text>
                    </View>
                ) : (
                    <View style={{ borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#DDF3E7', backgroundColor: colors.card, marginTop: 10 }}>
                        <View style={{ flexDirection: 'row', backgroundColor: '#F7FCF9', paddingVertical: 10, paddingHorizontal: 7 }}>
                            {[['Customer', 1.25], ['Note', 1], ['Amt', 0.8], ['Date', 0.9], ['Del', 0.55]].map(([label, flex]: any) => (
                                <Text key={label} style={{ flex, fontSize: 12, fontWeight: '600', color: colors.foreground, textAlign: 'center' }}>{label}</Text>
                            ))}
                        </View>
                        {filtered.map((advance) => (
                            <View key={advance._id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 7, borderTopWidth: 1, borderTopColor: '#E5F3EA' }}>
                                <Text numberOfLines={1} style={{ flex: 1.25, fontSize: 12, fontWeight: '600', color: colors.foreground, textAlign: 'center' }}>{memberName(advance)}</Text>
                                <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: colors.foreground, textAlign: 'center' }}>{advance.note || '-'}</Text>
                                <Text numberOfLines={1} style={{ flex: 0.8, fontSize: 12, fontWeight: '700', color: '#D5A700', textAlign: 'center' }}>{money(advance.amount)}</Text>
                                <Text numberOfLines={1} style={{ flex: 0.9, fontSize: 12, color: colors.foreground, textAlign: 'center' }}>{shortDateLabel(advance.date)}</Text>
                                <View style={{ flex: 0.55, alignItems: 'center', justifyContent: 'center' }}>
                                    <Pressable onPress={() => remove(advance)} disabled={busyId === advance._id} style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: '#FEEAEC', alignItems: 'center', justifyContent: 'center' }}>
                                        {busyId === advance._id ? <ActivityIndicator size="small" color={colors.destructive} /> : <Trash2 size={17} color={colors.destructive} />}
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
                {hasMore && !loading && !error && (
                    <Pressable onPress={() => void load(false, Math.ceil(advances.length / 10) + 1, true)} disabled={loadingMore} style={{ padding: 11, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 8, backgroundColor: colors.card }}>
                        {loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>Load More ({totalCount - advances.length} remaining)</Text>}
                    </Pressable>
                )}
            </ScrollView>

            <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
                <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowDatePicker(false)} />
                    <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: Math.max(insets.bottom + 16, 20) }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.foreground }}>Select Advance Date</Text>
                            <Pressable onPress={() => setShowDatePicker(false)}><X size={20} color={colors.foreground} /></Pressable>
                        </View>
                        <Calendar onDateSelect={(date) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); setForm((prev) => ({ ...prev, date: `${year}-${month}-${day}` })); setShowDatePicker(false); }} selectedDate={new Date(`${form.date}T00:00:00`)} />
                    </View>
                </View>
            </Modal>

            <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, paddingBottom: insets.bottom + 6, height: 65 + insets.bottom }}>
                {[
                    { label: 'Home', Icon: Home, route: '/(tabs)' },
                    { label: 'Collection', Icon: Droplets, route: '/(tabs)/purchase' },
                    { label: 'Selling', Icon: Store, route: '/(tabs)/selling', active: true },
                    { label: 'Inventory', Icon: Package, route: '/(tabs)/inventory' },
                    { label: 'Profile', Icon: User, route: '/(tabs)/profile' },
                ].map(({ label, Icon, route, active }) => (
                    <Pressable key={label} onPress={() => router.replace(route as any)} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                        <View style={{ backgroundColor: active ? colors.primary : 'transparent', width: active ? 38 : 32, height: active ? 38 : 32, borderRadius: active ? 19 : 16, alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={active ? 20 : 22} color={active ? '#fff' : colors.mutedForeground} strokeWidth={active ? 2.6 : 2} />
                        </View>
                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: active ? '700' : '500', color: active ? colors.primary : colors.mutedForeground, marginTop: 1 }}>{label}</Text>
                    </Pressable>
                ))}
            </View>

            <SubscriptionModal
                visible={showSubscriptionModal}
                onClose={handleModalClose}
                onSubscribe={handleSubscriptionSuccess}
                filterTab="selling"
                title="Selling subscription required"
            />
        </View>
    );
}
