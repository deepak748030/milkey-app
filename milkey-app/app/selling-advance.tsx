import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
    ArrowLeft,
    Calendar as CalendarIcon,
    CheckCircle2,
    FileText,
    Lock,
    Printer,
    Search,
    Trash2,
    X,
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Calendar } from '@/components/Calendar';
import AmountFilterIcon from '@/components/AmountFilterIcon';
import { useTheme } from '@/hooks/useTheme';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { useSubscriptionCheck } from '@/hooks/useSubscriptionCheck';
import { membersApi, Member } from '@/lib/milkeyApi';
import {
    remainingSellingAdvance,
    sellingAdvancesApi,
    SellingAdvance,
    SellingAdvanceSummary,
} from '@/lib/sellingAdvancesApi';

/**
 * Selling Advance — UI mirrors Collection / Register → Advances.
 *
 * Data stays in the isolated SellingAdvance ledger only. No Member,
 * SellingEntry, MemberPayment, Farmer, or existing Advance record is written.
 */

const PAGE_SIZE = 20;

const EMPTY_SUMMARY: SellingAdvanceSummary = {
    totalGiven: 0,
    adjusted: 0,
    pendingGiven: 0,
    advancePending: 0,
};

type CodedMember = Member & { code: string };

const pad2 = (value: number) => String(value).padStart(2, '0');

