import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
    ArrowDownLeft,
    ArrowLeft,
    ArrowUpRight,
    CheckCircle2,
    Clock3,
    History,
    Lock,
    Plus,
    Search,
    Trash2,
    Users,
    Wallet,
    X,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { useSubscriptionCheck } from '@/hooks/useSubscriptionCheck';
import { membersApi, Member } from '@/lib/milkeyApi';
import {
    remainingSellingAdvance,
    sellingAdvancesApi,
    SellingAdvance,
    SellingAdvanceSummary,
    SellingAdvanceType,
} from '@/lib/sellingAdvancesApi';

const GREEN_DARK = '#087A3D';
const ORANGE = '#C77700';

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

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY_SUMMARY: SellingAdvanceSummary = {
    totalGiven: 0,
    adjusted: 0,
    pendingGiven: 0,
    advancePending: 0,
};

export default function SellingAdvanceScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const {
        hasAccess,
        loading: subscriptionLoading,
        showSubscriptionModal,
        setShowSubscriptionModal,
        handleModalClose,
        handleSubscriptionSuccess,
    } = useSubscriptionCheck('selling');

    const [members, setMembers] = useState<Member[]>([]);
    const [advances, setAdvances] = useState<SellingAdvance[]>([]);
    const [summary, setSummary] = useState<SellingAdvanceSummary>(EMPTY_SUMMARY);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<'all' | SellingAdvanceType>('all');
    const [search, setSearch] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [form, setForm] = useState<{
        memberId: string;
        amount: string;
        type: SellingAdvanceType;
        date: string;
        note: string;
    }>({ memberId: '', amount: '', type: 'given', date: todayIso(), note: '' });

    const load = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError('');
        try {
            const [membersRes, advancesRes] = await Promise.all([
                membersApi.getAll({ limit: 100, includeInactive: false }),
                sellingAdvancesApi.getAll({ limit: 200, status: 'all' }),
            ]);
            if (membersRes.success && membersRes.response?.data) {
                setMembers(membersRes.response.data);
            } else {
                setMembers([]);
            }
            if (advancesRes.success && advancesRes.response) {
                setAdvances(advancesRes.response.data || []);
                setSummary(advancesRes.response.summary || EMPTY_SUMMARY);
            } else {
                setError(advancesRes.message || 'Could not load selling advances.');
                setAdvances([]);
                setSummary(EMPTY_SUMMARY);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void load(false);
    }, [load]);

    const memberName = useCallback((advance: SellingAdvance) => {
        if (advance.member && typeof advance.member === 'object') return advance.member.name || 'Customer';
        const found = members.find((m) => m._id === String(advance.member));
        return found?.name || 'Customer';
    }, [members]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return advances.filter((advance) => {
            if (filter !== 'all' && advance.type !== filter) return false;
            if (!q) return true;
            const name = memberName(advance).toLowerCase();
            return name.includes(q) || String(advance.note || '').toLowerCase().includes(q);
        });
    }, [advances, filter, search, memberName]);

    const openAddModal = useCallback(() => {
        if (!hasAccess) {
            setShowSubscriptionModal(true);
            return;
        }
        setForm({
            memberId: members[0]?._id || '',
            amount: '',
            type: 'given',
            date: todayIso(),
            note: '',
        });
        setModalVisible(true);
    }, [hasAccess, members, setShowSubscriptionModal]);

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
            setModalVisible(false);
            setForm({ memberId: '', amount: '', type: 'given', date: todayIso(), note: '' });
            await load(false);
            Alert.alert('Saved', form.type === 'adjusted' ? 'Advance adjustment saved.' : 'Selling advance added.');
        } else if (result.code === 'SUBSCRIPTION_REQUIRED') {
            setShowSubscriptionModal(true);
        } else {
            Alert.alert('Could not save', result.message || 'Please try again.');
        }
    }, [form, hasAccess, load, setShowSubscriptionModal]);

    const settle = useCallback((advance: SellingAdvance) => {
        const remaining = remainingSellingAdvance(advance);
        if (remaining <= 0) return;
        if (!hasAccess) {
            setShowSubscriptionModal(true);
            return;
        }
        Alert.alert(
            'Settle advance?',
            `Settle ${money(remaining)} for ${memberName(advance)}? This only updates the new selling advance ledger.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Settle',
                    style: 'default',
                    onPress: () => {
                        void (async () => {
                            setBusyId(advance._id);
                            const result = await sellingAdvancesApi.settle(advance._id, remaining);
                            setBusyId(null);
                            if (result.success) {
                                await load(false);
                            } else if (result.code === 'SUBSCRIPTION_REQUIRED') {
                                setShowSubscriptionModal(true);
                            } else {
                                Alert.alert('Could not settle', result.message || 'Please try again.');
                            }
                        })();
                    },
                },
            ],
        );
    }, [hasAccess, load, memberName, setShowSubscriptionModal]);

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

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void load(true);
    }, [load]);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style="light" />
            <LinearGradient
                colors={[colors.primary, GREEN_DARK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    paddingTop: insets.top + 12,
                    paddingBottom: 18,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomLeftRadius: 20,
                    borderBottomRightRadius: 20,
                }}
            >
                <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 42 }}>
                    <ArrowLeft size={22} color="#fff" />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 19, fontWeight: '900', color: '#fff' }}>Selling Advance</Text>
                    <Text style={{ fontSize: 10, color: '#D8F7E4', marginTop: 2 }}>Isolated customer advance ledger</Text>
                </View>
                <Pressable
                    onPress={openAddModal}
                    hitSlop={10}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#ffffff25',
                        borderRadius: 999,
                        paddingHorizontal: 11,
                        paddingVertical: 8,
                    }}
                >
                    {!hasAccess && !subscriptionLoading ? <Lock size={13} color="#fff" style={{ marginRight: 5 }} /> : <Plus size={15} color="#fff" />}
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff', marginLeft: 4 }}>Add</Text>
                </Pressable>
            </LinearGradient>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: Math.max(insets.bottom + 28, 36) }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ flexDirection: 'row', marginHorizontal: -3 }}>
                    {[
                        { label: 'Advance Pending', value: money(summary.advancePending), icon: Clock3, tone: 'orange' as const },
                        { label: 'Total Given', value: money(summary.totalGiven), icon: Wallet, tone: 'green' as const },
                        { label: 'Adjusted', value: money(summary.adjusted), icon: History, tone: 'wallet' as const },
                    ].map((card) => {
                        const Icon = card.icon;
                        const bg = card.tone === 'orange' ? '#FFF6DF' : card.tone === 'wallet' ? '#EAF7F1' : '#EDF9F1';
                        return (
                            <View key={card.label} style={{
                                flex: 1,
                                backgroundColor: colors.card,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 10,
                                marginHorizontal: 3,
                            }}>
                                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', marginBottom: 7 }}>
                                    <Icon size={14} color={card.tone === 'orange' ? ORANGE : GREEN_DARK} />
                                </View>
                                <Text numberOfLines={1} style={{ fontSize: 9.5, color: colors.mutedForeground, fontWeight: '700' }}>{card.label}</Text>
                                <Text numberOfLines={1} style={{ fontSize: 14, color: colors.foreground, fontWeight: '900', marginTop: 2 }}>{card.value}</Text>
                            </View>
                        );
                    })}
                </View>

                <View style={{
                    marginTop: 12,
                    paddingHorizontal: 11,
                    paddingVertical: 9,
                    borderRadius: 10,
                    backgroundColor: colors.primary + '0D',
                    borderWidth: 1,
                    borderColor: colors.primary + '22',
                    flexDirection: 'row',
                    alignItems: 'center',
                }}>
                    <CheckCircle2 size={14} color={colors.primary} />
                    <Text style={{ flex: 1, marginLeft: 7, fontSize: 10.5, color: colors.mutedForeground }}>
                        Old selling entries, payments and customer balances are never modified by this screen.
                    </Text>
                </View>

                {!hasAccess && !subscriptionLoading && (
                    <Pressable onPress={() => setShowSubscriptionModal(true)} style={{
                        marginTop: 10,
                        backgroundColor: '#FFF6DF',
                        borderWidth: 1,
                        borderColor: '#F2D48A',
                        borderRadius: 10,
                        padding: 11,
                    }}>
                        <Text style={{ fontSize: 11, color: ORANGE, fontWeight: '700' }}>
                            Active Selling subscription is required to add, settle or delete advances. Tap to view plans.
                        </Text>
                    </Pressable>
                )}

                <View style={{
                    marginTop: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    height: 42,
                }}>
                    <Search size={15} color={colors.mutedForeground} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search customer or note"
                        placeholderTextColor={colors.mutedForeground + '99'}
                        style={{ flex: 1, marginLeft: 8, color: colors.foreground, fontSize: 12 }}
                    />
                </View>

                <View style={{ flexDirection: 'row', marginTop: 10, gap: 6 }}>
                    {(['all', 'given', 'adjusted'] as const).map((item) => {
                        const active = filter === item;
                        return (
                            <Pressable
                                key={item}
                                onPress={() => setFilter(item)}
                                style={{
                                    paddingHorizontal: 13,
                                    paddingVertical: 8,
                                    borderRadius: 999,
                                    backgroundColor: active ? colors.primary : colors.card,
                                    borderWidth: 1,
                                    borderColor: active ? colors.primary : colors.border,
                                }}
                            >
                                <Text style={{ fontSize: 11, fontWeight: '800', color: active ? '#fff' : colors.foreground }}>
                                    {item === 'all' ? 'All' : item === 'given' ? 'Given' : 'Adjusted'}
                                </Text>
                            </Pressable>
                        );
                    })}
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
                            Use the Add button to create a selling customer advance or adjustment.
                        </Text>
                    </View>
                ) : filtered.map((advance) => {
                    const remaining = remainingSellingAdvance(advance);
                    const adjusted = advance.type === 'adjusted';
                    const Arrow = adjusted || advance.status === 'settled' ? ArrowUpRight : ArrowDownLeft;
                    return (
                        <View key={advance._id} style={{
                            backgroundColor: colors.card,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: 12,
                            marginTop: 10,
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    backgroundColor: adjusted ? '#EAF7F1' : '#FFF6DF',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 9,
                                }}>
                                    <Arrow size={16} color={adjusted ? GREEN_DARK : ORANGE} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '800', color: colors.foreground }}>
                                        {memberName(advance)}
                                    </Text>
                                    <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>
                                        {dateLabel(advance.date)} • {adjusted ? 'Adjusted' : advance.status === 'settled' ? 'Settled' : 'Given'}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 15, fontWeight: '900', color: colors.foreground }}>{money(advance.amount)}</Text>
                            </View>
                            {!!advance.note && (
                                <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 9 }}>{advance.note}</Text>
                            )}
                            <View style={{
                                marginTop: 9,
                                paddingTop: 9,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                                flexDirection: 'row',
                                alignItems: 'center',
                            }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
                                        Remaining: <Text style={{ fontWeight: '800', color: colors.foreground }}>{money(remaining)}</Text>
                                    </Text>
                                </View>
                                {remaining > 0 && (
                                    <Pressable
                                        onPress={() => settle(advance)}
                                        disabled={busyId === advance._id}
                                        style={{
                                            paddingHorizontal: 11,
                                            paddingVertical: 7,
                                            borderRadius: 8,
                                            backgroundColor: colors.primary + '14',
                                            marginRight: 6,
                                        }}
                                    >
                                        <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.primary }}>Settle</Text>
                                    </Pressable>
                                )}
                                <Pressable
                                    onPress={() => remove(advance)}
                                    disabled={busyId === advance._id}
                                    style={{ padding: 7, borderRadius: 8, backgroundColor: '#FEECEC' }}
                                >
                                    {busyId === advance._id ? (
                                        <ActivityIndicator size="small" color={colors.destructive} />
                                    ) : (
                                        <Trash2 size={14} color={colors.destructive} />
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            <SubscriptionModal
                visible={showSubscriptionModal}
                onClose={handleModalClose}
                onSubscribe={handleSubscriptionSuccess}
                filterTab="selling"
                title="Selling subscription required"
            />

            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}
                >
                    <Pressable style={{ flex: 1 }} onPress={() => setModalVisible(false)} />
                    <View style={{
                        backgroundColor: colors.card,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        padding: 16,
                        paddingBottom: Math.max(insets.bottom + 16, 20),
                        maxHeight: '88%',
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 17, fontWeight: '900', color: colors.foreground }}>Add Selling Advance</Text>
                                <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>
                                    Creates a new isolated ledger record only.
                                </Text>
                            </View>
                            <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                                <X size={20} color={colors.mutedForeground} />
                            </Pressable>
                        </View>

                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.foreground, marginBottom: 6 }}>Customer</Text>
                        {members.length === 0 ? (
                            <View style={{ padding: 12, backgroundColor: colors.muted, borderRadius: 9 }}>
                                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                                    No active selling customers found. Add a customer in the Selling tab first.
                                </Text>
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                {members.map((member) => {
                                    const active = form.memberId === member._id;
                                    return (
                                        <Pressable
                                            key={member._id}
                                            onPress={() => setForm((prev) => ({ ...prev, memberId: member._id }))}
                                            style={{
                                                paddingHorizontal: 11,
                                                paddingVertical: 8,
                                                borderRadius: 999,
                                                marginRight: 6,
                                                backgroundColor: active ? colors.primary : colors.card,
                                                borderWidth: 1,
                                                borderColor: active ? colors.primary : colors.border,
                                            }}
                                        >
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#fff' : colors.foreground }}>
                                                {member.name}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        )}

                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.foreground, marginBottom: 6 }}>Type</Text>
                        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                            {(['given', 'adjusted'] as const).map((type) => {
                                const active = form.type === type;
                                return (
                                    <Pressable
                                        key={type}
                                        onPress={() => setForm((prev) => ({ ...prev, type }))}
                                        style={{
                                            flex: 1,
                                            paddingVertical: 10,
                                            alignItems: 'center',
                                            borderRadius: 9,
                                            marginRight: type === 'given' ? 6 : 0,
                                            backgroundColor: active ? colors.primary : colors.muted,
                                            borderWidth: 1,
                                            borderColor: active ? colors.primary : colors.border,
                                        }}
                                    >
                                        <Text style={{ fontSize: 11.5, fontWeight: '800', color: active ? '#fff' : colors.foreground }}>
                                            {type === 'given' ? 'Given ↓' : 'Adjusted ↑'}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.foreground, marginBottom: 6 }}>Amount (₹)</Text>
                        <TextInput
                            value={form.amount}
                            onChangeText={(text) => setForm((prev) => ({ ...prev, amount: text.replace(/[^0-9.]/g, '') }))}
                            keyboardType="numeric"
                            placeholder="e.g. 1200"
                            placeholderTextColor={colors.mutedForeground + '99'}
                            style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 9,
                                paddingHorizontal: 11,
                                paddingVertical: Platform.OS === 'ios' ? 11 : 9,
                                color: colors.foreground,
                                fontSize: 13,
                                marginBottom: 10,
                            }}
                        />

                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.foreground, marginBottom: 6 }}>Date (YYYY-MM-DD)</Text>
                        <TextInput
                            value={form.date}
                            onChangeText={(text) => setForm((prev) => ({ ...prev, date: text }))}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={colors.mutedForeground + '99'}
                            style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 9,
                                paddingHorizontal: 11,
                                paddingVertical: Platform.OS === 'ios' ? 11 : 9,
                                color: colors.foreground,
                                fontSize: 13,
                                marginBottom: 10,
                            }}
                        />

                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.foreground, marginBottom: 6 }}>Remark</Text>
                        <TextInput
                            value={form.note}
                            onChangeText={(text) => setForm((prev) => ({ ...prev, note: text }))}
                            placeholder="Medicine, milk adjustment, feed purchase..."
                            placeholderTextColor={colors.mutedForeground + '99'}
                            style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 9,
                                paddingHorizontal: 11,
                                paddingVertical: Platform.OS === 'ios' ? 11 : 9,
                                color: colors.foreground,
                                fontSize: 13,
                                marginBottom: 14,
                            }}
                        />

                        <Pressable
                            onPress={() => void submit()}
                            disabled={saving || members.length === 0}
                            style={{
                                backgroundColor: colors.primary,
                                borderRadius: 10,
                                paddingVertical: 12,
                                alignItems: 'center',
                                opacity: saving || members.length === 0 ? 0.6 : 1,
                            }}
                        >
                            {saving ? <ActivityIndicator color="#fff" /> : (
                                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Save Advance</Text>
                            )}
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
