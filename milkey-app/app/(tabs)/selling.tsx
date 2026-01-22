import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Calendar as CalendarIcon, Search, Trash2, FileText, Printer, Edit2, DollarSign, User, Download, Check, Plus, X } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import { Calendar } from '@/components/Calendar';
import { SellingPaymentCalendar } from '@/components/SellingPaymentCalendar';
import { membersApi, sellingEntriesApi, memberPaymentsApi, Member, SellingEntry, MemberPayment, MemberPaymentSummary, MemberBalanceReport, BalanceReportSummary } from '@/lib/milkeyApi';
import { getAuthToken } from '@/lib/authStore';
import { exportPayments } from '@/lib/csvExport';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { useLocalSearchParams } from 'expo-router';
import { useSubscriptionCheck } from '@/hooks/useSubscriptionCheck';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { useDebounce } from '@/hooks/useDebounce';

type TabType = 'Entry' | 'Payment' | 'Reports' | 'Member';

// Helper to group entries by date and member for combined M/E display
interface GroupedEntry {
    date: string;
    memberId: string;
    memberName: string;
    morningQty: number;
    eveningQty: number;
    entryId: string;
    totalAmount: number;
    rate: number;
    entryCount: number;
}

export default function SellingScreen() {
    const { colors, isDark } = useTheme();
    const { tab } = useLocalSearchParams<{ tab?: string }>();

    // Subscription check
    const {
        hasAccess,
        loading: subscriptionLoading,
        showSubscriptionModal,
        handleModalClose,
        handleSubscriptionSuccess
    } = useSubscriptionCheck('selling');

    const [activeTab, setActiveTab] = useState<TabType>('Entry');
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Set active tab from URL params
    useEffect(() => {
        if (tab && ['Entry', 'Payment', 'Reports', 'Member'].includes(tab)) {
            setActiveTab(tab as TabType);
        }
    }, [tab]);

    // Date picker state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerTarget, setDatePickerTarget] = useState<'entry' | 'reportStart' | 'reportEnd' | 'recentStart' | 'recentEnd'>('entry');
    const [tempCalendarDate, setTempCalendarDate] = useState<Date | null>(new Date());

    // Entry state
    const [searchMember, setSearchMember] = useState('');
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [mornQty, setMornQty] = useState('');
    const [eveQty, setEveQty] = useState('');
    const [rate, setRate] = useState('50');
    const [recentEntries, setRecentEntries] = useState<SellingEntry[]>([]);
    const [entriesPage, setEntriesPage] = useState(1);
    const [hasMoreEntries, setHasMoreEntries] = useState(true);
    const [savingEntry, setSavingEntry] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Recent entries filter state
    const [recentEntriesStartDate, setRecentEntriesStartDate] = useState('');
    const [recentEntriesEndDate, setRecentEntriesEndDate] = useState('');
    const [recentEntriesMemberFilter, setRecentEntriesMemberFilter] = useState('');
    const [showRecentMemberDropdown, setShowRecentMemberDropdown] = useState(false);
    const [recentMemberSearch, setRecentMemberSearch] = useState('');

    // Payment state
    const [selectedPaymentMember, setSelectedPaymentMember] = useState<Member | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [milkAmount, setMilkAmount] = useState('0');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank'>('cash');
    const [memberSummary, setMemberSummary] = useState<any>(null);
    const [recentPayments, setRecentPayments] = useState<MemberPayment[]>([]);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [savingPayment, setSavingPayment] = useState(false);
    const [paymentMemberSearch, setPaymentMemberSearch] = useState('');
    const [showPaymentMemberSuggestions, setShowPaymentMemberSuggestions] = useState(false);

    // Calculation period state
    const [calcStartDate, setCalcStartDate] = useState('');
    const [calcEndDate, setCalcEndDate] = useState('');
    const [showCalcDatePicker, setShowCalcDatePicker] = useState(false);
    const [calcDateTarget, setCalcDateTarget] = useState<'start' | 'end'>('start');

    // Date ranges state
    interface DateRange {
        id: string;
        startDay: number;
        endDay: number | 'End';
        label: string;
    }
    const [dateRanges, setDateRanges] = useState<DateRange[]>([
        { id: '1', startDay: 1, endDay: 10, label: '1-10' },
        { id: '2', startDay: 11, endDay: 20, label: '11-20' },
        { id: '3', startDay: 21, endDay: 'End', label: '21-End' },
    ]);

    // Add Range Modal state
    const [showAddRangeModal, setShowAddRangeModal] = useState(false);
    const [newRangeStartDay, setNewRangeStartDay] = useState('');
    const [newRangeEndDay, setNewRangeEndDay] = useState('');
    const [newRangeIsEnd, setNewRangeIsEnd] = useState(false);

    // Reports state - empty dates means show all data
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [reportMemberFilter, setReportMemberFilter] = useState<string>(''); // Member ID filter for reports
    const [showReportMemberDropdown, setShowReportMemberDropdown] = useState(false);
    const [reportMemberSearch, setReportMemberSearch] = useState(''); // Search text for report member filter

    // Balance Report state (fetched from server)
    const [balanceReportData, setBalanceReportData] = useState<MemberBalanceReport[]>([]);
    const [balanceReportSummary, setBalanceReportSummary] = useState<BalanceReportSummary | null>(null);
    const [balanceReportLoading, setBalanceReportLoading] = useState(false);

    // Member state
    const [members, setMembers] = useState<Member[]>([]);
    const [memberName, setMemberName] = useState('');
    const [memberMobile, setMemberMobile] = useState('');
    const [memberAddress, setMemberAddress] = useState('');
    const [memberRatePerLiter, setMemberRatePerLiter] = useState('50');
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [memberTabSearch, setMemberTabSearch] = useState('');
    const [memberSearchLoading, setMemberSearchLoading] = useState(false);

    // Modal state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmData, setConfirmData] = useState<{ title: string; message: string; onConfirm: () => void }>({ title: '', message: '', onConfirm: () => { } });

    // Edit Payment Modal state
    const [editPaymentVisible, setEditPaymentVisible] = useState(false);
    const [editingPayment, setEditingPayment] = useState<MemberPayment | null>(null);
    const [editPaymentAmount, setEditPaymentAmount] = useState('');
    const [editMilkAmount, setEditMilkAmount] = useState('');
    const [updatingPayment, setUpdatingPayment] = useState(false);

    const showAlert = (title: string, message: string) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertVisible(true);
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setConfirmData({ title, message, onConfirm });
        setConfirmVisible(true);
    };

    // Helper function for date offset
    function getDateOffset(days: number) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    }

    // Debounced search values for performance
    const debouncedSearchMember = useDebounce(searchMember, 150);
    const debouncedRecentMemberSearch = useDebounce(recentMemberSearch, 150);
    const debouncedReportMemberSearch = useDebounce(reportMemberSearch, 150);

    // Filtered members for search - auto suggest (using debounced value)
    // Filtered members for search - by name only
    const filteredMembers = useMemo(() => {
        if (!debouncedSearchMember.trim()) return members.slice(0, 10);
        const query = debouncedSearchMember.toLowerCase();
        return members.filter(m =>
            m.name.toLowerCase().includes(query)
        ).slice(0, 10);
    }, [members, debouncedSearchMember]);

    const totalQuantity = (parseFloat(mornQty) || 0) + (parseFloat(eveQty) || 0);
    const totalAmount = totalQuantity * (parseFloat(rate) || 0);

    // Filtered members for recent entries dropdown (using debounced value)
    const filteredRecentMembers = useMemo(() => {
        if (!debouncedRecentMemberSearch.trim()) return members.slice(0, 15);
        const query = debouncedRecentMemberSearch.toLowerCase();
        return members.filter(m => m.name.toLowerCase().includes(query)).slice(0, 15);
    }, [members, debouncedRecentMemberSearch]);

    // Filtered balance report data for report member dropdown (using debounced value)
    const filteredReportMembers = useMemo(() => {
        if (!debouncedReportMemberSearch.trim()) return balanceReportData;
        const query = debouncedReportMemberSearch.toLowerCase();
        return balanceReportData.filter(m =>
            m.name?.toLowerCase().includes(query) ||
            m.mobile?.toLowerCase().includes(query)
        );
    }, [balanceReportData, debouncedReportMemberSearch]);

    // Get selected recent member name for display (memoized for performance)
    const selectedRecentMemberName = useMemo(() => {
        if (!recentEntriesMemberFilter) return 'All Members';
        const member = members.find(m => m._id === recentEntriesMemberFilter);
        return member?.name || 'All Members';
    }, [recentEntriesMemberFilter, members]);

    // Pre-compute date strings for entries once to avoid repeated Date parsing
    const entriesWithDateStr = useMemo(() => {
        return recentEntries.map(entry => ({
            ...entry,
            dateStr: new Date(entry.date).toISOString().split('T')[0],
        }));
    }, [recentEntries]);

    // Group entries by date and member for combined M/E display - with filters (optimized)
    const groupedEntries = useMemo((): GroupedEntry[] => {
        const groups: Record<string, GroupedEntry> = {};

        // Apply filters to recentEntries (using pre-computed dateStr)
        for (const entry of entriesWithDateStr) {
            // Date filter - quick string comparison
            if (recentEntriesStartDate && entry.dateStr < recentEntriesStartDate) continue;
            if (recentEntriesEndDate && entry.dateStr > recentEntriesEndDate) continue;

            // Member filter
            if (recentEntriesMemberFilter && entry.member?._id !== recentEntriesMemberFilter) continue;

            const memberId = entry.member?._id || '';
            const key = `${entry.dateStr}-${memberId}`;

            if (!groups[key]) {
                groups[key] = {
                    date: entry.dateStr,
                    memberId,
                    memberName: entry.member?.name || 'Unknown',
                    morningQty: 0,
                    eveningQty: 0,
                    entryId: entry._id,
                    totalAmount: 0,
                    rate: entry.rate,
                    entryCount: (entry as any).entryCount || 1,
                };
            }

            groups[key].morningQty += entry.morningQuantity || 0;
            groups[key].eveningQty += entry.eveningQuantity || 0;
            groups[key].entryId = entry._id;
            groups[key].totalAmount += entry.amount;
            groups[key].entryCount = Math.max(groups[key].entryCount, (entry as any).entryCount || 1);
        }

        // Sort by date descending
        return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
    }, [entriesWithDateStr, recentEntriesStartDate, recentEntriesEndDate, recentEntriesMemberFilter]);

    // Fetch data - members and selling entries
    const fetchData = useCallback(async () => {
        const token = await getAuthToken();
        if (!token) return;

        try {
            setIsLoading(true);
            const [membersRes, entriesRes, paymentsRes, balanceReportRes] = await Promise.all([
                membersApi.getAll(),
                sellingEntriesApi.getAll({ limit: 50 }),
                memberPaymentsApi.getAll({ limit: 10 }),
                membersApi.getBalanceReport()
            ]);

            if (membersRes.success) {
                setMembers(membersRes.response?.data || []);
            }
            if (entriesRes.success) {
                setRecentEntries(entriesRes.response?.data || []);
                setHasMoreEntries((entriesRes.response?.data || []).length >= 50);
                setEntriesPage(1);
            }
            if (paymentsRes.success) {
                setRecentPayments(paymentsRes.response?.data || []);
            }
            if (balanceReportRes.success) {
                setBalanceReportData(balanceReportRes.response?.data || []);
                setBalanceReportSummary(balanceReportRes.response?.summary || null);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Load more entries
    const handleLoadMore = async () => {
        if (loadingMore || !hasMoreEntries) return;
        setLoadingMore(true);
        try {
            const nextPage = entriesPage + 1;
            const res = await sellingEntriesApi.getAll({ limit: 50, page: nextPage });
            if (res.success) {
                const newEntries = res.response?.data || [];
                setRecentEntries(prev => [...prev, ...newEntries]);
                setHasMoreEntries(newEntries.length >= 50);
                setEntriesPage(nextPage);
            }
        } catch (error) {
            console.error('Load more error:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    // Save selling entry
    const handleSaveEntry = async () => {
        if (savingEntry) return;

        if (!selectedMember) {
            showAlert('Error', 'Please select a member first');
            return;
        }

        const morn = parseFloat(mornQty) || 0;
        const eve = parseFloat(eveQty) || 0;
        if (morn <= 0 && eve <= 0) {
            showAlert('Error', 'Please enter morning or evening quantity');
            return;
        }

        setSavingEntry(true);
        try {
            const res = await sellingEntriesApi.create({
                memberId: selectedMember._id,
                morningQuantity: morn,
                eveningQuantity: eve,
                rate: parseFloat(rate) || selectedMember.ratePerLiter,
                date: entryDate,
            });
            if (res.success) {
                showAlert('Success', 'Entry saved successfully');
                setMornQty('');
                setEveQty('');
                setSelectedMember(null);
                setSearchMember('');
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to save entry');
            }
        } catch (error) {
            showAlert('Error', 'Failed to save entry');
        } finally {
            setSavingEntry(false);
        }
    };

    // Delete entry
    const handleDeleteEntry = async (entryId: string) => {
        showConfirm('Delete Entry', 'Are you sure you want to delete this entry?', async () => {
            setConfirmVisible(false);
            try {
                await sellingEntriesApi.delete(entryId);
                fetchData();
            } catch (error) {
                showAlert('Error', 'Failed to delete entry');
            }
        });
    };

    // Fetch member summary for payment
    const handleSelectPaymentMember = async (member: Member) => {
        setSelectedPaymentMember(member);
        setPaymentMemberSearch(member.name);
        setShowPaymentMemberSuggestions(false);
        setPaymentLoading(true);

        // Reset inputs for new selection - keep milk amount as 0, no auto-fill
        setPaymentAmount('');
        setMilkAmount('0');
        setCalcEndDate('');

        // Find last payment for this member to get the last end date
        const memberLastPayment = recentPayments.find(p => p.member?._id === member._id && p.periodEnd);
        let startDateFromLastPayment = '';

        if (memberLastPayment?.periodEnd) {
            // Start from day after last payment's end date
            const lastEndDate = new Date(memberLastPayment.periodEnd);
            lastEndDate.setDate(lastEndDate.getDate() + 1);
            startDateFromLastPayment = lastEndDate.toISOString().split('T')[0];
        }

        // Set the start date from last payment (for internal use)
        setCalcStartDate(startDateFromLastPayment);

        try {
            // Fetch summary - if we have a start date from last payment, use it
            const res = await memberPaymentsApi.getMemberSummary(
                member._id,
                startDateFromLastPayment
                    ? { startDate: startDateFromLastPayment, endDate: undefined }
                    : undefined
            );
            if (res.success && res.response) {
                setMemberSummary(res.response);
                // Auto-fill milk amount with unpaid amount
                const unpaidAmount = res.response.selling?.unpaidAmount || 0;
                setMilkAmount(unpaidAmount.toFixed(2));
            } else {
                setMemberSummary({ member: { currentBalance: member.sellingPaymentBalance ?? 0 }, selling: { unpaidAmount: 0 } });
            }
        } catch (error) {
            setMemberSummary({ member: { currentBalance: member.sellingPaymentBalance ?? 0 }, selling: { unpaidAmount: 0 } });
        } finally {
            setPaymentLoading(false);
        }
    };

    // Fetch summary when end date changes
    const handleEndDateChange = async (endDate: string) => {
        setCalcEndDate(endDate);

        if (!selectedPaymentMember) return;

        setPaymentLoading(true);
        try {
            const res = await memberPaymentsApi.getMemberSummary(
                selectedPaymentMember._id,
                { startDate: calcStartDate || undefined, endDate: endDate || undefined }
            );
            if (res.success && res.response) {
                setMemberSummary(res.response);
                // Auto-fill milk amount with unpaid amount for the period
                const unpaidAmount = res.response.selling?.unpaidAmount || 0;
                setMilkAmount(unpaidAmount.toFixed(2));
            }
        } catch (error) {
            console.error('Failed to fetch summary for date range:', error);
        } finally {
            setPaymentLoading(false);
        }
    };

    // Process payment
    const handleProcessPayment = async () => {
        if (!selectedPaymentMember) {
            showAlert('Error', 'Please select a member first');
            return;
        }

        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            showAlert('Error', 'Please enter a valid amount');
            return;
        }

        setSavingPayment(true);
        try {
            // Get member's milk rate and total quantity from summary
            const memberRate = selectedPaymentMember.ratePerLiter || 0;
            const milkAmountVal = Number.parseFloat(milkAmount) || 0;
            // Use totalLiters from member summary (real quantity from selling entries for the period)
            const totalQuantityFromSummary = memberSummary?.selling?.totalLiters || 0;

            const res = await memberPaymentsApi.create({
                memberId: selectedPaymentMember._id,
                amount,
                milkAmount: milkAmountVal,
                paymentMethod,
                periodStart: calcStartDate || undefined,
                periodEnd: calcEndDate || undefined,
                totalQuantity: totalQuantityFromSummary,
                milkRate: memberRate,
            });

            if (res.success) {
                showAlert('Success', 'Payment recorded successfully');
                setSelectedPaymentMember(null);
                setPaymentMemberSearch('');
                setPaymentAmount('');
                setMemberSummary(null);
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to save payment');
            }
        } catch (error) {
            showAlert('Error', 'Failed to save payment');
        } finally {
            setSavingPayment(false);
        }
    };

    // Clear payment form
    const clearPaymentForm = () => {
        setSelectedPaymentMember(null);
        setPaymentMemberSearch('');
        setPaymentAmount('');
        setMilkAmount('0');
        setMemberSummary(null);
    };

    // Filtered members for payment search
    const filteredPaymentMembers = useMemo(() => {
        if (!paymentMemberSearch.trim()) return members.slice(0, 10);
        const query = paymentMemberSearch.toLowerCase();
        return members.filter(m => m.name.toLowerCase().includes(query)).slice(0, 10);
    }, [members, paymentMemberSearch]);

    // Save member
    const handleSaveMember = async () => {
        if (!memberName || !memberMobile) {
            showAlert('Error', 'Please fill all required fields');
            return;
        }

        try {
            setIsLoading(true);

            if (editingMember) {
                const res = await membersApi.update(editingMember._id, {
                    name: memberName,
                    mobile: memberMobile,
                    address: memberAddress,
                    ratePerLiter: parseFloat(memberRatePerLiter) || 50
                });
                if (res.success) {
                    showAlert('Success', 'Member updated successfully');
                    clearMemberForm();
                    setShowMemberModal(false);
                    fetchData();
                } else {
                    showAlert('Error', res.message || 'Failed to update member');
                }
            } else {
                const res = await membersApi.create({
                    name: memberName,
                    mobile: memberMobile,
                    address: memberAddress,
                    ratePerLiter: parseFloat(memberRatePerLiter) || 50
                });
                if (res.success) {
                    showAlert('Success', 'Member added successfully');
                    clearMemberForm();
                    setShowMemberModal(false);
                    fetchData();
                } else {
                    showAlert('Error', res.message || 'Failed to add member');
                }
            }
        } catch (error) {
            showAlert('Error', 'Failed to save member');
        } finally {
            setIsLoading(false);
        }
    };

    const clearMemberForm = () => {
        setMemberName('');
        setMemberMobile('');
        setMemberAddress('');
        setMemberRatePerLiter('50');
        setEditingMember(null);
    };

    const handleEditMember = (member: Member) => {
        setEditingMember(member);
        setMemberName(member.name);
        setMemberMobile(member.mobile);
        setMemberAddress(member.address || '');
        setMemberRatePerLiter(member.ratePerLiter?.toString() || '50');
        setShowMemberModal(true);
    };

    const handleDeleteMember = async (id: string) => {
        showConfirm('Delete Member', 'Are you sure you want to delete this member?', async () => {
            setConfirmVisible(false);
            try {
                const res = await membersApi.delete(id);
                if (res.success) {
                    fetchData();
                } else {
                    showAlert('Error', 'Failed to delete member');
                }
            } catch (error) {
                showAlert('Error', 'Failed to delete member');
            }
        });
    };

    // Date picker handler
    const handleDateSelect = (date: string) => {
        if (datePickerTarget === 'entry') {
            setEntryDate(date);
        } else if (datePickerTarget === 'reportStart') {
            setReportStartDate(date);
        } else if (datePickerTarget === 'reportEnd') {
            setReportEndDate(date);
        } else if (datePickerTarget === 'recentStart') {
            setRecentEntriesStartDate(date);
        } else if (datePickerTarget === 'recentEnd') {
            setRecentEntriesEndDate(date);
        }
    };

    const openDatePicker = (target: 'entry' | 'reportStart' | 'reportEnd' | 'recentStart' | 'recentEnd') => {
        setDatePickerTarget(target);
        // Set temp calendar date based on target
        if (target === 'entry') {
            setTempCalendarDate(new Date(entryDate));
        } else if (target === 'reportStart') {
            setTempCalendarDate(reportStartDate ? new Date(reportStartDate) : new Date());
        } else if (target === 'reportEnd') {
            setTempCalendarDate(reportEndDate ? new Date(reportEndDate) : new Date());
        } else if (target === 'recentStart') {
            setTempCalendarDate(recentEntriesStartDate ? new Date(recentEntriesStartDate) : new Date());
        } else if (target === 'recentEnd') {
            setTempCalendarDate(recentEntriesEndDate ? new Date(recentEntriesEndDate) : new Date());
        }
        setShowDatePicker(true);
    };

    // Filter entries by date range and member for reports
    const getFilteredEntries = () => {
        return recentEntries.filter(entry => {
            const entryDate = new Date(entry.date).toISOString().split('T')[0];
            // If no date filters, show all; otherwise apply date range
            const dateMatch = (!reportStartDate && !reportEndDate) ||
                ((!reportStartDate || entryDate >= reportStartDate) && (!reportEndDate || entryDate <= reportEndDate));
            const memberMatch = !reportMemberFilter || entry.member?._id === reportMemberFilter;
            return dateMatch && memberMatch;
        });
    };

    // Get selected member name for display (memoized for performance)
    const selectedReportMemberName = useMemo(() => {
        if (!reportMemberFilter) return 'All Members';
        const member = members.find(m => m._id === reportMemberFilter);
        return member?.name || 'All Members';
    }, [reportMemberFilter, members]);

    const getFilteredPayments = () => {
        return recentPayments.filter(payment => {
            const paymentDate = new Date(payment.date || payment.createdAt || '').toISOString().split('T')[0];
            // If no date filters, show all; otherwise apply date range
            return (!reportStartDate && !reportEndDate) ||
                ((!reportStartDate || paymentDate >= reportStartDate) && (!reportEndDate || paymentDate <= reportEndDate));
        });
    };

    // Helper to format date as dd/mm/yyyy
    const formatDateDDMMYYYY = (dateStr: string) => {
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Group filtered entries by date and member (like entry table)
    const getGroupedReportEntries = () => {
        const filteredEntries = getFilteredEntries();
        const groups: Record<string, {
            date: string;
            memberName: string;
            morningQty: number;
            eveningQty: number;
            totalAmount: number;
            rate: number;
            entryCount: number;
        }> = {};

        filteredEntries.forEach(entry => {
            const dateStr = new Date(entry.date).toISOString().split('T')[0];
            const memberId = entry.member?._id || '';
            const key = `${dateStr}-${memberId}`;

            if (!groups[key]) {
                groups[key] = {
                    date: dateStr,
                    memberName: entry.member?.name || 'Unknown',
                    morningQty: 0,
                    eveningQty: 0,
                    totalAmount: 0,
                    rate: entry.rate,
                    entryCount: (entry as any).entryCount || 1,
                };
            }

            groups[key].morningQty += entry.morningQuantity || 0;
            groups[key].eveningQty += entry.eveningQuantity || 0;
            groups[key].totalAmount += entry.amount;
            groups[key].entryCount = Math.max(groups[key].entryCount, (entry as any).entryCount || 1);
        });

        return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    // Generate PDF Report - matching entry table format
    const generateReportHTML = () => {
        const groupedEntries = getGroupedReportEntries();
        const rows = groupedEntries.map(item => `
          <tr>
            <td>${formatDateDDMMYYYY(item.date)}</td>
            <td>${item.memberName}</td>
            <td>${item.entryCount}</td>
            <td>${item.morningQty > 0 ? item.morningQty : '-'} + ${item.eveningQty > 0 ? item.eveningQty : '-'}</td>
            <td>₹${item.rate}</td>
            <td>₹${item.totalAmount.toFixed(0)}</td>
          </tr>
        `).join('');

        const totalQty = groupedEntries.reduce((sum, e) => sum + e.morningQty + e.eveningQty, 0);
        const totalAmt = groupedEntries.reduce((sum, e) => sum + e.totalAmount, 0);
        const totalEntries = groupedEntries.reduce((sum, e) => sum + e.entryCount, 0);

        return `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #22C55E; text-align: center; }
                .period { text-align: center; color: #666; margin-bottom: 10px; }
                .generated { text-align: center; color: #999; font-size: 12px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ddd; padding: 10px 8px; text-align: center; font-size: 12px; }
                th { background-color: #22C55E; color: white; font-weight: 600; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .summary { margin-top: 20px; font-weight: bold; background: #f5f5f5; padding: 15px; border-radius: 8px; }
                .summary p { margin: 5px 0; }
              </style>
            </head>
            <body>
              <h1>Milk Selling Report</h1>
              <p class="period">Period: ${reportStartDate ? formatDateDDMMYYYY(reportStartDate) : 'All'} to ${reportEndDate ? formatDateDDMMYYYY(reportEndDate) : 'All'}</p>
              <p class="generated">Generated on: ${formatDateDDMMYYYY(new Date().toISOString().split('T')[0])}</p>
              <table>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Entry</th>
                  <th>M/E (L)</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
                ${rows}
              </table>
              <div class="summary">
                <p>Total Days: ${groupedEntries.length}</p>
                <p>Total Entries: ${totalEntries}</p>
                <p>Total Quantity: ${totalQty.toFixed(2)} L</p>
                <p>Total Amount: ₹${totalAmt.toFixed(2)}</p>
              </div>
            </body>
          </html>
        `;
    };

    const handlePDF = async () => {
        try {
            const html = generateReportHTML();
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                showAlert('PDF Generated', `Saved to: ${uri}`);
            }
        } catch (error) {
            showAlert('Error', 'Failed to generate PDF');
        }
    };

    // Print filtered entries
    const handlePrintEntries = async () => {
        if (groupedEntries.length === 0) {
            showAlert('Error', 'No entries to print');
            return;
        }

        const rows = groupedEntries.map(item => `
            <tr>
                <td>${formatDate(item.date)}</td>
                <td>${item.memberName}</td>
                <td style="text-align: center;">${item.entryCount}</td>
                <td style="text-align: center;">${item.morningQty > 0 ? item.morningQty : '-'} + ${item.eveningQty > 0 ? item.eveningQty : '-'}</td>
                <td style="text-align: right;">₹${item.rate}</td>
                <td style="text-align: right;">₹${item.totalAmount.toFixed(0)}</td>
            </tr>
        `).join('');

        const totalQty = groupedEntries.reduce((sum, e) => sum + e.morningQty + e.eveningQty, 0);
        const totalAmt = groupedEntries.reduce((sum, e) => sum + e.totalAmount, 0);
        const totalEntries = groupedEntries.reduce((sum, e) => sum + e.entryCount, 0);

        const periodText = recentEntriesStartDate || recentEntriesEndDate
            ? `Period: ${recentEntriesStartDate ? formatDate(recentEntriesStartDate) : 'Start'} to ${recentEntriesEndDate ? formatDate(recentEntriesEndDate) : 'End'}`
            : 'All Entries';
        const memberText = recentEntriesMemberFilter
            ? `Member: ${selectedRecentMemberName}`
            : 'All Members';

        const html = `
            <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                        h1 { color: #22c55e; text-align: center; margin-bottom: 5px; }
                        .subtitle { text-align: center; color: #666; margin-bottom: 5px; font-size: 14px; }
                        .filter-info { text-align: center; color: #888; margin-bottom: 20px; font-size: 12px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th { background-color: #22c55e; color: white; padding: 12px 8px; text-align: left; font-weight: 600; font-size: 12px; }
                        td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
                        tr:nth-child(even) { background-color: #f9fafb; }
                        .summary { margin-top: 20px; padding: 15px; background-color: #f0fdf4; border-radius: 8px; }
                        .summary-text { font-size: 14px; color: #333; margin: 5px 0; }
                    </style>
                </head>
                <body>
                    <h1>Milk Selling Entries</h1>
                    <p class="subtitle">${periodText}</p>
                    <p class="filter-info">${memberText} | Generated: ${formatDate(new Date().toISOString().split('T')[0])}</p>
                    <table>
                        <tr>
                            <th>Date</th>
                            <th>Name</th>
                            <th style="text-align: center;">Entry</th>
                            <th style="text-align: center;">M/E (L)</th>
                            <th style="text-align: right;">Rate</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                        ${rows}
                    </table>
                    <div class="summary">
                        <p class="summary-text"><strong>Total Days:</strong> ${groupedEntries.length}</p>
                        <p class="summary-text"><strong>Total Entries:</strong> ${totalEntries}</p>
                        <p class="summary-text"><strong>Total Quantity:</strong> ${totalQty.toFixed(2)} L</p>
                        <p class="summary-text"><strong>Total Amount:</strong> ₹${totalAmt.toFixed(2)}</p>
                    </div>
                </body>
            </html>
        `;

        try {
            await Print.printAsync({ html });
        } catch (error) {
            showAlert('Error', 'Failed to print');
        }
    };

    const handlePrint = async () => {
        try {
            const html = generateReportHTML();
            await Print.printAsync({ html });
        } catch (error) {
            showAlert('Error', 'Failed to print');
        }
    };

    // Generate Report HTML for member balance - uses server balance report data
    const generateMemberBalanceReportHTML = () => {
        const selectedReportMember = reportMemberFilter
            ? balanceReportData.find(m => m._id === reportMemberFilter)
            : null;

        const membersToShow = selectedReportMember ? [selectedReportMember] : balanceReportData;
        const netBalance = balanceReportSummary?.netBalance || 0;

        const rows = membersToShow.map((member, index) => {
            const balance = member.totalBalance;
            const lastPeriodEnd = member.lastPeriodEnd ? formatDateDDMMYYYY(member.lastPeriodEnd) : '-';

            return `
            <tr style="${index % 2 === 0 ? '' : 'background-color: #f9fafb;'}">
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${index + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${member.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${formatDateDDMMYYYY(member.date)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${lastPeriodEnd}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: ${balance > 0 ? '#22c55e' : balance < 0 ? '#ef4444' : '#333'};">
                    ${balance < 0 ? '-' : balance > 0 ? '+' : ''}₹${Math.abs(balance).toFixed(0)}
                </td>
            </tr>
        `}).join('');

        return `
            <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                        h1 { color: #22c55e; text-align: center; margin-bottom: 5px; }
                        .subtitle { text-align: center; color: #666; margin-bottom: 20px; font-size: 14px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th { background-color: #22c55e; color: white; padding: 12px 10px; text-align: left; font-weight: 600; }
                        th:first-child, th:nth-child(3), th:nth-child(4) { text-align: center; }
                        th:last-child { text-align: right; }
                        .summary { margin-top: 20px; padding: 15px; background-color: #f0fdf4; border-radius: 8px; }
                        .summary-text { font-size: 14px; color: #333; margin: 5px 0; }
                    </style>
                </head>
                <body>
                    <h1>Member Balance Report</h1>
                    <p class="subtitle">${selectedReportMember ? `Member: ${selectedReportMember.name}` : 'All Members'} | Generated: ${formatDateDDMMYYYY(new Date().toISOString().split('T')[0])}</p>
                    <table>
                        <tr>
                            <th style="width: 50px;">Sr.</th>
                            <th>Name</th>
                            <th style="width: 100px;">Date</th>
                            <th style="width: 100px;">Till</th>
                            <th style="width: 120px;">Balance</th>
                        </tr>
                        ${rows}
                    </table>
                    <div class="summary">
                        <p class="summary-text"><strong>Total Members:</strong> ${membersToShow.length}</p>
                        <p class="summary-text"><strong>Net Balance:</strong> <span style="color: ${netBalance >= 0 ? '#22c55e' : '#ef4444'};">${netBalance < 0 ? '-' : ''}₹${Math.abs(netBalance).toFixed(0)}</span></p>
                    </div>
                </body>
            </html>
        `;
    };

    // Handle Report PDF download
    const handleReportPDF = async () => {
        if (balanceReportData.length === 0) {
            showAlert('Error', 'No members to export');
            return;
        }

        try {
            const html = generateMemberBalanceReportHTML();
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                showAlert('PDF Generated', `Saved to: ${uri}`);
            }
        } catch (error) {
            showAlert('Error', 'Failed to generate PDF');
        }
    };

    // Handle Report Print
    const handleReportPrint = async () => {
        if (balanceReportData.length === 0) {
            showAlert('Error', 'No members to print');
            return;
        }

        try {
            const html = generateMemberBalanceReportHTML();
            await Print.printAsync({ html });
        } catch (error) {
            showAlert('Error', 'Failed to print');
        }
    };

    // Edit Payment Handler
    const handleEditPayment = (payment: MemberPayment) => {
        setEditingPayment(payment);
        setEditPaymentAmount((payment.amount || 0).toString());
        setEditMilkAmount((payment.totalSellAmount || 0).toString());
        setEditPaymentVisible(true);
    };

    // Save Payment Update
    const handleSavePaymentUpdate = async () => {
        if (!editingPayment) return;

        const newAmount = parseFloat(editPaymentAmount);
        const newMilkAmount = parseFloat(editMilkAmount);

        if (isNaN(newAmount) || newAmount < 0) {
            showAlert('Error', 'Please enter a valid paid amount');
            return;
        }

        setUpdatingPayment(true);
        try {
            const res = await memberPaymentsApi.update(editingPayment._id, {
                amount: newAmount,
                totalSellAmount: isNaN(newMilkAmount) ? undefined : newMilkAmount,
            });

            if (!res.success) {
                showAlert('Error', res.message || 'Failed to update payment');
                return;
            }

            showAlert('Success', 'Payment updated successfully');
            setEditPaymentVisible(false);
            setEditingPayment(null);

            // Refresh payments
            await fetchData();
        } catch (error) {
            showAlert('Error', 'Failed to update payment');
        } finally {
            setUpdatingPayment(false);
        }
    };

    // Print members list
    const handlePrintMembers = async () => {
        if (members.length === 0) {
            showAlert('Error', 'No members to print');
            return;
        }

        const rows = members.map((item, index) => `
            <tr style="${index % 2 === 0 ? '' : 'background-color: #f9fafb;'}">
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${index + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #22c55e;">₹${item.ratePerLiter}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.mobile}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.address || '-'}</td>
            </tr>
        `).join('');

        const html = `
            <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                        h1 { color: #22c55e; text-align: center; margin-bottom: 5px; }
                        .subtitle { text-align: center; color: #666; margin-bottom: 20px; font-size: 14px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th { background-color: #22c55e; color: white; padding: 12px 10px; text-align: left; font-weight: 600; }
                        th:first-child, th:nth-child(2), th:nth-child(4) { text-align: center; }
                        .summary { margin-top: 20px; padding: 15px; background-color: #f0fdf4; border-radius: 8px; }
                        .summary-text { font-size: 14px; color: #333; }
                    </style>
                </head>
                <body>
                    <h1>Members List</h1>
                    <p class="subtitle">Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <table>
                        <tr>
                            <th style="width: 50px;">Sr.</th>
                            <th style="width: 80px;">Rate/L</th>
                            <th>Name</th>
                            <th style="width: 120px;">Mobile</th>
                            <th>Address</th>
                        </tr>
                        ${rows}
                    </table>
                    <div class="summary">
                        <p class="summary-text"><strong>Total Members:</strong> ${members.length}</p>
                    </div>
                </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                showAlert('PDF Generated', `Saved to: ${uri}`);
            }
        } catch (error) {
            showAlert('Error', 'Failed to generate PDF');
        }
    };

    const handleExportPayments = async () => {
        setIsLoading(true);
        await exportPayments(getFilteredPayments());
        setIsLoading(false);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const styles = createStyles(colors, isDark);

    // Render auto-suggest dropdown with tick marks
    const renderSuggestionDropdown = () => {
        if (!showSuggestions) return null;
        if (selectedMember) return null;

        return (
            <View style={styles.dropdown}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredMembers.map(member => (
                        <Pressable
                            key={member._id}
                            style={styles.dropdownItem}
                            onPress={() => {
                                setSelectedMember(member);
                                setSearchMember(member.name);
                                setRate(member.ratePerLiter?.toString() || '50');
                                setShowSuggestions(false);
                            }}
                        >
                            <View style={styles.dropdownItemContent}>
                                <Text style={styles.dropdownCode}>₹{member.ratePerLiter}/L</Text>
                                <Text style={styles.dropdownText}>{member.name}</Text>
                            </View>
                        </Pressable>
                    ))}
                    {filteredMembers.length === 0 && (
                        <View style={styles.dropdownEmptyContainer}>
                            <Text style={styles.dropdownEmpty}>No members found</Text>
                            <Pressable
                                style={styles.addNewBtn}
                                onPress={() => {
                                    setShowSuggestions(false);
                                    setMemberName(searchMember);
                                    setShowMemberModal(true);
                                }}
                            >
                                <Plus size={14} color={colors.primary} />
                                <Text style={styles.addNewBtnText}>Add New Member</Text>
                            </Pressable>
                        </View>
                    )}
                </ScrollView>
            </View>
        );
    };

    const renderEntryTab = () => (
        <View>
            <Text style={styles.sectionTitle}>Milk Selling Entry</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Member (Customer)</Text>
                <Pressable
                    style={styles.searchInput}
                    onPress={() => setShowSuggestions(true)}
                >
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={styles.searchTextInput}
                        placeholder="Search member by name..."
                        value={searchMember}
                        onChangeText={(text) => {
                            setSearchMember(text);
                            setShowSuggestions(true);
                            if (selectedMember) setSelectedMember(null);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        placeholderTextColor={colors.mutedForeground}
                    />
                    {selectedMember && (
                        <View style={styles.selectedBadge}>
                            <Check size={12} color={colors.white} />
                        </View>
                    )}
                    {selectedMember && (
                        <Pressable onPress={() => { setSelectedMember(null); setSearchMember(''); }}>
                            <X size={16} color={colors.destructive} />
                        </Pressable>
                    )}
                </Pressable>
                {renderSuggestionDropdown()}
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date</Text>
                    <Pressable style={styles.dateInput} onPress={() => openDatePicker('entry')}>
                        <Text style={styles.dateText}>{formatDate(entryDate)}</Text>
                        <CalendarIcon size={16} color={colors.mutedForeground} />
                    </Pressable>
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Morn (L)</Text>
                    <TextInput
                        style={styles.input}
                        value={mornQty}
                        onChangeText={setMornQty}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Eve (L)</Text>
                    <TextInput
                        style={styles.input}
                        value={eveQty}
                        onChangeText={setEveQty}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            <View style={styles.totalRow}>
                <View style={styles.totalBox}>
                    <Text style={styles.totalValue}>₹{totalAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.buttonRow}>
                    <Pressable
                        style={[styles.saveBtn, savingEntry && styles.saveBtnDisabled]}
                        onPress={handleSaveEntry}
                        disabled={savingEntry}
                    >
                        {savingEntry ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Entry</Text>
                        )}
                    </Pressable>
                    <Pressable style={styles.clearBtn} onPress={() => {
                        setMornQty('');
                        setEveQty('');
                        setSelectedMember(null);
                        setSearchMember('');
                    }} disabled={savingEntry}>
                        <Text style={styles.clearBtnText}>Clear</Text>
                    </Pressable>
                </View>
            </View>

            {/* Recent Entries Section */}
            <View style={styles.entriesHeader}>
                <Text style={styles.sectionTitle}>Recent Entries</Text>
            </View>

            {/* Recent Entries Filters */}
            <View style={styles.recentFiltersCard}>
                <View style={styles.recentFiltersRow}>
                    {/* Date Filters */}
                    <Pressable style={styles.recentDateInput} onPress={() => openDatePicker('recentStart')}>
                        <CalendarIcon size={14} color={colors.mutedForeground} />
                        <Text style={styles.recentDateText}>
                            {recentEntriesStartDate ? formatDate(recentEntriesStartDate) : 'Start Date'}
                        </Text>
                    </Pressable>
                    <Text style={styles.dateSeparator}>→</Text>
                    <Pressable style={styles.recentDateInput} onPress={() => openDatePicker('recentEnd')}>
                        <CalendarIcon size={14} color={colors.mutedForeground} />
                        <Text style={styles.recentDateText}>
                            {recentEntriesEndDate ? formatDate(recentEntriesEndDate) : 'End Date'}
                        </Text>
                    </Pressable>
                </View>

                <View style={styles.recentFiltersRow}>
                    {/* Member Filter */}
                    <View style={{ flex: 1, position: 'relative' }}>
                        <Pressable
                            style={styles.recentMemberFilter}
                            onPress={() => setShowRecentMemberDropdown(!showRecentMemberDropdown)}
                        >
                            <User size={14} color={colors.mutedForeground} />
                            <Text style={styles.recentFilterText} numberOfLines={1}>
                                {selectedRecentMemberName}
                            </Text>
                        </Pressable>

                        {showRecentMemberDropdown && (
                            <View style={styles.recentMemberDropdown}>
                                <View style={styles.memberSearchContainer}>
                                    <Search size={14} color={colors.mutedForeground} />
                                    <TextInput
                                        style={styles.memberSearchInput}
                                        placeholder="Search member..."
                                        value={recentMemberSearch}
                                        onChangeText={setRecentMemberSearch}
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>
                                <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                    <Pressable
                                        style={[styles.memberDropdownItem, !recentEntriesMemberFilter && styles.memberDropdownItemActive]}
                                        onPress={() => {
                                            setRecentEntriesMemberFilter('');
                                            setShowRecentMemberDropdown(false);
                                            setRecentMemberSearch('');
                                        }}
                                    >
                                        <Text style={[styles.memberDropdownText, !recentEntriesMemberFilter && { color: colors.primary }]}>All Members</Text>
                                    </Pressable>
                                    {filteredRecentMembers.map(member => (
                                        <Pressable
                                            key={member._id}
                                            style={[styles.memberDropdownItem, recentEntriesMemberFilter === member._id && styles.memberDropdownItemActive]}
                                            onPress={() => {
                                                setRecentEntriesMemberFilter(member._id);
                                                setShowRecentMemberDropdown(false);
                                                setRecentMemberSearch('');
                                            }}
                                        >
                                            <Text style={[styles.memberDropdownText, recentEntriesMemberFilter === member._id && { color: colors.primary }]}>{member.name}</Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    {/* Print Button */}
                    <Pressable
                        style={styles.printEntriesBtn}
                        onPress={handlePrintEntries}
                    >
                        <Printer size={14} color={colors.white} />
                        <Text style={styles.printEntriesBtnText}>Print</Text>
                    </Pressable>

                    {/* Clear Filters Button */}
                    {(recentEntriesStartDate || recentEntriesEndDate || recentEntriesMemberFilter) && (
                        <Pressable
                            style={styles.clearFiltersBtn}
                            onPress={() => {
                                setRecentEntriesStartDate('');
                                setRecentEntriesEndDate('');
                                setRecentEntriesMemberFilter('');
                            }}
                        >
                            <X size={14} color={colors.destructive} />
                            <Text style={styles.clearFiltersBtnText}>Clear</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {groupedEntries.length === 0 ? (
                <Text style={styles.emptyText}>No entries found</Text>
            ) : (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Entry</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>M/E (L)</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Amt</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Act</Text>
                    </View>
                    {groupedEntries.map((item, index) => (
                        <View key={`${item.date}-${item.memberId}-${index}`} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 1 }]}>{formatDate(item.date)}</Text>
                            <Text style={[styles.tableCell, { flex: 1.2 }]} numberOfLines={1}>{item.memberName}</Text>
                            <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'center', color: colors.primary, fontWeight: '600' }]}>{item.entryCount}</Text>
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={styles.meText}>
                                    {item.morningQty > 0 ? item.morningQty : '-'} + {item.eveningQty > 0 ? item.eveningQty : '-'}
                                </Text>
                            </View>
                            <Text style={[styles.tableCell, { flex: 0.8, color: colors.primary, fontWeight: '600' }]}>₹{item.totalAmount.toFixed(0)}</Text>
                            <View style={{ flex: 0.5, alignItems: 'center', justifyContent: 'center' }}>
                                <Pressable style={styles.deleteBtn} onPress={() => handleDeleteEntry(item.entryId)}>
                                    <Trash2 size={12} color={colors.destructive} />
                                </Pressable>
                            </View>
                        </View>
                    ))}

                    {hasMoreEntries && (
                        <Pressable
                            style={styles.loadMoreBtn}
                            onPress={handleLoadMore}
                            disabled={loadingMore}
                        >
                            {loadingMore ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={styles.loadMoreText}>Load More</Text>
                            )}
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );


    // Calculate balances - previous balance carried forward, add current milk amount, subtract paid
    const previousBalance = (memberSummary?.member?.currentBalance ?? selectedPaymentMember?.sellingPaymentBalance ?? 0);
    const currentMilkAmount = Number.parseFloat(milkAmount) || 0;
    const paidAmount = Number.parseFloat(paymentAmount) || 0;
    const netPayable = previousBalance + currentMilkAmount;
    const closingBalance = netPayable - paidAmount;

    const renderPaymentTab = () => (
        <View>
            {/* Member Search */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Select Member</Text>
                <Pressable
                    style={styles.searchInput}
                    onPress={() => setShowPaymentMemberSuggestions(true)}
                >
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={styles.searchTextInput}
                        placeholder="Search member by name..."
                        value={paymentMemberSearch}
                        onChangeText={(text) => {
                            setPaymentMemberSearch(text);
                            setShowPaymentMemberSuggestions(true);
                            if (selectedPaymentMember) {
                                setSelectedPaymentMember(null);
                                setMemberSummary(null);
                            }
                        }}
                        onFocus={() => setShowPaymentMemberSuggestions(true)}
                        onBlur={() => {
                            // Delay to allow selection to complete before hiding
                            setTimeout(() => setShowPaymentMemberSuggestions(false), 200);
                        }}
                        placeholderTextColor={colors.mutedForeground}
                    />
                    {selectedPaymentMember && (
                        <View style={styles.selectedBadge}>
                            <Check size={12} color={colors.white} />
                        </View>
                    )}
                    {selectedPaymentMember && (
                        <Pressable onPress={clearPaymentForm}>
                            <X size={16} color={colors.destructive} />
                        </Pressable>
                    )}
                </Pressable>

                {/* Member suggestions dropdown */}
                {showPaymentMemberSuggestions && !selectedPaymentMember && (
                    <View style={styles.suggestionDropdown}>
                        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                            {filteredPaymentMembers.length === 0 ? (
                                <Text style={styles.emptyText}>No members found</Text>
                            ) : (
                                filteredPaymentMembers.map((member) => (
                                    <Pressable
                                        key={member._id}
                                        style={styles.suggestionItem}
                                        onPress={() => handleSelectPaymentMember(member)}
                                    >
                                        <View>
                                            <Text style={styles.suggestionName}>{member.name}</Text>
                                            <Text style={styles.suggestionCode}>{member.mobile}</Text>
                                        </View>
                                    </Pressable>
                                ))
                            )}
                        </ScrollView>
                    </View>
                )}
            </View>

            {paymentLoading && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            )}

            {/* Member Info */}
            {selectedPaymentMember && !paymentLoading && (
                <>
                    <View style={styles.memberInfoRow}>
                        <View>
                            <Text style={styles.memberInfoName}>{selectedPaymentMember.name}</Text>
                            <Text style={styles.memberInfoMobile}>{selectedPaymentMember.mobile}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.balanceLabel}>Current Balance</Text>
                            <Text style={[styles.balanceValue, { color: previousBalance >= 0 ? colors.primary : colors.destructive }]}>
                                ₹{previousBalance.toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* Calculation Period Section - End Date Only */}
                    <View style={styles.calcPeriodCard}>
                        <View style={styles.calcPeriodHeader}>
                            <Text style={styles.calcPeriodTitle}>Calculation Period</Text>
                        </View>

                        <Pressable
                            style={styles.calcDateChip}
                            onPress={() => {
                                setCalcDateTarget('end');
                                const date = calcEndDate ? new Date(calcEndDate) : new Date();
                                setTempCalendarDate(date);
                                setShowCalcDatePicker(true);
                            }}
                        >
                            <Text style={styles.calcDateChipLabel}>Till</Text>
                            <View style={styles.calcDateChipValueRow}>
                                <CalendarIcon size={12} color={colors.primary} />
                                <Text style={[styles.calcDateChipValue, { color: colors.primary }]}>
                                    {calcEndDate ? formatDateDDMMYYYY(calcEndDate) : 'Select Date'}
                                </Text>
                            </View>
                        </Pressable>
                    </View>

                    {/* Summary Card */}
                    <View style={styles.paymentSummaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Milk Amount (₹):</Text>
                            <View style={styles.milkAmountWrapper}>
                                <Text style={styles.milkAmountPrefix}>₹</Text>
                                <Text style={[styles.milkAmountInput, { minWidth: Math.max(40, (milkAmount.length || 1) * 12) }]}>
                                    {milkAmount}
                                </Text>
                            </View>
                        </View>
                        <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }]}>
                            <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>Total Payable:</Text>
                            <Text style={[styles.summaryValue, { fontWeight: '700', color: netPayable >= 0 ? colors.primary : colors.destructive }]}>
                                ₹{netPayable.toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* Payment Amount Input */}
                    <Text style={styles.sectionLabel}>Paid Amount</Text>
                    <TextInput
                        style={styles.paidInput}
                        placeholder="Enter Paid Amount"
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        keyboardType="numeric"
                        placeholderTextColor={colors.mutedForeground}
                    />

                    {/* Closing Balance - positive means customer owes, negative means overpaid */}
                    <View style={styles.closingRow}>
                        <Text style={styles.closingLabel}>Closing Balance:</Text>
                        <Text style={[styles.closingValue, { color: closingBalance > 0 ? colors.success : closingBalance < 0 ? colors.destructive : colors.mutedForeground }]}>
                            {closingBalance < 0 ? '-' : ''}₹{Math.abs(closingBalance).toFixed(2)}
                        </Text>
                    </View>

                    {/* Save & Clear buttons */}
                    <View style={styles.paymentButtonRow}>
                        <Pressable style={styles.saveSettlementBtn} onPress={handleProcessPayment} disabled={savingPayment}>
                            <Text style={styles.saveSettlementText}>
                                {savingPayment ? 'Saving...' : 'SAVE PAYMENT'}
                            </Text>
                        </Pressable>
                    </View>
                    <Pressable style={styles.clearPaymentBtn} onPress={clearPaymentForm}>
                        <Text style={styles.clearPaymentText}>Clear</Text>
                    </Pressable>
                </>
            )}

            {/* Payment History */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                Payment History {selectedPaymentMember ? `(${selectedPaymentMember.name})` : ''}
            </Text>
            {(() => {
                // Filter payments by member if one is selected
                const filteredPayments = selectedPaymentMember
                    ? recentPayments.filter(p => p.member?._id === selectedPaymentMember._id)
                    : recentPayments;

                if (filteredPayments.length === 0) {
                    return (
                        <Text style={styles.emptyText}>
                            {selectedPaymentMember ? `No payments for ${selectedPaymentMember.name}` : 'No payments yet'}
                        </Text>
                    );
                }

                // Card format when member is selected
                if (selectedPaymentMember) {
                    return (
                        <View style={{ gap: 8 }}>
                            {filteredPayments.slice(0, 10).map((p) => (
                                <View key={p._id} style={styles.historyCard}>
                                    <View style={styles.historyCardHeader}>
                                        <Text style={[styles.historyName, { color: colors.primary, fontWeight: '700' }]}>
                                            {p.member?.name || '-'}
                                        </Text>
                                        {/* End Date in center */}
                                        {p.periodEnd && (
                                            <Text style={[styles.historyDate, { color: colors.mutedForeground, fontSize: 11 }]}>
                                                Till: {formatDateDDMMYYYY(p.periodEnd)}
                                            </Text>
                                        )}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={styles.historyDate}>{formatDateDDMMYYYY(p.date || p.createdAt || '')}</Text>
                                            <Pressable
                                                style={styles.editPaymentBtn}
                                                onPress={() => handleEditPayment(p)}
                                            >
                                                <Edit2 size={14} color={colors.primary} />
                                            </Pressable>
                                        </View>
                                    </View>

                                    {/* Milk Quantity - directly from saved payment record */}
                                    <View style={styles.historyRow}>
                                        <Text style={styles.historyLabel}>Milk Quantity:</Text>
                                        <Text style={styles.historyValue}>
                                            {(Number(p.totalQuantity) || 0).toFixed(1)} L
                                        </Text>
                                    </View>

                                    {/* Milk Rate - directly from saved payment record (rate at time of payment) */}
                                    <View style={styles.historyRow}>
                                        <Text style={styles.historyLabel}>Milk Rate:</Text>
                                        <Text style={styles.historyValue}>
                                            ₹{(Number(p.milkRate) || 0).toFixed(2)}/L
                                        </Text>
                                    </View>

                                    {/* Total Milk Amount */}
                                    <View style={styles.historyRow}>
                                        <Text style={styles.historyLabel}>Total Milk Amount:</Text>
                                        <Text style={[styles.historyValue, { color: colors.primary }]}>₹{(p.totalSellAmount || 0).toFixed(2)}</Text>
                                    </View>

                                    {/* Paid Amount */}
                                    <View style={styles.historyRow}>
                                        <Text style={styles.historyLabel}>Paid Amount:</Text>
                                        <Text style={[styles.historyValue, { color: colors.success }]}>₹{(p.amount || 0).toFixed(2)}</Text>
                                    </View>

                                    {/* Closing Balance */}
                                    {p.closingBalance !== undefined && (
                                        <View style={[styles.historyRow, { backgroundColor: colors.muted, marginHorizontal: -8, paddingHorizontal: 8, paddingVertical: 6, marginBottom: -6, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, marginTop: 6 }]}>
                                            <Text style={[styles.historyLabel, { fontWeight: '700' }]}>Closing Balance:</Text>
                                            <Text style={[
                                                styles.historyValue,
                                                {
                                                    fontWeight: '700',
                                                    color: (p.closingBalance ?? 0) > 0
                                                        ? colors.success
                                                        : (p.closingBalance ?? 0) < 0
                                                            ? colors.destructive
                                                            : colors.mutedForeground
                                                }
                                            ]}>
                                                {(p.closingBalance ?? 0) < 0 ? '-' : ''}₹{Math.abs(p.closingBalance ?? 0).toFixed(2)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    );
                }

                // Table format when no member is selected
                return (
                    <View style={styles.paymentTableContainer}>
                        {/* Table Header */}
                        <View style={styles.paymentTableHeader}>
                            <Text style={[styles.paymentTableHeaderText, { flex: 1.3 }]}>Name</Text>
                            <Text style={[styles.paymentTableHeaderText, { flex: 0.8, textAlign: 'center' }]}>Milk</Text>
                            <Text style={[styles.paymentTableHeaderText, { flex: 0.8, textAlign: 'center' }]}>Paid</Text>
                            <Text style={[styles.paymentTableHeaderText, { flex: 0.8, textAlign: 'center' }]}>Balance</Text>
                            <Text style={[styles.paymentTableHeaderText, { flex: 0.9, textAlign: 'center' }]}>Date</Text>
                            <Text style={[styles.paymentTableHeaderText, { flex: 0.9, textAlign: 'center' }]}>Till</Text>
                        </View>
                        {/* Table Rows */}
                        {filteredPayments.slice(0, 15).map((p, index) => (
                            <View key={p._id} style={[styles.paymentTableRow, index % 2 === 0 && styles.paymentTableRowAlt]}>
                                <Text style={[styles.paymentTableCell, { flex: 1.3 }]} numberOfLines={1}>{p.member?.name || '-'}</Text>
                                <Text style={[styles.paymentTableCell, { flex: 0.8, textAlign: 'center', color: colors.primary }]}>₹{(p.totalSellAmount || 0).toFixed(0)}</Text>
                                <Text style={[styles.paymentTableCell, { flex: 0.8, textAlign: 'center', color: colors.success }]}>₹{(p.amount || 0).toFixed(0)}</Text>
                                <Text style={[styles.paymentTableCell, { flex: 0.8, textAlign: 'center', color: (p.closingBalance ?? 0) > 0 ? colors.success : (p.closingBalance ?? 0) < 0 ? colors.destructive : colors.mutedForeground }]}>{(p.closingBalance ?? 0) < 0 ? '-' : ''}₹{Math.abs(p.closingBalance ?? 0).toFixed(0)}</Text>
                                <Text style={[styles.paymentTableCell, { flex: 0.9, textAlign: 'center', fontSize: 9 }]}>{formatDateDDMMYYYY(p.date || p.createdAt || '')}</Text>
                                <Text style={[styles.paymentTableCell, { flex: 0.9, textAlign: 'center', fontSize: 9 }]}>{p.periodEnd ? formatDateDDMMYYYY(p.periodEnd) : '-'}</Text>
                            </View>
                        ))}
                    </View>
                );
            })()}
        </View>
    );

    const renderReportsTab = () => {
        // Get selected member for report from balance report data (server data)
        const selectedReportMember = reportMemberFilter
            ? balanceReportData.find(m => m._id === reportMemberFilter)
            : null;

        // Use server-provided summary for totals
        const totalMembers = balanceReportSummary?.totalMembers || 0;
        const totalUnpaidQuantity = balanceReportSummary?.totalUnpaidQuantity || 0;
        const netBalance = balanceReportSummary?.netBalance || 0;
        const totalReceivable = balanceReportSummary?.totalReceivable || 0;
        const totalPayable = balanceReportSummary?.totalPayable || 0;

        // Data to display in table (filtered by selected member or all)
        const displayData = selectedReportMember ? [selectedReportMember] : balanceReportData;

        return (
            <View>
                <Text style={styles.sectionTitle}>Selling Report</Text>

                {/* Top Summary Cards - Only show when no member is selected */}
                {!selectedReportMember && (
                    <View style={styles.reportSummary}>
                        <View style={styles.reportCard}>
                            <Text style={styles.reportCardLabel}>Total Members</Text>
                            <Text style={styles.reportCardValue}>{totalMembers}</Text>
                        </View>
                        <View style={styles.reportCard}>
                            <Text style={styles.reportCardLabel}>Unpaid Qty</Text>
                            <Text style={styles.reportCardValue}>{totalUnpaidQuantity.toFixed(1)} L</Text>
                        </View>
                        <View style={styles.reportCard}>
                            <Text style={styles.reportCardLabel}>Net Balance</Text>
                            <Text style={[styles.reportCardValue, { color: netBalance >= 0 ? colors.success : colors.destructive }]}>
                                {netBalance < 0 ? '-' : ''}₹{Math.abs(netBalance).toFixed(0)}
                            </Text>
                        </View>
                    </View>
                )}


                {/* Export Buttons */}
                <View style={styles.exportBtnsRow}>
                    <Pressable style={styles.pdfBtn} onPress={handleReportPDF}>
                        <FileText size={16} color={colors.white} />
                        <Text style={styles.exportText}>Download PDF</Text>
                    </Pressable>
                    <Pressable style={styles.csvBtn} onPress={handleReportPrint}>
                        <Printer size={14} color={colors.primary} />
                        <Text style={styles.csvBtnText}>Print</Text>
                    </Pressable>
                </View>

                {/* Member Filter Only */}
                <View style={styles.filterCard}>
                    <View style={styles.memberFilterRow}>
                        <Text style={styles.memberFilterLabel}>Member:</Text>
                        {showReportMemberDropdown ? (
                            <View style={[styles.memberFilterBtn, { paddingVertical: 0 }]}>
                                <Search size={14} color={colors.primary} />
                                <TextInput
                                    style={[styles.memberSearchInput, { flex: 1, paddingVertical: 8 }]}
                                    placeholder="Search by name or mobile..."
                                    value={reportMemberSearch}
                                    onChangeText={setReportMemberSearch}
                                    placeholderTextColor={colors.mutedForeground}
                                    autoFocus
                                />
                                <Pressable
                                    onPress={() => {
                                        setReportMemberSearch('');
                                        setShowReportMemberDropdown(false);
                                    }}
                                >
                                    <X size={14} color={colors.destructive} />
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                style={styles.memberFilterBtn}
                                onPress={() => setShowReportMemberDropdown(true)}
                            >
                                <User size={14} color={colors.primary} />
                                <Text style={styles.memberFilterText} numberOfLines={1}>{selectedReportMemberName}</Text>
                                {reportMemberFilter && (
                                    <Pressable
                                        onPress={(e) => {
                                            e.stopPropagation?.();
                                            setReportMemberFilter('');
                                        }}
                                    >
                                        <X size={14} color={colors.destructive} />
                                    </Pressable>
                                )}
                            </Pressable>
                        )}
                    </View>
                    {showReportMemberDropdown && (
                        <View style={styles.memberFilterDropdown}>
                            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                <Pressable
                                    style={[styles.memberFilterItem, !reportMemberFilter && styles.memberFilterItemActive]}
                                    onPress={() => {
                                        setReportMemberFilter('');
                                        setReportMemberSearch('');
                                        setShowReportMemberDropdown(false);
                                    }}
                                >
                                    <Text style={styles.memberFilterItemText}>All Members</Text>
                                    {!reportMemberFilter && <Check size={14} color={colors.primary} />}
                                </Pressable>
                                {filteredReportMembers.map(member => (
                                    <Pressable
                                        key={member._id}
                                        style={[styles.memberFilterItem, reportMemberFilter === member._id && styles.memberFilterItemActive]}
                                        onPress={() => {
                                            setReportMemberFilter(member._id);
                                            setReportMemberSearch('');
                                            setShowReportMemberDropdown(false);
                                        }}
                                    >
                                        <Text style={styles.memberFilterItemText}>{member.name}</Text>
                                        {reportMemberFilter === member._id && <Check size={14} color={colors.primary} />}
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* All Members Balance Table */}
                <View style={styles.memberSummarySection}>
                    <Text style={styles.memberSummaryTitle}>
                        {selectedReportMember ? 'Member Details' : 'All Members Balance'}
                    </Text>

                    {balanceReportLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
                    ) : displayData.length === 0 ? (
                        <Text style={styles.emptyText}>No members found</Text>
                    ) : (
                        <View style={styles.table}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderCell, { flex: 0.4, textAlign: 'center' }]}>Sr</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Name</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Date</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Till</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: 'right', paddingRight: 4 }]}>Balance</Text>
                            </View>
                            {displayData.map((member, index) => {
                                // totalBalance = currentBalance (after last payment) + unpaidAmount (unpaid entries)
                                // Positive = member owes money (receivable), Negative = member has credit/overpaid (payable)
                                const balance = member.totalBalance;

                                return (
                                    <View key={member._id} style={[styles.tableRow, index % 2 === 0 && { backgroundColor: colors.muted + '30' }]}>
                                        <Text style={[styles.tableCell, { flex: 0.4, textAlign: 'center', color: colors.mutedForeground }]}>{index + 1}</Text>
                                        <Text style={[styles.tableCell, { flex: 1.5, fontWeight: '500' }]} numberOfLines={1}>{member.name}</Text>
                                        <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontSize: 10 }]}>{formatDateDDMMYYYY(member.date)}</Text>
                                        <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontSize: 10, color: member.lastPeriodEnd ? colors.primary : colors.mutedForeground }]}>
                                            {member.lastPeriodEnd ? formatDateDDMMYYYY(member.lastPeriodEnd) : '-'}
                                        </Text>
                                        <Text style={[
                                            styles.tableCell,
                                            {
                                                flex: 1.1,
                                                textAlign: 'right',
                                                paddingRight: 4,
                                                fontWeight: '700',
                                                color: balance > 0
                                                    ? colors.success
                                                    : balance < 0
                                                        ? colors.destructive
                                                        : colors.foreground
                                            }
                                        ]}>
                                            {balance < 0 ? '-' : balance > 0 ? '+' : ''}₹{Math.abs(balance).toFixed(0)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </View>
        );
    };

    // Search members with server-side search
    const handleMemberTabSearch = useCallback(async (searchText: string) => {
        setMemberTabSearch(searchText);
        setMemberSearchLoading(true);
        try {
            const res = await membersApi.getAll({ search: searchText.trim() || undefined });
            if (res.success) {
                setMembers(res.response?.data || []);
            }
        } catch (error) {
            console.error('Member search error:', error);
        } finally {
            setMemberSearchLoading(false);
        }
    }, []);

    const renderMemberTab = () => (
        <View>
            <View style={styles.memberHeader}>
                <View style={styles.memberSearchContainer}>
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={styles.memberTabSearchInput}
                        placeholder="Search members..."
                        placeholderTextColor={colors.mutedForeground}
                        value={memberTabSearch}
                        onChangeText={handleMemberTabSearch}
                    />
                    {memberSearchLoading && (
                        <ActivityIndicator size="small" color={colors.primary} />
                    )}
                </View>
                <View style={styles.memberHeaderBtns}>
                    <Pressable style={styles.printMemberBtn} onPress={handlePrintMembers}>
                        <Printer size={14} color={colors.primary} />
                        <Text style={styles.printMemberText}>Print</Text>
                    </Pressable>
                    <Pressable
                        style={styles.addMemberBtn}
                        onPress={() => {
                            clearMemberForm();
                            setShowMemberModal(true);
                        }}
                    >
                        <Plus size={14} color={colors.white} />
                        <Text style={styles.addMemberBtnText}>Add</Text>
                    </Pressable>
                </View>
            </View>

            <Text style={styles.memberManagementTitle}>Member Management</Text>
            <Text style={[styles.sectionTitle, { marginTop: 4, fontSize: 13 }]}>Members List ({members.length})</Text>

            {members.length === 0 ? (
                <Text style={styles.emptyText}>No members yet. Add your first member.</Text>
            ) : (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Rate</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Mobile</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Actions</Text>
                    </View>
                    {members.map((item) => (
                        <View key={item._id} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 0.6 }]}>₹{item.ratePerLiter}</Text>
                            <Text style={[styles.tableCell, { flex: 1.2 }]}>{item.name}</Text>
                            <Text style={[styles.tableCell, { flex: 1 }]}>{item.mobile}</Text>
                            <View style={{ flex: 0.6, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                                <Pressable style={styles.editBtn} onPress={() => handleEditMember(item)}>
                                    <Edit2 size={12} color={colors.primary} />
                                </Pressable>
                                <Pressable style={styles.deleteBtn} onPress={() => handleDeleteMember(item._id)}>
                                    <Trash2 size={12} color={colors.destructive} />
                                </Pressable>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );

    // Member Modal - Centered (rebuilt)
    const renderMemberModal = () => (
        <Modal
            visible={showMemberModal}
            animationType="fade"
            transparent
            onRequestClose={() => setShowMemberModal(false)}
        >
            <View style={styles.centeredModalOverlay}>
                {/* Tap outside to close */}
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowMemberModal(false)} />

                <View style={styles.centeredModalContainer}>
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        {/* Header */}
                        <View style={styles.memberModalHeader}>
                            <View style={styles.memberModalHeaderLeft}>
                                <View style={styles.memberModalIcon}>
                                    <User size={20} color={colors.white} />
                                </View>
                                <Text style={styles.memberModalTitle}>{editingMember ? 'Edit Member' : 'Add New Member'}</Text>
                            </View>
                            <Pressable style={styles.memberModalCloseBtn} onPress={() => setShowMemberModal(false)}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        {/* Body */}
                        <ScrollView
                            style={styles.memberModalBody}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.memberModalBodyContent}
                        >
                            <View style={styles.memberFormCard}>
                                <View style={styles.modalInputGroup}>
                                    <Text style={styles.label}>Rate Per Liter (₹) <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="50"
                                        value={memberRatePerLiter}
                                        onChangeText={setMemberRatePerLiter}
                                        keyboardType="decimal-pad"
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>
                                <View style={styles.modalInputGroup}>
                                    <Text style={styles.label}>Name <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Full Name"
                                        value={memberName}
                                        onChangeText={setMemberName}
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>
                                <View style={styles.modalInputGroup}>
                                    <Text style={styles.label}>Mobile <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="10-digit number"
                                        value={memberMobile}
                                        onChangeText={setMemberMobile}
                                        keyboardType="phone-pad"
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>
                                <View style={styles.modalInputGroup}>
                                    <Text style={styles.label}>Address</Text>
                                    <TextInput
                                        style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                                        placeholder="Village/City"
                                        value={memberAddress}
                                        onChangeText={setMemberAddress}
                                        placeholderTextColor={colors.mutedForeground}
                                        multiline
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.memberModalFooter}>
                            <Pressable style={styles.memberModalCancelBtn} onPress={() => setShowMemberModal(false)}>
                                <Text style={styles.memberModalCancelBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.memberModalSaveBtn} onPress={handleSaveMember} disabled={isLoading}>
                                {isLoading ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <Text style={styles.memberModalSaveBtnText}>{editingMember ? 'Update Member' : 'Save Member'}</Text>
                                )}
                            </Pressable>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </View>
        </Modal>
    );

    return (
        <View style={styles.container}>
            {/* Subscription Modal - Full screen */}
            <SubscriptionModal
                visible={showSubscriptionModal}
                onClose={handleModalClose}
                onSubscribe={handleSubscriptionSuccess}
                filterTab="selling"
                title="Subscribe to Access Selling"
                fullScreen={true}
            />
            <TopBar />
            <View style={styles.tabRow}>
                {(['Entry', 'Payment', 'Reports', 'Member'] as TabType[]).map((tab) => (
                    <Pressable
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                    </Pressable>
                ))}
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
                keyboardShouldPersistTaps="handled"
            >
                {isLoading && recentEntries.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Loading...</Text>
                    </View>
                ) : (
                    <>
                        {activeTab === 'Entry' && renderEntryTab()}
                        {activeTab === 'Payment' && renderPaymentTab()}
                        {activeTab === 'Reports' && renderReportsTab()}
                        {activeTab === 'Member' && renderMemberTab()}
                    </>
                )}
            </ScrollView>

            {/* Date Picker Modal - Bottom Sheet Style */}
            <Modal visible={showDatePicker} animationType="slide" transparent onRequestClose={() => setShowDatePicker(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.dateModalContent}>
                        <View style={styles.dateModalHeader}>
                            <Text style={styles.dateModalTitle}>
                                {datePickerTarget === 'entry' ? 'Select Entry Date' : datePickerTarget === 'reportStart' ? 'Select Start Date' : 'Select End Date'}
                            </Text>
                            <Pressable onPress={() => setShowDatePicker(false)}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                        <View style={styles.calendarBody}>
                            <Calendar
                                selectedDate={tempCalendarDate}
                                onDateSelect={(date) => {
                                    if (date) {
                                        const y = date.getFullYear();
                                        const m = String(date.getMonth() + 1).padStart(2, '0');
                                        const d = String(date.getDate()).padStart(2, '0');
                                        const dateStr = `${y}-${m}-${d}`;
                                        handleDateSelect(dateStr);
                                        setShowDatePicker(false);
                                    }
                                }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Calculation Period Date Picker Modal */}
            <Modal visible={showCalcDatePicker} animationType="slide" transparent onRequestClose={() => setShowCalcDatePicker(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.dateModalContent}>
                        <View style={styles.dateModalHeader}>
                            <Text style={styles.dateModalTitle}>Select Till Date</Text>
                            <Pressable onPress={() => setShowCalcDatePicker(false)}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                        <View style={styles.calendarBody}>
                            <SellingPaymentCalendar
                                selectedDate={tempCalendarDate}
                                blockedBeforeDate={calcStartDate}
                                onDateSelect={async (date) => {
                                    if (date) {
                                        const y = date.getFullYear();
                                        const m = String(date.getMonth() + 1).padStart(2, '0');
                                        const d = String(date.getDate()).padStart(2, '0');
                                        const dateStr = `${y}-${m}-${d}`;
                                        await handleEndDateChange(dateStr);
                                        setShowCalcDatePicker(false);
                                    }
                                }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Range Modal */}
            <Modal visible={showAddRangeModal} animationType="slide" transparent onRequestClose={() => setShowAddRangeModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.addRangeModalContent}>
                        <View style={styles.dateModalHeader}>
                            <Text style={styles.dateModalTitle}>Add Date Range</Text>
                            <Pressable onPress={() => setShowAddRangeModal(false)}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        <View style={styles.addRangeModalBody}>
                            <Text style={styles.addRangeInputLabel}>Start Day (1-31)</Text>
                            <TextInput
                                style={styles.addRangeInput}
                                placeholder="e.g. 1"
                                value={newRangeStartDay}
                                onChangeText={setNewRangeStartDay}
                                keyboardType="number-pad"
                                maxLength={2}
                                placeholderTextColor={colors.mutedForeground}
                            />

                            <Text style={styles.addRangeInputLabel}>End Day</Text>
                            <View style={styles.endDayRow}>
                                <TextInput
                                    style={[styles.addRangeInput, { flex: 1, opacity: newRangeIsEnd ? 0.5 : 1 }]}
                                    placeholder="e.g. 10"
                                    value={newRangeEndDay}
                                    onChangeText={setNewRangeEndDay}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                    editable={!newRangeIsEnd}
                                    placeholderTextColor={colors.mutedForeground}
                                />
                                <Pressable
                                    style={[styles.endOfMonthBtn, newRangeIsEnd && styles.endOfMonthBtnActive]}
                                    onPress={() => setNewRangeIsEnd(!newRangeIsEnd)}
                                >
                                    <Text style={[styles.endOfMonthBtnText, newRangeIsEnd && styles.endOfMonthBtnTextActive]}>
                                        End of Month
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        <View style={styles.dateModalFooter}>
                            <Pressable style={styles.cancelModalBtn} onPress={() => setShowAddRangeModal(false)}>
                                <Text style={styles.cancelModalBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={styles.confirmModalBtn}
                                onPress={() => {
                                    const startDay = parseInt(newRangeStartDay);
                                    const endDay = newRangeIsEnd ? 'End' : parseInt(newRangeEndDay);

                                    if (isNaN(startDay) || startDay < 1 || startDay > 31) {
                                        showAlert('Error', 'Please enter a valid start day (1-31)');
                                        return;
                                    }

                                    if (!newRangeIsEnd && (isNaN(endDay as number) || (endDay as number) < 1 || (endDay as number) > 31)) {
                                        showAlert('Error', 'Please enter a valid end day (1-31)');
                                        return;
                                    }

                                    if (!newRangeIsEnd && startDay > (endDay as number)) {
                                        showAlert('Error', 'Start day must be less than end day');
                                        return;
                                    }

                                    const newRange: DateRange = {
                                        id: String(Date.now()),
                                        startDay,
                                        endDay,
                                        label: newRangeIsEnd ? `${startDay}-End` : `${startDay}-${endDay}`,
                                    };
                                    setDateRanges(prev => [...prev, newRange]);
                                    setShowAddRangeModal(false);
                                }}
                            >
                                <Text style={styles.confirmModalBtnText}>Add</Text>
                            </Pressable>
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

            <ConfirmationModal
                visible={confirmVisible}
                onClose={() => setConfirmVisible(false)}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
                confirmText="Delete"
                cancelText="Cancel"
                confirmDestructive
            />

            {/* Edit Payment Modal */}
            <Modal
                visible={editPaymentVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setEditPaymentVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.editPaymentModalOverlay}
                >
                    <Pressable style={{ flex: 1 }} onPress={() => setEditPaymentVisible(false)} />
                    <View style={[styles.editPaymentModalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.editPaymentModalHeader}>
                            <Text style={[styles.editPaymentModalTitle, { color: colors.foreground }]}>
                                Edit Payment
                            </Text>
                            <Pressable onPress={() => setEditPaymentVisible(false)} style={styles.editPaymentModalClose}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        {editingPayment && (
                            <View style={styles.editPaymentModalBody}>
                                <Text style={[styles.editPaymentMemberName, { color: colors.primary }]}>
                                    {editingPayment.member?.name || '-'}
                                </Text>

                                <View style={styles.editPaymentInputGroup}>
                                    <Text style={[styles.editPaymentLabel, { color: colors.foreground }]}>
                                        Milk Amount (₹)
                                    </Text>
                                    <TextInput
                                        style={[styles.editPaymentInput, {
                                            backgroundColor: colors.muted,
                                            color: colors.foreground,
                                            borderColor: colors.border
                                        }]}
                                        value={editMilkAmount}
                                        onChangeText={setEditMilkAmount}
                                        keyboardType="numeric"
                                        placeholder="Milk amount"
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>

                                <View style={styles.editPaymentInputGroup}>
                                    <Text style={[styles.editPaymentLabel, { color: colors.foreground }]}>
                                        Paid Amount (₹)
                                    </Text>
                                    <TextInput
                                        style={[styles.editPaymentInput, {
                                            backgroundColor: colors.muted,
                                            color: colors.foreground,
                                            borderColor: colors.border
                                        }]}
                                        value={editPaymentAmount}
                                        onChangeText={setEditPaymentAmount}
                                        keyboardType="numeric"
                                        placeholder="Paid amount"
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>

                                {/* Summary */}
                                <View style={[styles.editPaymentSummary, { backgroundColor: colors.muted }]}>
                                    <View style={styles.editPaymentSummaryRow}>
                                        <Text style={[styles.editPaymentSummaryLabel, { color: colors.mutedForeground }]}>
                                            Original Milk Amount:
                                        </Text>
                                        <Text style={[styles.editPaymentSummaryValue, { color: colors.primary }]}>
                                            ₹{(editingPayment.totalSellAmount || 0).toFixed(2)}
                                        </Text>
                                    </View>
                                    <View style={styles.editPaymentSummaryRow}>
                                        <Text style={[styles.editPaymentSummaryLabel, { color: colors.mutedForeground }]}>
                                            Original Paid:
                                        </Text>
                                        <Text style={[styles.editPaymentSummaryValue, { color: colors.success }]}>
                                            ₹{(editingPayment.amount || 0).toFixed(2)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Buttons */}
                                <View style={styles.editPaymentBtnRow}>
                                    <Pressable
                                        style={[styles.editPaymentCancelBtn, { backgroundColor: colors.muted }]}
                                        onPress={() => setEditPaymentVisible(false)}
                                    >
                                        <Text style={[styles.editPaymentCancelBtnText, { color: colors.foreground }]}>
                                            Cancel
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.editPaymentSaveBtn, { backgroundColor: colors.primary }]}
                                        onPress={handleSavePaymentUpdate}
                                        disabled={updatingPayment}
                                    >
                                        <Text style={styles.editPaymentSaveBtnText}>
                                            {updatingPayment ? 'Saving...' : 'Save Changes'}
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {renderMemberModal()}
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    tabRow: {
        flexDirection: 'row',
        paddingHorizontal: 6,
        gap: 6,
        marginTop: 8,
        marginBottom: 12,
        backgroundColor: colors.muted,
        paddingVertical: 6,
        borderRadius: 10,
        marginHorizontal: 6,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: 'transparent',
    },
    tabActive: {
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.mutedForeground,
    },
    tabTextActive: {
        color: colors.white,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 6,
        paddingBottom: 100,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: 10,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    inputGroup: {
        flex: 1,
        marginBottom: 10,
    },
    label: {
        fontSize: 12,
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
        paddingVertical: 10,
        fontSize: 14,
        color: colors.foreground,
    },
    inputDisabled: {
        backgroundColor: colors.muted,
        opacity: 0.7,
    },
    searchInput: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchTextInput: {
        flex: 1,
        fontSize: 14,
        color: colors.foreground,
        padding: 0,
    },
    selectedBadge: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        padding: 2,
    },
    dateInput: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dateText: {
        fontSize: 14,
        color: colors.foreground,
    },
    dropdown: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        marginTop: 4,
        zIndex: 100,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    dropdownItem: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    dropdownItemSelected: {
        backgroundColor: colors.primary + '15',
    },
    dropdownItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dropdownCode: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.primary,
        backgroundColor: colors.primary + '20',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    dropdownText: {
        fontSize: 14,
        color: colors.foreground,
        flex: 1,
    },
    dropdownEmptyContainer: {
        padding: 12,
        alignItems: 'center',
    },
    dropdownEmpty: {
        fontSize: 13,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginBottom: 8,
    },
    addNewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: colors.primary + '15',
        borderRadius: 6,
    },
    addNewBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.primary,
    },
    totalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    totalBox: {
        backgroundColor: colors.secondary,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderStyle: 'dashed',
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    buttonRow: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
    },
    saveBtn: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: 12,
        borderRadius: 6,
        alignItems: 'center',
    },
    saveBtnText: {
        color: colors.white,
        fontSize: 13,
        fontWeight: '600',
    },
    saveBtnDisabled: {
        backgroundColor: '#86efac',
        opacity: 0.7,
    },
    clearBtn: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 6,
        backgroundColor: colors.muted,
        alignItems: 'center',
    },
    clearBtnText: {
        color: colors.foreground,
        fontSize: 13,
        fontWeight: '600',
    },
    entriesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    lastCount: {
        fontSize: 11,
        color: colors.mutedForeground,
    },
    emptyText: {
        fontSize: 13,
        color: colors.mutedForeground,
        textAlign: 'center',
        paddingVertical: 20,
    },
    table: {
        backgroundColor: colors.card,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        marginTop: 8,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: colors.primary,
        paddingVertical: 10,
        paddingHorizontal: 6,
    },
    tableHeaderCell: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.white,
        textAlign: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        alignItems: 'center',
    },
    tableCell: {
        fontSize: 12,
        color: colors.foreground,
        textAlign: 'center',
    },
    meText: {
        fontSize: 12,
        color: colors.foreground,
        fontWeight: '500',
        textAlign: 'center',
    },
    deleteBtn: {
        padding: 6,
        backgroundColor: colors.destructive + '20',
        borderRadius: 4,
    },
    editBtn: {
        padding: 6,
        backgroundColor: colors.primary + '20',
        borderRadius: 4,
    },
    loadMoreBtn: {
        paddingVertical: 12,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    loadMoreText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.primary,
    },
    memberChips: {
        marginTop: 4,
    },
    memberChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: 8,
    },
    memberChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    memberChipText: {
        fontSize: 12,
        color: colors.foreground,
    },
    memberChipTextActive: {
        color: colors.white,
    },
    summaryCard: {
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 13,
        color: colors.mutedForeground,
    },
    summaryValue: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
    },
    summaryTotal: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        marginTop: 4,
    },
    summaryTotalLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
    },
    summaryTotalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    methodRow: {
        flexDirection: 'row',
        gap: 8,
    },
    methodBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 6,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
    },
    methodBtnActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    methodText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.foreground,
    },
    methodTextActive: {
        color: colors.white,
    },
    payBtn: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    payBtnText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '700',
    },
    filterCard: {
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 10,
    },
    dateFilterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateFilterBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.secondary,
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dateFilterText: {
        fontSize: 13,
        color: colors.foreground,
    },
    dateFilterSeparator: {
        fontSize: 13,
        color: colors.mutedForeground,
    },
    reportSummary: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    reportCard: {
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    reportCardLabel: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginBottom: 4,
    },
    reportCardValue: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    memberSummarySection: {
        marginBottom: 16,
    },
    memberSummaryTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 10,
    },
    reportSummaryCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    reportSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    reportSummaryLabel: {
        fontSize: 14,
        color: colors.mutedForeground,
        fontWeight: '500',
    },
    reportSummaryValue: {
        fontSize: 16,
        color: colors.foreground,
        fontWeight: '600',
    },
    exportBtnsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    pdfBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: colors.primary,
        paddingVertical: 12,
        borderRadius: 6,
    },
    printBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: colors.secondary,
        paddingVertical: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    exportText: {
        color: colors.white,
        fontSize: 13,
        fontWeight: '600',
    },
    csvBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: colors.card,
        paddingVertical: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    csvBtnText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '600',
    },
    memberHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        gap: 10,
    },
    memberSearchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: isDark ? colors.muted : colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    memberTabSearchInput: {
        flex: 1,
        fontSize: 14,
        color: colors.foreground,
        padding: 0,
    },
    memberManagementTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
        marginBottom: 4,
    },
    memberHeaderBtns: {
        flexDirection: 'row',
        gap: 8,
    },
    printMemberBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: colors.card,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    printMemberText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.primary,
    },
    addMemberBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: colors.primary,
        borderRadius: 6,
    },
    addMemberBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.white,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 14,
        color: colors.mutedForeground,
    },
    // Modal styles
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: 50,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalBody: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: colors.muted,
        alignItems: 'center',
    },
    modalCancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    modalSaveBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    modalSaveBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.white,
    },
    comingSoonContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
    },
    comingSoonText: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: 8,
    },
    comingSoonSubtext: {
        fontSize: 14,
        color: colors.mutedForeground,
    },
    // Bottom sheet modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    dateModalContent: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 20,
    },
    dateModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    dateModalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
    },
    calendarBody: {
        padding: 8,
    },
    dateModalFooter: {
        flexDirection: 'row',
        padding: 12,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    cancelModalBtn: {
        flex: 1,
        backgroundColor: colors.muted,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    cancelModalBtnText: {
        color: colors.foreground,
        fontSize: 14,
        fontWeight: '600',
    },
    confirmModalBtn: {
        flex: 1,
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    confirmModalBtnText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
    },
    // Bottom sheet member modal styles
    bottomSheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheetContent: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
    },
    bottomSheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    bottomSheetTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
    },
    bottomSheetBody: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    bottomSheetFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    // Centered Modal Styles
    centeredModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    centeredModalContainer: {
        width: '100%',
        maxWidth: 420,
        height: '80%',
        maxHeight: '85%',
        backgroundColor: colors.card,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    // Member Modal Full Screen Styles
    memberModalFullScreen: {
        flex: 1,
        backgroundColor: colors.card,
    },
    memberModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.card,
    },
    memberModalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    memberModalIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    memberModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
    },
    memberModalCloseBtn: {
        padding: 8,
        backgroundColor: colors.muted,
        borderRadius: 10,
    },
    memberModalBody: {
        flex: 1,
        paddingHorizontal: 16,
    },
    memberModalBodyContent: {
        paddingBottom: 30,
        paddingTop: 16,
    },
    memberFormCard: {
        backgroundColor: colors.background,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalInputGroup: {
        marginBottom: 16,
    },
    modalInput: {
        backgroundColor: isDark ? colors.muted : colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 15,
        color: colors.foreground,
    },
    memberModalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        paddingBottom: 30,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.card,
    },
    memberModalCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.muted,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    memberModalCancelBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.foreground,
    },
    memberModalSaveBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    memberModalSaveBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.white,
    },
    // Member Filter Styles for Reports
    memberFilterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 12,
    },
    memberFilterLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.mutedForeground,
    },
    memberFilterBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: isDark ? colors.muted : colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    memberFilterText: {
        flex: 1,
        fontSize: 13,
        color: colors.foreground,
    },
    memberFilterDropdown: {
        marginTop: 8,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        overflow: 'hidden',
    },
    memberFilterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    memberFilterItemActive: {
        backgroundColor: colors.primary + '15',
    },
    memberFilterItemText: {
        fontSize: 14,
        color: colors.foreground,
    },
    // Recent Entries Filters
    recentFiltersCard: {
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    recentFiltersRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    recentDateInput: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: isDark ? colors.muted : colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    recentDateText: {
        fontSize: 12,
        color: colors.foreground,
    },
    dateSeparator: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    recentMemberFilter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: isDark ? colors.muted : colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    recentFilterText: {
        flex: 1,
        fontSize: 12,
        color: colors.foreground,
    },
    recentMemberDropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        marginTop: 4,
        zIndex: 100,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    // memberSearchContainer: {
    //     flexDirection: 'row',
    //     alignItems: 'center',
    //     gap: 8,
    //     paddingHorizontal: 10,
    //     paddingVertical: 8,
    //     borderBottomWidth: 1,
    //     borderBottomColor: colors.border,
    // },
    memberSearchInput: {
        flex: 1,
        fontSize: 13,
        color: colors.foreground,
        padding: 0,
    },
    memberDropdownItem: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    memberDropdownItemActive: {
        backgroundColor: colors.primary + '15',
    },
    memberDropdownText: {
        fontSize: 13,
        color: colors.foreground,
    },
    clearFiltersBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 8,
        backgroundColor: colors.destructive + '15',
        borderRadius: 6,
    },
    clearFiltersBtnText: {
        fontSize: 11,
        fontWeight: '500',
        color: colors.destructive,
    },
    pdfDownloadBtn: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    printEntriesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    printEntriesBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.white,
    },
    // Payment tab styles
    suggestionDropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        marginTop: 4,
        zIndex: 100,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    suggestionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    suggestionName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    suggestionCode: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    suggestionBalance: {
        fontSize: 14,
        fontWeight: '700',
    },
    memberInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.card,
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    memberInfoName: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
    },
    memberInfoMobile: {
        fontSize: 13,
        color: colors.mutedForeground,
    },
    balanceLabel: {
        fontSize: 11,
        color: colors.mutedForeground,
    },
    balanceValue: {
        fontSize: 18,
        fontWeight: '700',
    },
    paymentSummaryCard: {
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 8,
    },
    paidInput: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: colors.foreground,
        marginBottom: 12,
    },
    paymentMethodRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    paymentMethodBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 6,
        backgroundColor: colors.muted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    paymentMethodBtnActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    paymentMethodText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.foreground,
    },
    paymentMethodTextActive: {
        color: colors.white,
    },
    closingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    closingLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    closingValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    milkAmountWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? colors.muted : colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    milkAmountPrefix: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    milkAmountInput: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
        paddingHorizontal: 4,
        paddingVertical: 4,
        textAlign: 'left',
    },
    paymentButtonRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    saveSettlementBtn: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    saveSettlementText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '700',
    },
    clearPaymentBtn: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    clearPaymentText: {
        color: colors.mutedForeground,
        fontSize: 13,
        fontWeight: '600',
    },
    historyCard: {
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    historyCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    historyName: {
        fontSize: 14,
        fontWeight: '700',
    },
    historyDate: {
        fontSize: 11,
        color: colors.mutedForeground,
    },
    historyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 2,
    },
    historyLabel: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    historyValue: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.foreground,
    },
    // Payment table styles
    paymentTableContainer: {
        backgroundColor: colors.card,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    paymentTableHeader: {
        flexDirection: 'row',
        backgroundColor: colors.primary,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    paymentTableHeaderText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.white,
    },
    paymentTableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    paymentTableRowAlt: {
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    },
    paymentTableCell: {
        fontSize: 12,
        color: colors.foreground,
    },
    // Calculation Period styles
    calcPeriodCard: {
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    calcPeriodHeader: {
        marginBottom: 12,
    },
    calcPeriodTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
    },
    calcDateChip: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        backgroundColor: colors.primary + '10',
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    calcDateChipLabel: {
        fontSize: 10,
        fontWeight: '500',
        color: colors.mutedForeground,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    calcDateChipValue: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
    },
    calcDateChipValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    calcDateSeparator: {
        fontSize: 13,
        color: colors.mutedForeground,
        fontWeight: '500',
    },
    dateRangesLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 10,
    },
    dateRangesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 12,
    },
    dateRangeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? colors.muted : colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        overflow: 'hidden',
    },
    dateRangeChipContent: {
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    dateRangeChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
    },
    dateRangeDeleteBtn: {
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderLeftWidth: 1,
        borderLeftColor: colors.border,
    },
    addRangeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 8,
        borderStyle: 'dashed',
        minWidth: 100,
    },
    addRangeBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.primary,
    },
    // Add Range Modal styles
    addRangeModalContent: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 20,
    },
    addRangeModalBody: {
        padding: 20,
    },
    addRangeInputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 8,
    },
    addRangeInput: {
        backgroundColor: isDark ? colors.muted : colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.foreground,
        marginBottom: 16,
    },
    endDayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    endOfMonthBtn: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        backgroundColor: isDark ? colors.muted : colors.background,
    },
    endOfMonthBtnActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    endOfMonthBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.mutedForeground,
    },
    endOfMonthBtnTextActive: {
        color: colors.white,
    },
    // Edit Payment Modal styles
    editPaymentModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    editPaymentModalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    editPaymentModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    editPaymentModalTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    editPaymentModalClose: {
        padding: 4,
    },
    editPaymentModalBody: {
        padding: 16,
    },
    editPaymentMemberName: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 16,
    },
    editPaymentInputGroup: {
        marginBottom: 16,
    },
    editPaymentLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    editPaymentInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
    },
    editPaymentSummary: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    editPaymentSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    editPaymentSummaryLabel: {
        fontSize: 13,
    },
    editPaymentSummaryValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    editPaymentBtnRow: {
        flexDirection: 'row',
        gap: 12,
    },
    editPaymentCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    editPaymentCancelBtnText: {
        fontSize: 15,
        fontWeight: '600',
    },
    editPaymentSaveBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    editPaymentSaveBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    editPaymentBtn: {
        padding: 4,
    },
});