const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const money = (value: number | string | undefined) => {
    const n = Number(value || 0);
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const shortDate = (value?: string) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const formatDateDDMMYYYY = (value?: string) => {
    if (!value) return 'Select Date';
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return value;
    return `${pad2(d)}/${pad2(m)}/${String(y).slice(-2)}`;
};

const escapeHtml = (value: unknown) => {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };
    return String(value ?? '').replace(/[&<>"']/g, (ch) => map[ch] || ch);
};

const memberIdOf = (advance: SellingAdvance) => {
    if (typeof advance.member === 'string') return advance.member;
    return String((advance.member as any)?._id || '');
};

const statusFor = (advance: SellingAdvance) => {
    if (advance.type === 'adjusted') return 'Adjusted';
    if (advance.status === 'settled') return 'Settled';
    if (advance.status === 'partial') return 'Partial';
    return 'Given';
};

const isSettledAdvance = (advance: SellingAdvance) =>
    advance.type === 'adjusted' || advance.status === 'settled' || advance.status === 'partial';

const noteFor = (advance: SellingAdvance) =>
    String(advance.note || '').trim() || (advance.type === 'adjusted' ? 'Adjusted' : '-');

export default function SellingAdvanceScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const s = createStyles(colors, isDark);
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

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);

    const [search, setSearch] = useState('');
    const [amountSort, setAmountSort] = useState<'asc' | 'desc' | null>(null);

    // Collection-style inline form.
    const [advCode, setAdvCode] = useState('');
    const [advName, setAdvName] = useState('');
    const [advAmount, setAdvAmount] = useState('');
    const [advDate, setAdvDate] = useState(todayIso());
    const [advNote, setAdvNote] = useState('');
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempCalendarDate, setTempCalendarDate] = useState<Date | null>(new Date());

    // In-app feedback / confirmation (Alert.alert is a no-op on React Native Web).
    const [message, setMessage] = useState({ visible: false, title: '', text: '' });
    const [deleteTarget, setDeleteTarget] = useState<SellingAdvance | null>(null);

    const showMessage = useCallback((title: string, text: string) => {
        setMessage({ visible: true, title, text });
    }, []);

    const closeMessage = useCallback(() => {
        setMessage((prev) => ({ ...prev, visible: false }));
    }, []);

    const openDeleteConfirm = useCallback((advance: SellingAdvance) => {
        setDeleteTarget(advance);
    }, []);

    const closeDeleteConfirm = useCallback(() => {
        setDeleteTarget(null);
    }, []);

    const membersWithCode = useMemo<CodedMember[]>(
        () => members.map((member, index) => ({ ...member, code: String(index + 1).padStart(3, '0') })),
        [members],
    );

    const idToCode = useMemo(() => {
        const map = new Map<string, string>();
        membersWithCode.forEach((member) => map.set(member._id, member.code));
        return map;
    }, [membersWithCode]);

    const idToName = useMemo(() => {
        const map = new Map<string, string>();
        membersWithCode.forEach((member) => map.set(member._id, member.name));
        return map;
    }, [membersWithCode]);

    const findMemberByCode = useCallback((value: string) => {
        const normalized = value.trim().replace(/^0+/, '') || '0';
        return membersWithCode.find((member) => member.code.replace(/^0+/, '') === normalized);
    }, [membersWithCode]);

    const memberName = useCallback((advance: SellingAdvance) => {
        if (typeof advance.member === 'object' && advance.member?.name) return advance.member.name;
        return idToName.get(memberIdOf(advance)) || 'Customer';
    }, [idToName]);

    const memberCodeFor = useCallback((advance: SellingAdvance) => (
        idToCode.get(memberIdOf(advance)) || '-'
    ), [idToCode]);

    const load = useCallback(async (isRefresh = false, nextPage = 1, append = false) => {
        if (!append && !isRefresh) setLoading(true);
        if (append) setLoadingMore(true);
        setError('');
        try {
            const [membersRes, advancesRes] = await Promise.all([
                membersApi.getAll({ limit: 100, includeInactive: false }),
                sellingAdvancesApi.getAll({ limit: PAGE_SIZE, page: nextPage, status: 'all' }),
            ]);

            if (membersRes.success && membersRes.response?.data) {
                setMembers(membersRes.response.data);
            } else if (!append) {
                setMembers([]);
            }

            if (advancesRes.success && advancesRes.response) {
                const rows = advancesRes.response.data || [];
                setAdvances((prev) => (append ? [...prev, ...rows] : rows));
                setSummary(advancesRes.response.summary || EMPTY_SUMMARY);
                setTotalCount(advancesRes.response.pagination?.total ?? advancesRes.response.total ?? rows.length);
                setPage(nextPage);
                setHasMore(nextPage < (advancesRes.response.pagination?.pages ?? 1));
            } else if (!append) {
                setError(advancesRes.message || 'Could not load selling advances.');
                setAdvances([]);
                setSummary(EMPTY_SUMMARY);
                setTotalCount(0);
                setHasMore(false);
            }
        } catch (err) {
            if (!append) {
                setError(err instanceof Error ? err.message : 'Network error. Please try again.');
                setAdvances([]);
                setSummary(EMPTY_SUMMARY);
                setTotalCount(0);
                setHasMore(false);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        void load(false, 1, false);
    }, [load]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void load(true, 1, false);
    }, [load]);

    const loadMore = useCallback(() => {
        if (loadingMore || !hasMore) return;
        void load(false, page + 1, true);
    }, [loadingMore, hasMore, page, load]);

    const toggleSort = useCallback(() => {
        setAmountSort((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    }, []);

    const handleAdvCodeChange = useCallback((text: string) => {
        const code = text.replace(/[^0-9]/g, '').slice(0, 6);
        setAdvCode(code);
        const found = findMemberByCode(code);
        setAdvName(found?.name || '');
        setSelectedMemberId(found?._id || '');
    }, [findMemberByCode]);

    const clearAdvanceForm = useCallback(() => {
        setAdvCode('');
        setAdvName('');
        setAdvAmount('');
        setAdvNote('');
        setSelectedMemberId('');
    }, []);

    const openDatePicker = useCallback(() => {
        setTempCalendarDate(advDate ? new Date(`${advDate}T00:00:00`) : new Date());
        setShowDatePicker(true);
    }, [advDate]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const codeMatch = q ? findMemberByCode(q) : undefined;
        let rows = advances.filter((advance) => {
            if (!q) return true;
            if (codeMatch) return memberIdOf(advance) === codeMatch._id;
            return memberCodeFor(advance).toLowerCase().includes(q)
                || memberName(advance).toLowerCase().includes(q)
                || String(advance.note || '').toLowerCase().includes(q);
        });
        if (amountSort) {
            rows = [...rows].sort((a, b) => {
                const av = Number(a.amount) || 0;
                const bv = Number(b.amount) || 0;
                return amountSort === 'asc' ? av - bv : bv - av;
            });
        }
        return rows;
    }, [advances, search, amountSort, findMemberByCode, memberCodeFor, memberName]);

    const totalAmount = useMemo(() => {
        if (!search.trim()) return summary.advancePending;
        return filtered.reduce((sum, advance) => sum + remainingSellingAdvance(advance), 0);
    }, [search, summary.advancePending, filtered]);

    const buildReportHtml = useCallback(() => {
        const rows = filtered.map((advance) => `
            <tr>
                <td>${escapeHtml(memberCodeFor(advance))}</td>
                <td>${escapeHtml(memberName(advance))}</td>
                <td>${escapeHtml(noteFor(advance))}</td>
                <td>${escapeHtml(money(advance.amount))}</td>
                <td>${escapeHtml(shortDate(advance.date))}</td>
                <td>${escapeHtml(statusFor(advance))}</td>
            </tr>
        `).join('');

        return `
            <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #16A34A; text-align: center; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 12px; }
                        th { background-color: #16A34A; color: white; }
                        tr:nth-child(even) { background-color: #f8fafc; }
                        .info { text-align: center; margin-bottom: 10px; color: #666; }
                    </style>
                </head>
                <body>
                    <h1>Selling Advances Report</h1>
                    <p class="info">Generated on ${escapeHtml(new Date().toLocaleDateString('en-IN'))} | Total Records: ${filtered.length}</p>
                    <table>
                        <tr>
                            <th>Code</th><th>Name</th><th>Note</th><th>Amount</th><th>Date</th><th>Status</th>
                        </tr>
                        ${rows}
                    </table>
                </body>
            </html>
        `;
    }, [filtered, memberCodeFor, memberName]);

    const generatePDF = useCallback(async () => {
        if (!filtered.length) {
            showMessage('Error', 'No advances to export.');
            return;
        }
        try {
            const { uri } = await Print.printToFileAsync({ html: buildReportHtml() });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Selling Advances',
                });
            } else {
                showMessage('PDF Generated', `Saved to: ${uri}`);
            }
        } catch {
            showMessage('Error', 'Failed to generate PDF.');
        }
    }, [filtered.length, buildReportHtml, showMessage]);

    const printReport = useCallback(async () => {
        if (!filtered.length) {
            showMessage('Error', 'No advances to print.');
            return;
        }
        try {
            await Print.printAsync({ html: buildReportHtml() });
        } catch {
            showMessage('Error', 'Failed to print report.');
        }
    }, [filtered.length, buildReportHtml, showMessage]);

    const submit = useCallback(async () => {
        if (!hasAccess) {
            setShowSubscriptionModal(true);
            return;
        }
        const memberId = selectedMemberId || findMemberByCode(advCode)?._id;
        if (!memberId) {
            showMessage('Error', 'Please enter a valid selling customer code.');
            return;
        }
        const amount = Number(advAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            showMessage('Error', 'Please enter an amount greater than zero.');
            return;
        }
        setSaving(true);
        const result = await sellingAdvancesApi.create({
            memberId,
            amount,
            type: 'given',
            date: advDate || undefined,
            note: advNote.trim() || undefined,
        });
        setSaving(false);
        if (result.success) {
            clearAdvanceForm();
            await load(false, 1, false);
            showMessage('Success', 'Advance added successfully.');
        } else if (result.code === 'SUBSCRIPTION_REQUIRED') {
            setShowSubscriptionModal(true);
        } else {
            showMessage('Error', result.message || 'Failed to add advance.');
        }
    }, [
        hasAccess,
        selectedMemberId,
        advCode,
        advAmount,
        advDate,
        advNote,
        findMemberByCode,
        clearAdvanceForm,
        load,
        setShowSubscriptionModal,
        showMessage,
    ]);

    const settle = useCallback(async (advance: SellingAdvance) => {
        const remaining = remainingSellingAdvance(advance);
        if (remaining <= 0) return;
        if (!hasAccess) {
            setShowSubscriptionModal(true);
            return;
        }
        setBusyId(advance._id);
        const result = await sellingAdvancesApi.settle(advance._id, remaining);
        setBusyId(null);
        if (result.success) {
            await load(false, 1, false);
            showMessage('Success', 'Advance settled successfully.');
        } else if (result.code === 'SUBSCRIPTION_REQUIRED') {
            setShowSubscriptionModal(true);
        } else {
            showMessage('Error', result.message || 'Could not settle advance.');
        }
    }, [hasAccess, load, setShowSubscriptionModal, showMessage]);

    const confirmDelete = useCallback(async () => {
        if (!deleteTarget) return;
        if (!hasAccess) {
            setDeleteTarget(null);
            setShowSubscriptionModal(true);
            return;
        }
        const target = deleteTarget;
        setBusyId(target._id);
        const result = await sellingAdvancesApi.remove(target._id);
        setBusyId(null);
        setDeleteTarget(null);
        if (result.success) {
            await load(false, 1, false);
            showMessage('Success', 'Advance deleted successfully.');
        } else if (result.code === 'SUBSCRIPTION_REQUIRED') {
            setShowSubscriptionModal(true);
        } else {
            showMessage('Error', result.message || 'Could not delete advance.');
        }
    }, [deleteTarget, hasAccess, load, setShowSubscriptionModal, showMessage]);

    const saveDisabled = saving || subscriptionLoading || members.length === 0;

    return (
        <View style={s.container}>
            <StatusBar style="light" />

            {/* Flat owner-style header — no gradient, no shadow. */}
            <View style={[s.header, { paddingTop: insets.top + 6 }]}>
                <View style={s.headerRow}>
                    <Pressable onPress={() => router.back()} hitSlop={10} style={s.headerBtn}>
                        <ArrowLeft size={20} color={colors.white} />
                    </Pressable>
                    <View style={s.headerTitle}>
                        <Text numberOfLines={1} style={s.headerTitleText}>Advance</Text>
                        <Text numberOfLines={1} style={s.headerSub}>Selling · isolated ledger</Text>
                    </View>
                    {!hasAccess && !subscriptionLoading ? (
                        <Pressable
                            onPress={() => setShowSubscriptionModal(true)}
                            hitSlop={10}
                            style={s.headerBtn}
                        >
                            <Lock size={17} color={colors.white} />
                        </Pressable>
                    ) : (
                        <View style={s.headerSpacer} />
                    )}
                </View>
            </View>

            <ScrollView
                style={s.scrollView}
                contentContainerStyle={[s.scrollContent, { paddingBottom: Math.max(insets.bottom + 24, 150) }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Add advance form — same field order as Collection → Advances. */}
                <View style={s.row}>
                    <View style={[s.inputGroup, { flex: 0.4 }]}>
                        <Text style={s.label}>Code</Text>
                        <TextInput
                            style={s.input}
                            placeholder="Code"
                            value={advCode}
                            onChangeText={handleAdvCodeChange}
                            keyboardType="number-pad"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                    <View style={[s.inputGroup, { flex: 1 }]}>
                        <Text style={s.label}>Name</Text>
                        <TextInput
                            style={[s.input, s.inputDisabled]}
                            placeholder="Name (auto-filled)"
                            value={advName}
                            editable={false}
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                </View>

                <View style={s.row}>
                    <View style={s.inputGroup}>
                        <Text style={s.label}>Amount</Text>
                        <TextInput
                            style={s.input}
                            placeholder="Amount"
                            value={advAmount}
                            onChangeText={(text) => setAdvAmount(text.replace(/[^0-9.]/g, ''))}
                            keyboardType="numeric"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                    <View style={s.inputGroup}>
                        <Text style={s.label}>Date</Text>
                        <Pressable style={s.dateInputWrapper} onPress={openDatePicker}>
                            <Text style={[s.dateInputText, !advDate && { color: colors.mutedForeground }]}>
                                {formatDateDDMMYYYY(advDate)}
                            </Text>
                            <CalendarIcon size={16} color={colors.mutedForeground} />
                        </Pressable>
                    </View>
                </View>

                <View style={s.inputGroup}>
                    <Text style={s.label}>Note</Text>
                    <TextInput
                        style={s.input}
                        placeholder="Note (e.g. Ghee, Cash)"
                        value={advNote}
                        onChangeText={setAdvNote}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>

                <View style={s.buttonRow}>
                    <Pressable
                        style={[s.saveBtn, saveDisabled && { opacity: 0.6 }]}
                        onPress={() => void submit()}
                        disabled={saveDisabled}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <Text style={s.saveBtnText}>Save Advance</Text>
                        )}
                    </Pressable>
                    <Pressable style={s.clearBtn} onPress={clearAdvanceForm}>
                        <Text style={s.clearBtnText}>Clear</Text>
                    </Pressable>
                </View>

                {/* Search / PDF / Print / amount sort — same row as Collection. */}
                <View style={s.advanceSearchRow}>
                    <View style={s.searchBox}>
                        <Search size={16} color={colors.mutedForeground} />
                        <TextInput
                            style={s.searchInput}
                            placeholder="Search by exact code"
                            value={search}
                            onChangeText={setSearch}
                            keyboardType="numeric"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                    <Pressable style={s.advancePdfBtn} onPress={() => void generatePDF()}>
                        <FileText size={14} color={colors.white} />
                        <Text style={s.advancePdfBtnText}>PDF</Text>
                    </Pressable>
                    <Pressable style={[s.advancePdfBtn, s.printBtn]} onPress={() => void printReport()}>
                        <Printer size={14} color={colors.white} />
                        <Text style={s.advancePdfBtnText}>Print</Text>
                    </Pressable>
                    <AmountFilterIcon sort={amountSort} onToggle={toggleSort} />
                </View>

                {/* Total header — same dashed green box as Collection. */}
                <View style={s.totalAmountHeader}>
                    <View>
                        <Text style={s.totalAmountLabel}>Total Records</Text>
                        <Text style={s.totalAmountSub}>{totalCount} records • {advances.length} shown</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.totalAmountLabel}>Total Amount</Text>
                        <Text style={s.totalAmountValue}>{money(totalAmount)}</Text>
                    </View>
                </View>

                {loading ? (
                    <View style={s.loadingWrap}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={s.loadingText}>Loading advances...</Text>
                    </View>
                ) : !!error ? (
                    <View style={s.loadingWrap}>
                        <Text style={s.infoTextMuted}>{error}</Text>
                        <Pressable onPress={() => void load(false, 1, false)} style={s.retryBtn}>
                            <Text style={s.retryBtnText}>Retry</Text>
                        </Pressable>
                    </View>
                ) : filtered.length === 0 ? (
                    <Text style={s.infoTextMuted}>
                        {search.trim() ? 'No advances match this search.' : 'No advances found. Add one using the form above.'}
                    </Text>
                ) : (
                    <View style={s.table}>
                        <View style={s.tableHeader}>
                            <Text style={[s.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                            <Text style={[s.tableHeaderCell, { flex: 1.3 }]}>Name</Text>
                            <Text style={[s.tableHeaderCell, { flex: 0.9 }]}>Note</Text>
                            <Text style={[s.tableHeaderCell, { flex: 0.7 }]}>Amt</Text>
                            <Text style={[s.tableHeaderCell, { flex: 0.9 }]}>Date</Text>
                            <Text style={[s.tableHeaderCell, { flex: 0.6 }]}>Del</Text>
                        </View>

                        {filtered.map((advance) => {
                            const settled = isSettledAdvance(advance);
                            const remaining = remainingSellingAdvance(advance);
                            return (
                                <View key={advance._id} style={[s.tableRow, settled && s.settledRow]}>
                                    <Text
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                        style={[s.tableCell, s.codeCell, { flex: 0.5 }]}
                                    >
                                        {memberCodeFor(advance)}
                                    </Text>
                                    <Text
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                        style={[s.tableCell, { flex: 1.3 }]}
                                    >
                                        {memberName(advance)}
                                    </Text>
                                    <Text
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                        style={[s.tableCell, { flex: 0.9 }]}
                                    >
                                        {noteFor(advance)}
                                    </Text>
                                    <Text
                                        numberOfLines={1}
                                        style={[s.tableCell, s.amountCell, settled && s.settledAmountText, { flex: 0.7 }]}
                                    >
                                        {money(advance.amount)}
                                    </Text>
                                    <Text numberOfLines={1} style={[s.tableCell, { flex: 0.9 }]}>
                                        {shortDate(advance.date)}
                                    </Text>
                                    <View style={[s.actionCell, { flex: 0.6 }]}>
                                        {busyId === advance._id ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <>
                                                {remaining > 0 && (
                                                    <Pressable
                                                        onPress={() => void settle(advance)}
                                                        style={s.actionBtn}
                                                    >
                                                        <CheckCircle2 size={13} color={colors.primary} />
                                                    </Pressable>
                                                )}
                                                <Pressable
                                                    onPress={() => openDeleteConfirm(advance)}
                                                    style={s.deleteBtn}
                                                >
                                                    <Trash2 size={13} color={colors.destructive} />
                                                </Pressable>
                                            </>
                                        )}
                                    </View>
                                </View>
                            );
                        })}

                        {hasMore && (
                            <Pressable
                                style={s.loadMoreBtn}
                                onPress={loadMore}
                                disabled={loadingMore}
                            >
                                <Text style={s.loadMoreText}>
                                    {loadingMore ? 'Loading...' : `Load More (${Math.max(0, totalCount - advances.length)} remaining)`}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                )}
            </ScrollView>

            <SubscriptionModal
                visible={showSubscriptionModal}
                onClose={handleModalClose}
                onSubscribe={handleSubscriptionSuccess}
                filterTab="selling"
                title="Subscribe to Access Selling"
                fullScreen
            />

            {/* Advance date picker — same Calendar sheet pattern as Collection. */}
            <Modal
                visible={showDatePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <View style={s.dateModalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowDatePicker(false)} />
                    <View style={s.dateModalContent}>
                        <View style={s.dateModalHeader}>
                            <Text style={s.dateModalTitle}>Select Advance Date</Text>
                            <Pressable onPress={() => setShowDatePicker(false)} style={s.dateModalClose}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                        <Calendar
                            selectedDate={tempCalendarDate}
                            onDateSelect={(date) => {
                                if (!date) return;
                                setAdvDate(`${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`);
                                setShowDatePicker(false);
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* In-app message modal. */}
            <Modal visible={message.visible} transparent animationType="fade" onRequestClose={closeMessage}>
                <View style={s.modalOverlay}>
                    <Pressable style={s.modalScrim} onPress={closeMessage} />
                    <View style={s.modalCard}>
                        <Text style={s.modalTitle}>{message.title}</Text>
                        <Text style={s.modalText}>{message.text}</Text>
                        <View style={s.modalActions}>
                            <Pressable style={[s.modalBtn, s.modalBtnPrimary]} onPress={closeMessage}>
                                <Text style={s.modalBtnTextPrimary}>OK</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Delete confirmation modal. */}
            <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={closeDeleteConfirm}>
                <View style={s.modalOverlay}>
                    <Pressable style={s.modalScrim} onPress={closeDeleteConfirm} />
                    <View style={s.modalCard}>
                        <Text style={s.modalTitle}>Delete Advance</Text>
                        <Text style={s.modalText}>
                            Are you sure you want to delete this advance for {deleteTarget ? memberName(deleteTarget) : 'this customer'}?
                        </Text>
                        <View style={s.modalActions}>
                            <Pressable style={[s.modalBtn, s.modalBtnCancel]} onPress={closeDeleteConfirm}>
                                <Text style={s.modalBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[s.modalBtn, s.modalBtnDanger]} onPress={() => void confirmDelete()}>
                                <Text style={s.modalBtnTextPrimary}>
                                    {busyId && deleteTarget && busyId === deleteTarget._id ? 'Please wait...' : 'Delete'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
        backgroundColor: colors.primary,
        paddingHorizontal: 10,
        paddingBottom: 10,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 40,
    },
    headerBtn: {
        width: 38,
        height: 38,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.13)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
    },
    headerSpacer: { width: 38, height: 38 },
    headerTitle: { flex: 1, alignItems: 'center', minWidth: 0 },
    headerTitleText: { fontSize: 16, fontWeight: '800', color: colors.white, letterSpacing: 0.2 },
    headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.72)', marginTop: 1 },

    scrollView: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 6,
        paddingTop: 10,
        paddingBottom: 150,
    },

    row: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    inputGroup: {
        flex: 1,
        marginBottom: 10,
        minWidth: 0,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.mutedForeground,
        marginBottom: 4,
    },
    input: {
        backgroundColor: colors.card,
        borderWidth: 1.2,
        borderColor: '#9CA3AF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.foreground,
    },
    inputDisabled: {
        backgroundColor: colors.muted,
    },
    dateInputWrapper: {
        backgroundColor: colors.card,
        borderWidth: 1.2,
        borderColor: '#9CA3AF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
    },
    dateInputText: {
        flex: 1,
        fontSize: 13,
        color: colors.foreground,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    saveBtn: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: 10,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40,
    },
    saveBtnText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
    },
    clearBtn: {
        flex: 1,
        backgroundColor: colors.muted,
        paddingVertical: 10,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40,
    },
    clearBtnText: {
        color: colors.foreground,
        fontSize: 14,
        fontWeight: '600',
    },

    advanceSearchRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        marginTop: 8,
        alignItems: 'center',
    },
    searchBox: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderWidth: 1.2,
        borderColor: '#9CA3AF',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
        gap: 6,
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
        color: colors.foreground,
        fontSize: 13,
        paddingVertical: 0,
    },
    advancePdfBtn: {
        backgroundColor: colors.warning,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 6,
        justifyContent: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: 36,
    },
    printBtn: {
        backgroundColor: colors.primary,
    },
    advancePdfBtnText: {
        color: colors.white,
        fontSize: 12,
        fontWeight: '600',
    },

    totalAmountHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.primary + '15',
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 12,
        marginBottom: 8,
        gap: 8,
    },
    totalAmountLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },
    totalAmountSub: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginTop: 2,
    },
    totalAmountValue: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },

    table: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        overflow: 'hidden',
        marginTop: 10,
        backgroundColor: colors.card,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: colors.muted,
        paddingVertical: 8,
        paddingHorizontal: 6,
        gap: 2,
    },
    tableHeaderCell: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.foreground,
        textAlign: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        alignItems: 'center',
        gap: 2,
    },
    tableCell: {
        fontSize: 12,
        color: colors.foreground,
        textAlign: 'center',
        flexShrink: 1,
    },
    codeCell: {
        color: colors.primary,
        fontWeight: '700',
    },
    amountCell: {
        color: colors.warning,
        fontWeight: '700',
    },
    settledRow: {
        opacity: 0.6,
        backgroundColor: 'rgba(0,0,0,0.03)',
    },
    settledAmountText: {
        textDecorationLine: 'line-through',
        color: colors.destructive,
    },
    actionCell: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        minWidth: 0,
    },
    actionBtn: {
        padding: 4,
        backgroundColor: colors.primary + '20',
        borderRadius: 4,
    },
    deleteBtn: {
        padding: 4,
        backgroundColor: colors.destructive + '20',
        borderRadius: 4,
    },
    loadMoreBtn: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: colors.muted,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    loadMoreText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },

    loadingWrap: {
        paddingVertical: 28,
        alignItems: 'center',
        gap: 8,
    },
    loadingText: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    infoTextMuted: {
        fontSize: 13,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginTop: 20,
    },
    retryBtn: {
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: colors.primary,
    },
    retryBtnText: {
        color: colors.white,
        fontSize: 12,
        fontWeight: '800',
    },

    dateModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    dateModalContent: {
        backgroundColor: isDark ? colors.card : '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 12,
        paddingBottom: 30,
        paddingHorizontal: 16,
    },
    dateModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    dateModalTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.foreground,
    },
    dateModalClose: {
        padding: 4,
    },

    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    modalScrim: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 16,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.foreground,
        textAlign: 'center',
    },
    modalText: {
        fontSize: 12,
        lineHeight: 17,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginTop: 8,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
    },
    modalBtn: {
        flex: 1,
        minHeight: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    modalBtnPrimary: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    modalBtnDanger: {
        backgroundColor: colors.destructive,
        borderColor: colors.destructive,
    },
    modalBtnCancel: {
        backgroundColor: colors.card,
        borderColor: colors.border,
    },
    modalBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.foreground,
    },
    modalBtnTextPrimary: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.white,
    },
});
