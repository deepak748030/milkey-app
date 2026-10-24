import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Modal, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { Calendar as CalendarIcon, FileText, Trash2, Plus, Search, X, Edit2, Printer, User, ClipboardList, Power, ArrowRight, ArrowUp, ArrowDown, ArrowUpDown, Eye } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ToastAndroid, Platform as RNPlatform } from 'react-native';
import { farmersApi, advancesApi, paymentsApi, printSettingsApi, milkCollectionsApi, Farmer, Advance, Payment, FarmerPaymentSummary, PrintSettings } from '@/lib/milkeyApi';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { buildRegisterPaymentSlipPayload, buildJointCollectionPaymentSlipPayload, buildFarmersListPayload } from '@/lib/slipPrint';
import { brandedHeaderHtml, brandedFooterHtml, brandedHeader, brandedFooter, twoCol, line as fmtLine, left as fmtLeft } from '@/lib/printFormat';
import { getThermalSlipLabels } from '@/lib/printTranslations';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Calendar } from '@/components/Calendar';
import { PaymentRangeCalendar, BlockedPeriod } from '@/components/PaymentRangeCalendar';
import { DateRangePicker } from '@/components/DateRangePicker';
import { useLocalSearchParams, router } from 'expo-router';
import { useSubscriptionCheck } from '@/hooks/useSubscriptionCheck';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { useDebounce } from '@/hooks/useDebounce';
import { useSubTabStore, RegisterTab } from '@/lib/subTabStore';
import { useFocusEffect } from 'expo-router';

// Helper function to format date as dd/mm/yyyy clear
const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

type TabType = RegisterTab;
const TAB_ORDER: TabType[] = ['Payments', 'Advances', 'Farmer'];


export default function RegisterScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { tab } = useLocalSearchParams<{ tab?: string }>();

    // Subscription check
    const {
        hasAccess,
        loading: subscriptionLoading,
        showSubscriptionModal,
        handleModalClose,
        handleSubscriptionSuccess
    } = useSubscriptionCheck('register');

    const { registerTab: activeTab, setRegisterTab: setActiveTab } = useSubTabStore();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const { isConnected: isPrinterConnected, printText } = useBluetoothPrinter();
    const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);

    useEffect(() => {
        printSettingsApi.get().then(res => {
            if (res.success && res.response) setPrintSettings(res.response);
        }).catch(() => { });
    }, []);
    // Refetch on focus so saved Print Settings reflect immediately on next slip.
    useFocusEffect(
        useCallback(() => {
            printSettingsApi.get().then(res => {
                if (res.success && res.response) setPrintSettings(res.response);
            }).catch(() => { });
        }, [])
    );

    const notifyPrinterDisconnected = () => {
        const msg = 'Printer not connected';
        if (RNPlatform.OS === 'android') {
            ToastAndroid.show(msg, ToastAndroid.SHORT);
        }
    };

    // Set active tab from URL params
    useEffect(() => {
        if (tab && TAB_ORDER.includes(tab as TabType)) {
            setActiveTab(tab as TabType);
        }
    }, [tab]);

    // Data state
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [advances, setAdvances] = useState<Advance[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [farmerPayments, setFarmerPayments] = useState<Payment[]>([]); // Farmer-specific payments for settlement history

    // Infinite scroll state for settlement history
    const [paymentsPage, setPaymentsPage] = useState(1);
    const [paymentsHasMore, setPaymentsHasMore] = useState(true);
    const [paymentsLoadingMore, setPaymentsLoadingMore] = useState(false);
    const [farmerPaymentsPage, setFarmerPaymentsPage] = useState(1);
    const [farmerPaymentsHasMore, setFarmerPaymentsHasMore] = useState(true);
    const [farmerPaymentsLoadingMore, setFarmerPaymentsLoadingMore] = useState(false);

    // Server-side pagination state for advances
    const [advancesPage, setAdvancesPage] = useState(1);
    const [advancesHasMore, setAdvancesHasMore] = useState(true);
    const [advancesLoadingMore, setAdvancesLoadingMore] = useState(false);
    const [totalPendingAmount, setTotalPendingAmount] = useState(0);
    const [advancesTotalCount, setAdvancesTotalCount] = useState(0);
    const [advSortOrder, setAdvSortOrder] = useState<'asc' | 'desc' | null>(null);

    // Settlement History summary stats
    const [settlementSummaryDate, setSettlementSummaryDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [settlementPaidOnDate, setSettlementPaidOnDate] = useState(0);
    const [settlementTotalBalance, setSettlementTotalBalance] = useState(0);
    const [showSettlementDatePicker, setShowSettlementDatePicker] = useState(false);

    // Payment tab state
    const [paymentCode, setPaymentCode] = useState('');
    const [paymentFarmer, setPaymentFarmer] = useState<FarmerPaymentSummary | null>(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [dateStart, setDateStart] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split('T')[0]);
    const [paidAmount, setPaidAmount] = useState('');
    const [milkAmount, setMilkAmount] = useState('');
    const [savingPayment, setSavingPayment] = useState(false);

    // Advances state
    const [advCode, setAdvCode] = useState('');
    const [advName, setAdvName] = useState('');
    const [advAmount, setAdvAmount] = useState('');
    const [advDate, setAdvDate] = useState(new Date().toISOString().split('T')[0]);
    const [advNote, setAdvNote] = useState('');

    // Farmers state
    const [newCode, setNewCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newMobile, setNewMobile] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [searchCode, setSearchCode] = useState('');
    const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);
    const [showFarmerModal, setShowFarmerModal] = useState(false);
    const [farmerTabSearch, setFarmerTabSearch] = useState('');
    const [farmerSearchLoading, setFarmerSearchLoading] = useState(false);


    // Advances search and date picker
    const [advanceSearch, setAdvanceSearch] = useState('');
    const [showAdvDatePicker, setShowAdvDatePicker] = useState(false);

    // Payment date pickers
    const [dateSelectingType, setDateSelectingType] = useState<'start' | 'end'>('start');
    const [showCalendarModal, setShowCalendarModal] = useState(false);

    // Temp calendar date for confirmation
    const [tempCalendarDate, setTempCalendarDate] = useState<Date | null>(null);

    // Compute blocked periods from existing payments for the selected farmer
    const blockedPeriods = useMemo((): BlockedPeriod[] => {
        if (!paymentFarmer) return [];

        // Get all payments for this farmer
        const farmerPayments = payments.filter(p => p.farmer?.code === paymentFarmer.farmer.code);

        return farmerPayments
            .filter(p => p.periodStart && p.periodEnd)
            .map(p => ({
                startDate: new Date(p.periodStart!).toISOString().split('T')[0],
                endDate: new Date(p.periodEnd!).toISOString().split('T')[0],
            }));
    }, [paymentFarmer, payments]);

    // Modal state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmData, setConfirmData] = useState<{ title: string; message: string; onConfirm: () => void }>({ title: '', message: '', onConfirm: () => { } });

    // Edit payment modal state
    const [editPaymentVisible, setEditPaymentVisible] = useState(false);
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [editPaidAmount, setEditPaidAmount] = useState('');
    const [editMilkAmount, setEditMilkAmount] = useState('');
    const [editPeriodStart, setEditPeriodStart] = useState('');
    const [editPeriodEnd, setEditPeriodEnd] = useState('');
    const [showEditStartDatePicker, setShowEditStartDatePicker] = useState(false);
    const [showEditEndDatePicker, setShowEditEndDatePicker] = useState(false);
    const [updatingPayment, setUpdatingPayment] = useState(false);

    // Advance add/delete inside Edit Payment modal
    const [newAdvAmount, setNewAdvAmount] = useState('');
    const [newAdvNote, setNewAdvNote] = useState('');
    const [addingAdvance, setAddingAdvance] = useState(false);
    const [deletingAdvanceId, setDeletingAdvanceId] = useState<string | null>(null);

    // Compute blocked periods for edit modal (exclude the current payment being edited)
    const editBlockedPeriods = useMemo((): BlockedPeriod[] => {
        if (!editingPayment) return [];

        // Get all payments for this farmer except the one being edited
        const farmerPayments = payments.filter(
            p => p.farmer?.code === editingPayment.farmer?.code && p._id !== editingPayment._id
        );

        return farmerPayments
            .filter(p => p.periodStart && p.periodEnd)
            .map(p => ({
                startDate: new Date(p.periodStart!).toISOString().split('T')[0],
                endDate: new Date(p.periodEnd!).toISOString().split('T')[0],
            }));
    }, [editingPayment, payments]);

    const showAlert = (title: string, message: string) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertVisible(true);
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setConfirmData({ title, message, onConfirm });
        setConfirmVisible(true);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Effect to auto-adjust dates when blockedPeriods change (farmer selected)
    useEffect(() => {
        if (blockedPeriods.length === 0 || !paymentFarmer) return;

        // Check if current date range overlaps with any blocked period
        const checkOverlap = (startStr: string, endStr: string): boolean => {
            const start = new Date(startStr);
            const end = new Date(endStr);
            return blockedPeriods.some(period => {
                const blockedStart = new Date(period.startDate);
                const blockedEnd = new Date(period.endDate);
                return start <= blockedEnd && end >= blockedStart;
            });
        };

        if (checkOverlap(dateStart, dateEnd)) {
            // Find the next available date range
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const lastDay = new Date(year, month + 1, 0).getDate();

            // Try to find a valid start date after all blocked periods
            let foundValidRange = false;

            // Get all blocked dates as sorted array
            const allBlockedDates: Date[] = [];
            blockedPeriods.forEach(period => {
                const start = new Date(period.startDate);
                const end = new Date(period.endDate);
                const current = new Date(start);
                while (current <= end) {
                    allBlockedDates.push(new Date(current));
                    current.setDate(current.getDate() + 1);
                }
            });

            // Find first available day
            for (let day = 1; day <= lastDay; day++) {
                const testDate = new Date(year, month, day);
                const testDateStr = testDate.toISOString().split('T')[0];
                const isBlocked = allBlockedDates.some(bd =>
                    bd.getFullYear() === testDate.getFullYear() &&
                    bd.getMonth() === testDate.getMonth() &&
                    bd.getDate() === testDate.getDate()
                );

                if (!isBlocked) {
                    // Found an available start date, now find available end date
                    let endDay = day;
                    for (let ed = day; ed <= lastDay; ed++) {
                        const endTestDate = new Date(year, month, ed);
                        const isEndBlocked = allBlockedDates.some(bd =>
                            bd.getFullYear() === endTestDate.getFullYear() &&
                            bd.getMonth() === endTestDate.getMonth() &&
                            bd.getDate() === endTestDate.getDate()
                        );
                        if (isEndBlocked) break;
                        endDay = ed;
                    }

                    const newStart = new Date(year, month, day);
                    const newEnd = new Date(year, month, endDay);
                    setDateStart(newStart.toISOString().split('T')[0]);
                    setDateEnd(newEnd.toISOString().split('T')[0]);
                    foundValidRange = true;
                    break;
                }
            }

            // If no valid range found this month, clear the dates
            if (!foundValidRange) {
                // Reset to empty or show warning
                const nextMonth = new Date(year, month + 1, 1);
                setDateStart(nextMonth.toISOString().split('T')[0]);
                setDateEnd(nextMonth.toISOString().split('T')[0]);
            }
        }
    }, [blockedPeriods, paymentFarmer]);

    // Auto-select default Calculation Period based on last payment for this farmer.
    // Logic: next period starts the day after the last payment's periodEnd, with the
    // same duration. If the tentative end exceeds the month's last day (28/30/31),
    // clamp it to the month end so the last cycle of the month is auto-selected.
    // If there is no previous payment, keep the existing default (start of month → today).
    useEffect(() => {
        if (!paymentFarmer) return;

        const farmerCode = paymentFarmer.farmer.code;
        const prior = payments
            .filter(p => p.farmer?.code === farmerCode && p.periodStart && p.periodEnd)
            .sort((a, b) => new Date(b.periodEnd!).getTime() - new Date(a.periodEnd!).getTime());

        if (prior.length === 0) return;

        const last = prior[0];
        const lastStart = new Date(last.periodStart!);
        const lastEnd = new Date(last.periodEnd!);
        const msPerDay = 24 * 60 * 60 * 1000;
        const duration = Math.max(1, Math.round((lastEnd.getTime() - lastStart.getTime()) / msPerDay) + 1);

        const newStart = new Date(lastEnd);
        newStart.setDate(newStart.getDate() + 1);

        const tentativeEnd = new Date(newStart);
        tentativeEnd.setDate(tentativeEnd.getDate() + duration - 1);

        // Clamp end to the last day of newStart's month so month-end cycles auto-fit.
        const monthEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
        let finalEnd = tentativeEnd > monthEnd ? monthEnd : tentativeEnd;
        // If today is 1st (month start) and newStart is in previous month, extend to monthEnd
        // e.g. last 01/10-10/10 (gap 10), new 11/10-20/10, but if today 01/11 and last was 21/10-30/10 (28-31), final should be 21/10-31/10
        const today = new Date();
        if (today.getDate() === 1) {
            const isPrevMonth = newStart.getMonth() !== today.getMonth() || newStart.getFullYear() !== today.getFullYear();
            const lastDayNum = lastEnd.getDate();
            if (isPrevMonth && [28, 29, 30, 31].includes(lastDayNum)) {
                finalEnd = monthEnd;
            } else if (isPrevMonth) {
                // also if tentative period would leave <3 days to month end, fill to monthEnd
                const daysToMonthEnd = Math.round((monthEnd.getTime() - tentativeEnd.getTime()) / msPerDay);
                if (daysToMonthEnd >= 0 && daysToMonthEnd <= 3) {
                    finalEnd = monthEnd;
                }
            }
        }

        // Skip if the computed range overlaps an existing settled period.
        const overlaps = blockedPeriods.some(period => {
            const bs = new Date(period.startDate);
            const be = new Date(period.endDate);
            return newStart <= be && finalEnd >= bs;
        });
        if (overlaps) return;

        setDateStart(newStart.toISOString().split('T')[0]);
        setDateEnd(finalEnd.toISOString().split('T')[0]);
    }, [paymentFarmer, payments]);

    // Fetch advances with server-side pagination
    const fetchAdvances = async (page: number = 1, search: string = '', append: boolean = false) => {
        try {
            if (page === 1 && !append) {
                setAdvancesPage(1);
                setAdvancesHasMore(true);
            }

            const res = await advancesApi.getAll({
                page,
                limit: 10,
                search: search || undefined,
                sortOrder: 'pendingFirst',
                status: 'pending',
                ...(advSortOrder ? { sortBy: 'amount' as const, order: advSortOrder } : {})
            });

            if (!res.success) {
                showAlert('Error', res.message || 'Failed to load advances');
                if (!append) setAdvances([]);
                return;
            }

            if (res.response?.data) {
                if (append) {
                    setAdvances(prev => [...prev, ...res.response!.data]);
                } else {
                    setAdvances(res.response.data);
                }

                // Update pagination state
                const pagination = res.response.pagination;
                if (pagination) {
                    setAdvancesTotalCount(pagination.total);
                    setAdvancesHasMore(page < pagination.pages);
                } else {
                    setAdvancesHasMore(res.response.data.length >= 20);
                }

                // Update total pending amount from server
                if (res.response.totalPendingAmount !== undefined) {
                    setTotalPendingAmount(res.response.totalPendingAmount);
                }
            } else {
                if (!append) setAdvances([]);
                setAdvancesHasMore(false);
            }
        } catch (error) {
            console.error('Error fetching advances:', error);
            if (!append) setAdvances([]);
        }
    };

    // Load more advances
    const loadMoreAdvances = async () => {
        if (advancesLoadingMore || !advancesHasMore) return;
        setAdvancesLoadingMore(true);
        const nextPage = advancesPage + 1;
        await fetchAdvances(nextPage, advanceSearch, true);
        setAdvancesPage(nextPage);
        setAdvancesLoadingMore(false);
    };

    // Fetch settlement summary stats
    const fetchSettlementSummaryStats = async (date?: string) => {
        try {
            const res = await paymentsApi.getSummaryStats(date || settlementSummaryDate);
            if (res.success && res.response) {
                setSettlementPaidOnDate(res.response.paidOnDate || 0);
                setSettlementTotalBalance(res.response.totalCurrentBalance || 0);
            }
        } catch (error) {
            console.error('Error fetching settlement summary stats:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [farmersRes, paymentsRes] = await Promise.all([
                farmersApi.getAll({ includeInactive: true }),
                paymentsApi.getAll({ limit: 10, latestPerFarmer: true }),
            ]);

            if (!farmersRes.success) {
                showAlert('Error', farmersRes.message || 'Failed to load farmers');
            } else if (farmersRes.response?.data) {
                // Sort farmers by code as numeric values in ascending order
                const sortedFarmers = [...farmersRes.response.data].sort((a, b) => {
                    const codeA = parseInt(a.code, 10) || 0;
                    const codeB = parseInt(b.code, 10) || 0;
                    return codeA - codeB;
                });
                setFarmers(sortedFarmers);
            }

            // Fetch advances separately with pagination
            await fetchAdvances(1, advanceSearch, false);

            if (!paymentsRes.success) {
                showAlert('Error', paymentsRes.message || 'Failed to load settlements');
            } else if (paymentsRes.response?.data) {
                setPayments(paymentsRes.response.data);
                setPaymentsPage(1);
                setPaymentsHasMore(paymentsRes.response.data.length >= 10);
            }

            // Fetch settlement summary stats
            await fetchSettlementSummaryStats();
        } catch (error) {
            console.error('Error fetching data:', error);
            showAlert('Error', 'Failed to load data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setAdvancesPage(1);
        await fetchData();
        setRefreshing(false);
    }, [advanceSearch]);

    // Fetch farmer-specific payment history (with pagination)
    const fetchFarmerPayments = async (farmerId: string, page: number = 1, append: boolean = false) => {
        try {
            if (page === 1) {
                setFarmerPaymentsPage(1);
                setFarmerPaymentsHasMore(true);
            }
            const res = await paymentsApi.getAll({ farmerId, limit: 10, page });
            if (!res.success) {
                showAlert('Error', res.message || 'Failed to load settlement history');
                if (!append) setFarmerPayments([]);
                return;
            }
            if (res.response?.data) {
                if (append) {
                    setFarmerPayments(prev => [...prev, ...res.response!.data]);
                } else {
                    setFarmerPayments(res.response.data);
                }
                // Check if more pages available
                if (res.response.data.length < 10) {
                    setFarmerPaymentsHasMore(false);
                }
            } else {
                if (!append) setFarmerPayments([]);
                setFarmerPaymentsHasMore(false);
            }
        } catch (error) {
            console.error('Error fetching farmer payments:', error);
            showAlert('Error', 'Failed to load settlement history. Please try again.');
        }
    };

    // Load more farmer payments (infinite scroll)
    const loadMoreFarmerPayments = async () => {
        if (farmerPaymentsLoadingMore || !farmerPaymentsHasMore || !paymentFarmer) return;
        setFarmerPaymentsLoadingMore(true);
        const nextPage = farmerPaymentsPage + 1;
        setFarmerPaymentsPage(nextPage);
        await fetchFarmerPayments(paymentFarmer.farmer.id, nextPage, true);
        setFarmerPaymentsLoadingMore(false);
    };
    // Print a register payment slip directly when a printer is connected,
    // otherwise notify the user and open the slip preview screen as a fallback.
    // Joint Collection + Payment slip exactly like image - fetches milk collections for period
    const handlePrintPaymentSlip = async (p: Payment, _skipPrinterCheck = false) => {
        if (isPrinterConnected) {
            try {
                let collections: any[] = [];
                try {
                    const farmerCode = (p.farmer as any)?.code;
                    if (farmerCode && (p.periodStart || p.date) && (p.periodEnd || p.date)) {
                        const res = await milkCollectionsApi.getAll({
                            farmerCode,
                            startDate: p.periodStart || p.date,
                            endDate: p.periodEnd || p.date,
                            limit: 100,
                        });
                        if (res.success && res.response?.data) collections = res.response.data;
                    }
                } catch { }
                const payload = collections.length
                    ? buildJointCollectionPaymentSlipPayload(p, collections, printSettings)
                    : buildRegisterPaymentSlipPayload(p, printSettings);
                await printText(payload);
            } catch (e) {
                console.error('Direct print error:', e);
            }
            return;
        }
        notifyPrinterDisconnected();
        (router as any).push({ pathname: '/register-payment-slip', params: { paymentId: p._id } });
    };


    const loadMorePayments = async () => {
        if (paymentsLoadingMore || !paymentsHasMore) return;
        setPaymentsLoadingMore(true);
        const nextPage = paymentsPage + 1;
        try {
            const res = await paymentsApi.getAll({ limit: 10, page: nextPage, latestPerFarmer: true });
            if (res.success && res.response?.data) {
                setPayments(prev => [...prev, ...res.response!.data]);
                setPaymentsPage(nextPage);
                if (res.response.data.length < 10) {
                    setPaymentsHasMore(false);
                }
            } else {
                setPaymentsHasMore(false);
            }
        } catch (error) {
            console.error('Error loading more payments:', error);
        } finally {
            setPaymentsLoadingMore(false);
        }
    };


    // Payment tab: fetch farmer summary
    const handleFetchFarmerSummary = async () => {
        if (!paymentCode.trim()) {
            showAlert('Error', 'Please enter farmer code');
            return;
        }
        setPaymentLoading(true);
        try {
            const res = await paymentsApi.getFarmerSummary(paymentCode, dateStart, dateEnd);
            if (res.success && res.response) {
                setPaymentFarmer(res.response);
                // Milk Amount equation: purchase amount is totalAmount, input is extra (start 0)
                setMilkAmount('');
                setPaidAmount('');
                // Fetch farmer-specific payment history
                await fetchFarmerPayments(res.response.farmer.id);
            } else {
                showAlert('Error', res.message || 'Farmer not found');
                setPaymentFarmer(null);
                setFarmerPayments([]);
            }
        } catch (error) {
            showAlert('Error', 'Failed to fetch farmer');
        } finally {
            setPaymentLoading(false);
        }
    };

    // Helper to format date as YYYY-MM-DD without timezone shift
    const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Helper to check if two date ranges overlap
    const rangesOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
        return start1 <= end2 && end1 >= start2;
    };

    // Helper to get overlapping periods for a date range
    const getOverlappingPeriodsForRange = (startStr: string, endStr: string): BlockedPeriod[] => {
        const start = new Date(startStr);
        const end = new Date(endStr);
        return blockedPeriods.filter(period => {
            const blockedStart = new Date(period.startDate);
            const blockedEnd = new Date(period.endDate);
            return rangesOverlap(start, end, blockedStart, blockedEnd);
        });
    };


    // Recalculate when dates change
    const handleRecalculate = async () => {
        if (paymentCode.trim()) {
            await handleFetchFarmerSummary();
        }
    };

    // Save payment/settlement
    const handleSaveSettlement = async () => {
        if (!paymentFarmer) {
            showAlert('Error', 'Please select a farmer first');
            return;
        }

        const amount = parseFloat(paidAmount) || 0;
        if (isNaN(amount) || amount < 0) {
            showAlert('Error', 'Please enter a valid amount');
            return;
        }

        // Final validation: check if the selected range overlaps with existing payments
        const overlapping = getOverlappingPeriodsForRange(dateStart, dateEnd);
        if (overlapping.length > 0) {
            const periodsList = overlapping.map(p => {
                const s = new Date(p.startDate);
                const e = new Date(p.endDate);
                return `${s.getDate()}/${s.getMonth() + 1}/${s.getFullYear()} - ${e.getDate()}/${e.getMonth() + 1}/${e.getFullYear()}`;
            }).join('\n');
            showAlert('Date Conflict', `Cannot save payment. The selected period overlaps with existing payment(s):\n\n${periodsList}`);
            return;
        }

        setSavingPayment(true);
        try {
            const milkAmountValue = purchaseAmount + (parseFloat(milkAmount) || 0);
            const res = await paymentsApi.create({
                farmerCode: paymentFarmer.farmer.code,
                amount,
                paymentMethod: 'cash',
                totalMilkAmount: milkAmountValue,
                periodStart: dateStart,
                periodEnd: dateEnd,
            });

            if (res.success) {
                if (res.response) {
                    try {
                        await handlePrintPaymentSlip(res.response, true);
                    } catch (e) { /* navigation failed silently */ }
                }
                showAlert('Success', 'Settlement saved successfully');
                setPaymentFarmer(null);
                setPaymentCode('');
                setPaidAmount('');
                fetchData(); // Refresh data including advances
            } else {
                showAlert('Error', res.message || 'Failed to save settlement');
            }
        } catch (error) {
            showAlert('Error', 'Failed to save settlement');
        } finally {
            setSavingPayment(false);
        }
    };

    // Clear payment form
    const clearPaymentForm = () => {
        setPaymentCode('');
        setPaymentFarmer(null);
        setPaidAmount('');
        setMilkAmount('');
        setFarmerPayments([]); // Clear farmer-specific payments
    };

    // Handle edit payment - open modal with payment data
    const handleEditPayment = (payment: Payment) => {
        setEditingPayment(payment);
        setEditPaidAmount((payment.amount || 0).toString());
        setEditMilkAmount((payment.totalMilkAmount || 0).toString());
        // Set period dates
        const periodStartStr = payment.periodStart ? new Date(payment.periodStart).toISOString().split('T')[0] : '';
        const periodEndStr = payment.periodEnd ? new Date(payment.periodEnd).toISOString().split('T')[0] : '';
        setEditPeriodStart(periodStartStr);
        setEditPeriodEnd(periodEndStr);
        setEditPaymentVisible(true);
    };

    // Save updated payment
    const handleUpdatePayment = async () => {
        if (!editingPayment) return;

        const amount = parseFloat(editPaidAmount) || 0;
        const milkAmount = parseFloat(editMilkAmount) || 0;

        if (amount < 0 || milkAmount < 0) {
            showAlert('Error', 'Please enter valid amounts');
            return;
        }

        setUpdatingPayment(true);
        try {
            const updateData: any = {
                amount,
                totalMilkAmount: milkAmount,
            };

            // Add period dates if set
            if (editPeriodStart) {
                updateData.periodStart = editPeriodStart;
            }
            if (editPeriodEnd) {
                updateData.periodEnd = editPeriodEnd;
            }

            const res = await paymentsApi.update(editingPayment._id, updateData);

            if (res.success) {
                showAlert('Success', 'Payment updated successfully');
                setEditPaymentVisible(false);
                setEditingPayment(null);
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to update payment');
            }
        } catch (error) {
            showAlert('Error', 'Failed to update payment');
        } finally {
            setUpdatingPayment(false);
        }
    };

    // Close edit modal
    const closeEditPaymentModal = () => {
        setEditPaymentVisible(false);
        setEditingPayment(null);
        setEditPaidAmount('');
        setEditMilkAmount('');
        setEditPeriodStart('');
        setEditPeriodEnd('');
        setShowEditStartDatePicker(false);
        setShowEditEndDatePicker(false);
        setNewAdvAmount('');
        setNewAdvNote('');
    };

    // Add a new advance into the currently edited payment
    const handleAddAdvanceToPayment = async () => {
        if (!editingPayment) return;
        const amt = parseFloat(newAdvAmount);
        if (isNaN(amt) || amt <= 0) {
            showAlert('Error', 'Please enter a valid advance amount');
            return;
        }
        setAddingAdvance(true);
        try {
            const res = await paymentsApi.addAdvance(editingPayment._id, {
                amount: amt,
                note: newAdvNote.trim(),
            });
            if (res.success && res.response) {
                setEditingPayment(res.response as Payment);
                setNewAdvAmount('');
                setNewAdvNote('');
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to add advance');
            }
        } catch (e) {
            showAlert('Error', 'Failed to add advance');
        } finally {
            setAddingAdvance(false);
        }
    };

    // Permanently delete an advance from the payment + DB
    const handleDeleteAdvanceFromPayment = (advanceId: string) => {
        if (!editingPayment) return;
        showConfirm(
            'Delete Advance',
            'This will permanently delete this advance from the database. Continue?',
            async () => {
                setDeletingAdvanceId(advanceId);
                try {
                    const res = await paymentsApi.deleteAdvance(editingPayment._id, advanceId);
                    if (res.success && res.response) {
                        setEditingPayment(res.response as Payment);
                        fetchData();
                    } else {
                        showAlert('Error', res.message || 'Failed to delete advance');
                    }
                } catch (e) {
                    showAlert('Error', 'Failed to delete advance');
                } finally {
                    setDeletingAdvanceId(null);
                }
            }
        );
    };

    // Lookup farmer name when code changes
    const handleAdvCodeChange = async (code: string) => {
        setAdvCode(code);
        if (code.length > 0) {
            const farmer = farmers.find(f => f.code === code);
            setAdvName(farmer?.name || '');
        } else {
            setAdvName('');
        }
    };

    // Add farmer
    const handleAddFarmer = async () => {
        if (!newCode || !newName || !newMobile) {
            showAlert('Error', 'Please fill code, name, and mobile');
            return;
        }

        setLoading(true);
        try {
            const res = await farmersApi.create({
                code: newCode,
                name: newName,
                mobile: newMobile,
                address: newAddress,
            });

            if (res.success) {
                showAlert('Success', 'Farmer added successfully');
                clearFarmerForm();
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to add farmer');
            }
        } catch (error) {
            showAlert('Error', 'Failed to add farmer');
        } finally {
            setLoading(false);
        }
    };

    const clearFarmerForm = () => {
        setNewCode('');
        setNewName('');
        setNewMobile('');
        setNewAddress('');
        setEditingFarmer(null);
        setShowFarmerModal(false);
    };

    // Edit farmer - populate form with farmer data and open modal
    const handleEditFarmer = (farmer: Farmer) => {
        setEditingFarmer(farmer);
        setNewCode(farmer.code);
        setNewName(farmer.name);
        setNewMobile(farmer.mobile);
        setNewAddress(farmer.address || '');
        setShowFarmerModal(true);
    };

    // Debounced farmer search value
    const debouncedFarmerSearch = useDebounce(farmerTabSearch, 400);

    // Fetch farmers when debounced search value changes
    useEffect(() => {
        const searchFarmers = async () => {
            setFarmerSearchLoading(true);
            try {
                const res = await farmersApi.getAll({ search: debouncedFarmerSearch.trim() || undefined });
                if (res.success) {
                    setFarmers(res.response?.data || []);
                }
            } catch (error) {
                console.error('Farmer search error:', error);
            } finally {
                setFarmerSearchLoading(false);
            }
        };
        searchFarmers();
    }, [debouncedFarmerSearch]);

    // Update farmer
    const handleUpdateFarmer = async () => {
        if (!editingFarmer || !newCode || !newName || !newMobile) {
            showAlert('Error', 'Please fill code, name and mobile');
            return;
        }

        setLoading(true);
        try {
            const res = await farmersApi.update(editingFarmer._id, {
                code: newCode,
                name: newName,
                mobile: newMobile,
                address: newAddress,
            });

            if (res.success) {
                showAlert('Success', 'Farmer updated successfully');
                clearFarmerForm();
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to update farmer');
            }
        } catch (error) {
            showAlert('Error', 'Failed to update farmer');
        } finally {
            setLoading(false);
        }
    };

    // Delete advance
    const handleDeleteAdvance = async (id: string, farmerName: string) => {
        showConfirm('Delete Advance', `Are you sure you want to delete this advance for ${farmerName}?`, async () => {
            setConfirmVisible(false);
            const res = await advancesApi.delete(id);
            if (res.success) {
                showAlert('Success', 'Advance deleted successfully');
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to delete advance');
            }
        });
    };

    // Delete farmer
    const handleDeleteFarmer = async (id: string, name: string) => {
        showConfirm('Deactivate Farmer', `Are you sure you want to deactivate ${name}? The farmer will be hidden from active lists but data will be preserved. Dairy owner can re-activate later.`, async () => {
            setConfirmVisible(false);
            const res = await farmersApi.delete(id);
            if (res.success) {
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to deactivate');
            }
        });
    };

    const handleRestoreFarmer = async (id: string, name: string) => {
        showConfirm('Activate Farmer', `Re-activate ${name}? They will appear in active lists again.`, async () => {
            setConfirmVisible(false);
            const res = await (farmersApi as any).restore(id);
            if (res.success) {
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to activate');
            }
        });
    };

    // Add advance
    const handleAddAdvance = async () => {
        if (!advCode || !advAmount) {
            showAlert('Error', 'Please enter farmer code and amount');
            return;
        }

        setLoading(true);
        try {
            const res = await advancesApi.create({
                farmerCode: advCode,
                amount: parseFloat(advAmount),
                date: advDate,
                note: advNote,
            });

            if (res.success) {
                showAlert('Success', 'Advance added successfully');
                clearAdvanceForm();
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to add advance');
            }
        } catch (error) {
            showAlert('Error', 'Failed to add advance');
        } finally {
            setLoading(false);
        }
    };

    const clearAdvanceForm = () => {
        setAdvCode('');
        setAdvName('');
        setAdvAmount('');
        setAdvNote('');
    };

    // Print farmers list to thermal printer (toast if no printer connected)
    const generateFarmersPDF = async () => {
        if (!farmers.length) {
            if (RNPlatform.OS === 'android') ToastAndroid.show('No farmers to print', ToastAndroid.SHORT);
            return;
        }
        if (!isPrinterConnected) {
            notifyPrinterDisconnected();
            return;
        }
        try {
            await printText(buildFarmersListPayload(farmers, printSettings));
        } catch (e) {
            if (RNPlatform.OS === 'android') ToastAndroid.show('Print failed', ToastAndroid.SHORT);
        }
    };

    const downloadFarmersPDF = async () => {
        if (!farmers.length) {
            showAlert('Error', 'No farmers to export');
            return;
        }
        const rows = farmers.map((f) => `
            <tr>
                <td>${f.code || '-'}</td>
                <td>${f.name || '-'}</td>
                <td>${f.mobile || '-'}</td>
            </tr>
        `).join('');
        const html = `
            <html><head><style>
                body{font-family:Arial,sans-serif;padding:20px;color:#333} h1{color:#22C55E;text-align:center}
                table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}
                th{background:#22C55E;color:#fff} tr:nth-child(even){background:#f9f9f9}
            </style></head><body>
                ${brandedHeaderHtml(printSettings)}
                <h1>Farmers List</h1>
                <p>Total Farmers: ${farmers.length}</p>
                <table><tr><th>Code</th><th>Name</th><th>Mobile</th></tr>${rows}</table>
                ${brandedFooterHtml(printSettings)}
            </body></html>
        `;
        try {
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Farmers List' });
            else showAlert('PDF Generated', `Saved to: ${uri}`);
        } catch (error) {
            showAlert('Error', 'Failed to generate PDF');
        }
    };

    const styles = createStyles(colors, isDark);



    // Show all farmers (removed search filter)
    const filteredFarmers = farmers;

    // Debounce advance search and fetch from server
    const debouncedAdvanceSearch = useDebounce(advanceSearch, 400);

    useEffect(() => {
        // Reset page and fetch with new search term
        setAdvancesPage(1);
        fetchAdvances(1, debouncedAdvanceSearch, false);
    }, [debouncedAdvanceSearch]);

    // Data comes pre-sorted from server (pending first, then settled)
    // No need for client-side filtering/sorting

    // Generate Advances PDF
    const generateAdvancesPDF = async () => {
        const dataToExport = advances;
        const rows = dataToExport.map(item => {
            const isSettled = item.status === 'settled' || item.status === 'partial';
            return `
                <tr class="${isSettled ? 'settled' : ''}">
                    <td>${item.farmer?.code || '-'}</td>
                    <td>${item.farmer?.name || '-'}</td>
                    <td>${item.note || '-'}</td>
                    <td>₹${item.amount}</td>
                    <td>${new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                    <td>${item.status}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #22C55E; text-align: center; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                        th { background-color: #22C55E; color: white; }
                        tr:nth-child(even) { background-color: #f2f2f2; }
                        .settled { color: #999; text-decoration: line-through; background-color: #f5f5f5; }
                        .info { text-align: center; margin-bottom: 10px; color: #666; }
                    </style>
                </head>
                <body>
                    ${brandedHeaderHtml(printSettings)}
                    <h1>Advances Report</h1>
                    <p class="info">Generated on: ${new Date().toLocaleDateString('en-IN')} | Total Records: ${dataToExport.length}</p>
                    <table>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Note</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                        ${rows}
                    </table>
                    ${brandedFooterHtml(printSettings)}
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

    const printAdvancesThermal = async () => {
        if (advances.length === 0) {
            showAlert('Error', 'No advances to print');
            return;
        }
        if (!isPrinterConnected) {
            notifyPrinterDisconnected();
            return;
        }

        const tAdv = getThermalSlipLabels();
        let payload = '';
        payload += brandedHeader({
            dairyName: printSettings?.dairyName || tAdv.advancesReport,
            address: printSettings?.address || '',
            mobileNumber: printSettings?.mobileNumber || '',
            showMobileOnReceipt: printSettings?.showMobileOnReceipt !== false,
        });
        payload += fmtLeft(tAdv.advancesReport, { bold: true });
        payload += twoCol(`${tAdv.records}:`, String(advances.length));
        payload += fmtLine();
        advances.forEach((item) => {
            payload += twoCol(`${item.farmer?.code || '-'} ${item.farmer?.name || '-'}`, `Rs ${Number(item.amount || 0).toFixed(0)}`);
            payload += twoCol(formatDateDDMMYYYY(item.date), item.status || '-');
            if (item.note) payload += fmtLeft(`${tAdv.note}: ${item.note}`);
            payload += fmtLine();
        });
        payload += twoCol(`${tAdv.total}:`, `Rs ${advances.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(0)}`, { bold: true });
        payload += brandedFooter(printSettings?.extraInfo?.trim());

        try {
            await printText(payload);
        } catch (e) {
            if (RNPlatform.OS === 'android') ToastAndroid.show('Print failed', ToastAndroid.SHORT);
        }
    };

    // Calculate milk amount equation: purchase amount (hardcoded) + input = total
    const purchaseAmount = paymentFarmer ? paymentFarmer.milk.totalAmount : 0;
    const milkExtra = parseFloat(milkAmount) || 0;
    const currentMilkAmount = purchaseAmount + milkExtra;
    const advanceAmount = paymentFarmer ? paymentFarmer.advances.totalPending : 0;
    const previousBalance = paymentFarmer?.farmer?.currentBalance || 0;
    const netPayable = currentMilkAmount - advanceAmount + previousBalance;
    const closingBalance = netPayable - (parseFloat(paidAmount) || 0);

    // Balance print state
    const [showBalancePrintModal, setShowBalancePrintModal] = useState(false);
    const [balanceType, setBalanceType] = useState<'positive' | 'negative' | null>(null);
    const [printingBalance, setPrintingBalance] = useState(false);

    // Print all farmer balances filtered by type
    const handlePrintBalances = () => {
        if (!balanceType) {
            showAlert('Error', 'Please select balance type');
            return;
        }
        setShowBalancePrintModal(false);
        (router as any).push({ pathname: '/balance-report', params: { type: balanceType } });
    };

    const renderPaymentsTab = () => (
        <View>
            {/* Code input + Go button */}
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Enter Farmer Code"
                    value={paymentCode}
                    onChangeText={setPaymentCode}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    onSubmitEditing={() => {
                        Keyboard.dismiss();
                        handleFetchFarmerSummary();
                    }}
                    returnKeyType="go"
                />
                <Pressable
                    style={({ pressed }) => [styles.goBtnImproved, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                    onPress={() => {
                        Keyboard.dismiss();
                        handleFetchFarmerSummary();
                    }}
                    disabled={paymentLoading}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    {paymentLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.goBtnTextImproved}>Go</Text>
                            <ArrowRight size={16} color="#fff" />
                        </>
                    )}
                </Pressable>
            </View>

            {/* Farmer info */}
            {paymentFarmer && (
                <>
                    <View style={styles.farmerInfoRow}>
                        <View>
                            <Text style={styles.farmerName}>{paymentFarmer.farmer.name}</Text>
                            <Text style={styles.farmerMobile}>{paymentFarmer.farmer.mobile}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.balanceLabel}>Current Balance</Text>
                            <Text style={[styles.balanceValue, { color: (paymentFarmer.farmer.currentBalance || 0) < 0 ? colors.destructive : colors.primary }]}>
                                ₹{(paymentFarmer.farmer.currentBalance || 0).toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* Calculation Period - Calendar opens as Modal */}
                    <Text style={styles.sectionLabel}>Calculation Period</Text>
                    <DateRangePicker
                        startDate={dateStart}
                        endDate={dateEnd}
                        onStartDateChange={(date) => setDateStart(date)}
                        onEndDateChange={(date) => {
                            setDateEnd(date);
                        }}
                        blockedPeriods={blockedPeriods}
                    />

                    {/* Summary card - Milk Amount: purchase + input = total */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Milk Amount:</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <Text style={[styles.summaryValue, { fontWeight: '700', color: colors.foreground }]}>{purchaseAmount.toFixed(0)}</Text>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.mutedForeground }}>+</Text>
                                <TextInput
                                    style={[styles.milkAmountInput, { minWidth: 55, width: 72, textAlign: 'center', paddingVertical: 6 }]}
                                    value={milkAmount}
                                    onChangeText={setMilkAmount}
                                    onFocus={() => {
                                        if (milkAmount === '0.00' || milkAmount === '0') {
                                            setMilkAmount('');
                                        }
                                    }}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor={colors.mutedForeground}
                                />
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.mutedForeground }}>=</Text>
                                <Text style={[styles.summaryValue, { fontWeight: '800', color: colors.primary }]}>₹{currentMilkAmount.toFixed(2)}</Text>
                            </View>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Advance/Prod:</Text>
                            <Text style={[styles.summaryValue, { color: colors.warning }]}>
                                ₹{advanceAmount.toFixed(2)}
                            </Text>
                        </View>
                        <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }]}>
                            <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>Total Payable:</Text>
                            <Text style={[styles.summaryValue, { fontWeight: '700', color: netPayable >= 0 ? colors.primary : colors.destructive }]}>
                                ₹{netPayable.toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* View Entries - collection purchase data for searched farmer */}
                    <Pressable
                        style={({ pressed }) => [styles.viewEntriesBtn, pressed && { opacity: 0.8 }]}
                        onPress={() => {
                            (router as any).push({
                                pathname: '/view-collection-entries',
                                params: {
                                    farmerCode: paymentFarmer.farmer.code,
                                    farmerName: paymentFarmer.farmer.name,
                                    startDate: dateStart,
                                    endDate: dateEnd,
                                },
                            });
                        }}
                    >
                        <Eye size={16} color={colors.primary} />
                        <Text style={[styles.viewEntriesText, { color: colors.primary }]}>View Entries ({paymentFarmer.milk.totalQuantity.toFixed(1)}L)</Text>
                    </Pressable>

                    {/* Pending Advances List */}
                    {paymentFarmer.advances.items && paymentFarmer.advances.items.length > 0 && (
                        <View style={styles.advanceListCard}>
                            <Text style={styles.advanceListTitle}>Pending Advances</Text>
                            {paymentFarmer.advances.items.map((adv) => (
                                <View key={adv._id} style={styles.advanceListItem}>
                                    <Text style={styles.advanceItemNote}>{adv.note || 'Advance'}</Text>
                                    <Text style={styles.advanceItemDate}>
                                        {formatDateDDMMYYYY(adv.date)}
                                    </Text>
                                    <Text style={[styles.advanceItemAmount, { color: colors.warning }]}>
                                        ₹{adv.remaining.toFixed(2)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Paid Amount Input - styled like Milk Amount box */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { fontWeight: '700', color: colors.primary }]}>Paid Amount:</Text>
                            <TextInput
                                style={styles.milkAmountInput}
                                value={paidAmount}
                                onChangeText={setPaidAmount}
                                onFocus={() => {
                                    if (paidAmount === '0.00' || paidAmount === '0') {
                                        setPaidAmount('');
                                    }
                                }}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                    </View>

                    {/* Closing Balance */}
                    <View style={styles.closingRow}>
                        <Text style={styles.closingLabel}>Closing Balance:</Text>
                        <Text style={[styles.closingValue, { color: closingBalance >= 0 ? colors.primary : colors.destructive }]}>
                            ₹{closingBalance.toFixed(2)}
                        </Text>
                    </View>

                    {/* Save & Clear buttons */}
                    <View style={styles.buttonRow}>
                        <Pressable style={styles.saveSettlementBtn} onPress={handleSaveSettlement} disabled={savingPayment}>
                            {savingPayment ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveSettlementText}>SAVE SETTLEMENT & PRINT</Text>
                            )}
                        </Pressable>
                    </View>
                    <Pressable style={styles.clearPaymentBtn} onPress={clearPaymentForm}>
                        <Text style={styles.clearPaymentText}>Clear</Text>
                    </Pressable>
                </>
            )}

            {/* Settlement History - Show filtered by farmer code when searched */}
            <View style={styles.settlementHistoryHeader}>
                <Text style={styles.subTitle}>
                    Settlement History {paymentFarmer ? `(${paymentFarmer.farmer.code})` : ''}
                </Text>
                {!paymentFarmer && (
                    <View style={styles.settlementStatsRow}>
                        <View style={styles.settlementCombinedChip}>
                            <Pressable
                                style={styles.settlementDateBtnCombined}
                                onPress={() => setShowSettlementDatePicker(true)}
                            >
                                <CalendarIcon size={14} color={colors.primary} />
                                <Text style={styles.settlementDateText}>
                                    {formatDateDDMMYYYY(settlementSummaryDate)}
                                </Text>
                            </Pressable>
                            <View style={styles.settlementChipDivider} />
                            <View style={styles.settlementStatChipCombined}>
                                <Text style={styles.settlementStatLabel}>PAID</Text>
                                <Text style={styles.settlementStatValue}>₹{settlementPaidOnDate.toLocaleString('en-IN')}</Text>
                            </View>
                        </View>
                        <View style={[styles.settlementStatChip, styles.settlementCurrentChip, settlementTotalBalance < 0 && { borderColor: colors.destructive }]}>
                            <Text style={styles.settlementStatLabel}>CURRENT</Text>
                            <Text style={[styles.settlementStatValue, styles.settlementCurrentValue, { color: settlementTotalBalance >= 0 ? colors.primary : colors.destructive }]} numberOfLines={1} adjustsFontSizeToFit>
                                ₹{settlementTotalBalance.toLocaleString('en-IN')}
                            </Text>
                        </View>
                        <Pressable
                            style={styles.balanceReportBtn}
                            onPress={() => setShowBalancePrintModal(true)}
                        >
                            <ClipboardList size={16} color={colors.primary} />
                        </Pressable>
                    </View>
                )}
            </View>

            {/* Settlement Date Picker Modal */}
            <Modal
                visible={showSettlementDatePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowSettlementDatePicker(false)}
            >
                <View style={styles.dateModalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowSettlementDatePicker(false)} />
                    <View style={[styles.dateModalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.dateModalHeader}>
                            <Text style={[styles.dateModalTitle, { color: colors.foreground }]}>Select Date</Text>
                            <Pressable onPress={() => setShowSettlementDatePicker(false)} style={styles.dateModalClose}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                        <Calendar
                            onDateSelect={(date) => {
                                if (date) {
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    const newDate = `${year}-${month}-${day}`;
                                    setSettlementSummaryDate(newDate);
                                    fetchSettlementSummaryStats(newDate);
                                    setShowSettlementDatePicker(false);
                                }
                            }}
                            selectedDate={settlementSummaryDate ? new Date(settlementSummaryDate + 'T00:00:00') : new Date()}
                        />
                    </View>
                </View>
            </Modal>
            {(() => {
                // Use farmer-specific payments when a farmer is selected, otherwise use global payments
                const filteredPayments = paymentFarmer
                    ? farmerPayments
                    : payments;

                if (filteredPayments.length === 0) {
                    return (
                        <Text style={styles.infoTextMuted}>
                            {paymentFarmer ? `No settlements for ${paymentFarmer.farmer.name}` : 'No settlements yet'}
                        </Text>
                    );
                }

                // When farmer is searched - show card format with infinite scroll
                if (paymentFarmer) {
                    return (
                        <View style={{ gap: 8 }}>
                            {filteredPayments.map((p) => (
                                <View key={p._id} style={styles.historyCard}>
                                    <View style={styles.historyCardHeader}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Text style={[styles.historyPeriod, { color: colors.primary, fontWeight: '700' }]}>
                                                {p.farmer?.code || '-'}
                                            </Text>
                                            <Text style={[styles.historyPeriod, { color: colors.foreground }]}>
                                                {p.farmer?.name || '-'}
                                            </Text>
                                        </View>
                                        <Text style={[styles.historyPeriod, { color: colors.mutedForeground, fontSize: 11 }]}>
                                            {formatDateDDMMYYYY(p.periodStart || p.date)} - {formatDateDDMMYYYY(p.periodEnd || p.date)}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Pressable
                                                style={styles.editPaymentBtn}
                                                onPress={() => handlePrintPaymentSlip(p)}
                                            >
                                                <Printer size={14} color={colors.primary} />
                                            </Pressable>
                                            <Pressable
                                                style={styles.editPaymentBtn}
                                                onPress={() => handleEditPayment(p)}
                                            >
                                                <Edit2 size={14} color={colors.primary} />
                                            </Pressable>
                                        </View>
                                    </View>
                                    <View style={styles.historyRow}>
                                        <Text style={styles.historyLabel}>Milk Amount:</Text>
                                        <Text style={[styles.historyValue, { color: colors.primary }]}>₹{(p.totalMilkAmount || 0).toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.historyRow}>
                                        <Text style={styles.historyLabel}>Advance:</Text>
                                        <Text style={[styles.historyValue, { color: colors.warning }]}>-₹{(p.totalAdvanceDeduction || 0).toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.historyRow}>
                                        <Text style={styles.historyLabel}>Total Payable:</Text>
                                        <Text style={[styles.historyValue, { color: colors.foreground }]}>₹{(p.netPayable || 0).toFixed(2)}</Text>
                                    </View>
                                    <View style={[styles.historyRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, marginTop: 4 }]}>
                                        <Text style={styles.historyLabel}>Paid Amount:</Text>
                                        <Text style={[styles.historyValue, { color: colors.primary }]}>₹{(p.amount || 0).toFixed(2)}</Text>
                                    </View>
                                    <View style={[styles.historyRow, { backgroundColor: colors.muted, marginHorizontal: -8, paddingHorizontal: 8, paddingVertical: 6, marginBottom: -6, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, marginTop: 6 }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={[styles.historyLabel, { fontWeight: '700' }]}>Closing Balance:</Text>
                                            <Text style={[styles.historyLabel, { fontSize: 10, color: colors.mutedForeground }]}>
                                                Created: {formatDateDDMMYYYY(p.createdAt || p.date)}
                                            </Text>
                                        </View>
                                        <Text style={[styles.historyValue, { fontWeight: '700', color: (p.closingBalance || 0) >= 0 ? colors.primary : colors.destructive }]}>
                                            ₹{(p.closingBalance || 0).toFixed(2)}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                            {/* Load More Button for farmer payments */}
                            {farmerPaymentsHasMore && (
                                <Pressable
                                    style={[styles.loadMoreBtn, farmerPaymentsLoadingMore && { opacity: 0.6 }]}
                                    onPress={loadMoreFarmerPayments}
                                    disabled={farmerPaymentsLoadingMore}
                                >
                                    {farmerPaymentsLoadingMore ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <Text style={styles.loadMoreText}>Load More</Text>
                                    )}
                                </Pressable>
                            )}
                        </View>
                    );
                }

                // Without search - show table format with infinite scroll
                return (
                    <View style={styles.historyTable}>
                        <View style={styles.historyTableHeader}>
                            <Text style={[styles.historyTableHeaderCell, { flex: 0.6 }]}>Code</Text>
                            <Text style={[styles.historyTableHeaderCell, { flex: 1 }]}>Date</Text>
                            <Text style={[styles.historyTableHeaderCell, { flex: 0.9 }]}>Milk</Text>
                            <Text style={[styles.historyTableHeaderCell, { flex: 0.7 }]}>Adv</Text>
                            <Text style={[styles.historyTableHeaderCell, { flex: 0.8 }]}>Paid</Text>
                            <Text style={[styles.historyTableHeaderCell, { flex: 0.8 }]}>Bal</Text>
                            <Text style={[styles.historyTableHeaderCell, { flex: 0.4 }]}></Text>
                        </View>
                        {filteredPayments.map((p) => (
                            <View key={p._id} style={styles.historyTableRow}>
                                <Text style={[styles.historyTableCell, { flex: 0.6, color: colors.primary, fontWeight: '600' }]}>
                                    {p.farmer?.code || '-'}
                                </Text>
                                <Text style={[styles.historyTableCell, { flex: 1 }]}>
                                    {formatDateDDMMYYYY(p.date)}
                                </Text>
                                <Text style={[styles.historyTableCell, { flex: 0.9, color: colors.primary }]}>
                                    ₹{(p.totalMilkAmount || 0).toFixed(0)}
                                </Text>
                                <Text style={[styles.historyTableCell, { flex: 0.7, color: colors.warning }]}>
                                    ₹{(p.totalAdvanceDeduction || 0).toFixed(0)}
                                </Text>
                                <Text style={[styles.historyTableCell, { flex: 0.8, color: colors.foreground, fontWeight: '600' }]}>
                                    ₹{(p.amount || 0).toFixed(0)}
                                </Text>
                                <Text style={[styles.historyTableCell, { flex: 0.8, fontWeight: '600', color: (p.closingBalance || 0) >= 0 ? colors.primary : colors.destructive }]}>
                                    ₹{(p.closingBalance || 0).toFixed(0)}
                                </Text>
                                <Pressable style={{ flex: 0.4, alignItems: 'center', justifyContent: 'center' }} onPress={() => handlePrintPaymentSlip(p)}>
                                    <Printer size={13} color={colors.primary} />
                                </Pressable>
                            </View>
                        ))}
                        {/* Load More Button for global payments */}
                        {paymentsHasMore && (
                            <Pressable
                                style={[styles.loadMoreBtn, paymentsLoadingMore && { opacity: 0.6 }]}
                                onPress={loadMorePayments}
                                disabled={paymentsLoadingMore}
                            >
                                {paymentsLoadingMore ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <Text style={styles.loadMoreText}>Load More</Text>
                                )}
                            </Pressable>
                        )}
                    </View>
                );
            })()}

            {/* Balance Print Modal */}
            <Modal
                visible={showBalancePrintModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowBalancePrintModal(false)}
            >
                <View style={styles.dateModalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowBalancePrintModal(false)} />
                    <View style={[styles.dateModalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.dateModalHeader}>
                            <Text style={[styles.dateModalTitle, { color: colors.foreground }]}>Print Balance Report</Text>
                            <Pressable onPress={() => setShowBalancePrintModal(false)} style={styles.dateModalClose}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 12, textAlign: 'center' }}>
                            Select balance type to print all farmer balances
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                            <Pressable
                                style={{
                                    flex: 1,
                                    paddingVertical: 14,
                                    borderRadius: 8,
                                    alignItems: 'center',
                                    borderWidth: 2,
                                    borderColor: balanceType === 'positive' ? colors.primary : colors.border,
                                    backgroundColor: balanceType === 'positive' ? colors.primary + '15' : colors.card,
                                }}
                                onPress={() => setBalanceType('positive')}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '700', color: balanceType === 'positive' ? colors.primary : colors.foreground }}>
                                    + Positive
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                                    Farmers you owe
                                </Text>
                            </Pressable>
                            <Pressable
                                style={{
                                    flex: 1,
                                    paddingVertical: 14,
                                    borderRadius: 8,
                                    alignItems: 'center',
                                    borderWidth: 2,
                                    borderColor: balanceType === 'negative' ? colors.destructive : colors.border,
                                    backgroundColor: balanceType === 'negative' ? colors.destructive + '15' : colors.card,
                                }}
                                onPress={() => setBalanceType('negative')}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '700', color: balanceType === 'negative' ? colors.destructive : colors.foreground }}>
                                    − Negative
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                                    Farmers owe you
                                </Text>
                            </Pressable>
                        </View>

                        <Pressable
                            style={{
                                backgroundColor: colors.primary,
                                paddingVertical: 14,
                                borderRadius: 8,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 8,
                                opacity: !balanceType ? 0.5 : 1,
                            }}
                            onPress={handlePrintBalances}
                            disabled={!balanceType || printingBalance}
                        >
                            {printingBalance ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <>
                                    <Printer size={18} color={colors.white} />
                                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.white }}>Print Report</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );

    const renderAdvancesTab = () => (
        <View>
            <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 0.4 }]}>
                    <Text style={styles.label}>Code</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Code"
                        value={advCode}
                        onChangeText={handleAdvCodeChange}
                        keyboardType="number-pad"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.muted }]}
                        placeholder="Name (auto-filled)"
                        value={advName}
                        editable={false}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Amount</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Amount"
                        value={advAmount}
                        onChangeText={setAdvAmount}
                        keyboardType="numeric"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date</Text>
                    <Pressable
                        style={styles.dateInputWrapper}
                        onPress={() => {
                            setTempCalendarDate(advDate ? new Date(advDate + 'T00:00:00') : new Date());
                            setShowAdvDatePicker(true);
                        }}
                    >
                        <Text style={[styles.dateInputText, !advDate && { color: colors.mutedForeground }]}>
                            {advDate ? formatDateDDMMYYYY(advDate) : 'Select Date'}
                        </Text>
                        <CalendarIcon size={16} color={colors.mutedForeground} />
                    </Pressable>
                </View>
            </View>

            {/* Advance Date Picker Modal */}
            <Modal
                visible={showAdvDatePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAdvDatePicker(false)}
            >
                <View style={styles.dateModalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowAdvDatePicker(false)} />
                    <View style={[styles.dateModalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.dateModalHeader}>
                            <Text style={[styles.dateModalTitle, { color: colors.foreground }]}>Select Advance Date</Text>
                            <Pressable onPress={() => setShowAdvDatePicker(false)} style={styles.dateModalClose}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                        <Calendar
                            onDateSelect={(date) => {
                                if (date) {
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    setAdvDate(`${year}-${month}-${day}`);
                                    setShowAdvDatePicker(false);
                                }
                            }}
                            selectedDate={tempCalendarDate}
                        />
                    </View>
                </View>
            </Modal>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Note</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Note (e.g. Ghee, Cash)"
                    value={advNote}
                    onChangeText={setAdvNote}
                    placeholderTextColor={colors.mutedForeground}
                />
            </View>

            <View style={styles.buttonRow}>
                <Pressable style={styles.saveBtn} onPress={handleAddAdvance} disabled={loading}>
                    <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save Advance'}</Text>
                </Pressable>
                <Pressable style={styles.clearBtn} onPress={clearAdvanceForm}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </Pressable>
            </View>

            {/* Search bar and PDF button + sort */}
            <View style={styles.advanceSearchRow}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.2, borderColor: '#9CA3AF', borderRadius: 6, paddingHorizontal: 10 }}>
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={[styles.advanceSearchInput, { borderWidth: 0, backgroundColor: 'transparent', marginLeft: 8 }]}
                        placeholder="Search by exact code"
                        value={advanceSearch}
                        onChangeText={setAdvanceSearch}
                        keyboardType="numeric"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <Pressable style={styles.advancePdfBtn} onPress={generateAdvancesPDF}>
                    <FileText size={14} color={colors.white} />
                    <Text style={styles.advancePdfBtnText}>PDF</Text>
                </Pressable>
                <Pressable style={[styles.advancePdfBtn, { backgroundColor: colors.primary }]} onPress={printAdvancesThermal}>
                    <Printer size={14} color={colors.white} />
                    <Text style={styles.advancePdfBtnText}>Print</Text>
                </Pressable>
                <Pressable
                    onPress={async () => {
                        const next = advSortOrder === 'asc' ? 'desc' : 'asc';
                        setAdvSortOrder(next);
                        // immediate fetch with next order so UI feels instant
                        try {
                            const res = await advancesApi.getAll({
                                page: 1,
                                limit: 10,
                                search: advanceSearch || undefined,
                                status: 'pending',
                                sortBy: 'amount',
                                order: next,
                            });
                            if (res.success && res.response?.data) {
                                setAdvances(res.response.data);
                                setAdvancesTotalCount(res.response.pagination.total);
                                setAdvancesHasMore(1 < res.response.pagination.pages);
                                setAdvancesPage(1);
                                if (res.response.totalPendingAmount !== undefined) setTotalPendingAmount(res.response.totalPendingAmount);
                            }
                        } catch {}
                    }}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: advSortOrder ? colors.primary : colors.card,
                        borderWidth: 1.2,
                        borderColor: advSortOrder ? colors.primary : '#9CA3AF',
                    }}
                >
                    {advSortOrder === 'asc' ? <ArrowUp size={18} color={advSortOrder ? '#fff' : colors.primary} /> : advSortOrder === 'desc' ? <ArrowDown size={18} color="#fff" /> : <ArrowUpDown size={18} color={colors.primary} />}
                </Pressable>
            </View>

            {/* Total header - count + amount */}
            <View style={styles.totalAmountHeader}>
                <View>
                    <Text style={styles.totalAmountLabel}>Total Records</Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>{advancesTotalCount} records • {advances.length} shown</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.totalAmountLabel}>Total Amount</Text>
                    <Text style={styles.totalAmountValue}>₹{totalPendingAmount.toLocaleString('en-IN')}</Text>
                </View>
            </View>

            {/* Advances Table */}
            {advances.length > 0 ? (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Note</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Amt</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Date</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Del</Text>
                    </View>
                    {(advances || []).filter(Boolean).map((item, idx) => {
                        // settled is now filtered server-side; partial should appear normally (no cross)
                        const rowKey = String((item as any)?._id || (item as any)?.id || idx);
                        return (
                            <View key={rowKey} style={styles.tableRow}>
                                <Text style={[styles.tableCell, { flex: 0.5, color: colors.primary, textAlign: 'center' }]}>{item.farmer?.code || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 1.3, textAlign: 'center' }]}>{item?.farmer?.name || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'center' }]}>{item?.note || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'center', color: colors.warning }]}>₹{item?.amount ?? 0}</Text>
                                <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'center' }]}>
                                    {item?.date ? new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                </Text>
                                <View style={{ flex: 0.5, alignItems: 'center', justifyContent: 'center' }}>
                                    <Pressable
                                        style={styles.deleteBtn}
                                        onPress={() => handleDeleteAdvance((item as any)?._id, item?.farmer?.name || 'Unknown')}
                                    >
                                        <Trash2 size={14} color={colors.destructive} />
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })}
                    {/* Load More Button for advances */}
                    {advancesHasMore && (
                        <Pressable
                            style={styles.loadMoreBtn}
                            onPress={loadMoreAdvances}
                            disabled={advancesLoadingMore}
                        >
                            <Text style={styles.loadMoreText}>
                                {advancesLoadingMore ? 'Loading...' : `Load More (${advancesTotalCount - advances.length} remaining)`}
                            </Text>
                        </Pressable>
                    )}
                </View>
            ) : (
                <Text style={styles.infoTextMuted}>
                    {advanceSearch ? 'No advances found matching your search' : 'No advances recorded yet'}
                </Text>
            )}
        </View>
    );

    const renderFarmersTab = () => (
        <View>
            {/* Header with Search, Print, Add */}
            <View style={styles.farmerHeader}>
                <View style={styles.farmerSearchContainer}>
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={styles.farmerTabSearchInput}
                        placeholder="Search by code..."
                        placeholderTextColor={colors.mutedForeground}
                        value={farmerTabSearch}
                        onChangeText={setFarmerTabSearch}
                        keyboardType="number-pad"
                    />
                    {farmerSearchLoading && (
                        <ActivityIndicator size="small" color={colors.primary} />
                    )}
                </View>
                <View style={styles.farmerHeaderBtns}>
                    <Pressable style={styles.printFarmerBtn} onPress={downloadFarmersPDF}>
                        <FileText size={14} color={colors.primary} />
                        <Text style={styles.printFarmerText}>PDF</Text>
                    </Pressable>
                    <Pressable style={styles.printFarmerBtn} onPress={generateFarmersPDF}>
                        <Printer size={14} color={colors.primary} />
                        <Text style={styles.printFarmerText}>Print</Text>
                    </Pressable>
                    <Pressable
                        style={styles.addFarmerBtn}
                        onPress={() => {
                            clearFarmerForm();
                            setShowFarmerModal(true);
                        }}
                    >
                        <Plus size={14} color={colors.white} />
                        <Text style={styles.addFarmerBtnText}>Add</Text>
                    </Pressable>
                </View>
            </View>

            <Text style={styles.farmerManagementTitle}>Farmer Management</Text>
            <Text style={[styles.sectionTitle, { marginTop: 4, fontSize: 13 }]}>Farmers List ({farmers.filter(f => f.isActive !== false).length} active, {farmers.filter(f => f.isActive === false).length} inactive)</Text>

            {/* Farmers Table */}
            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : farmers.length > 0 ? (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Mobile</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Actions</Text>
                    </View>
                    {farmers.map((item) => {
                        const isInactive = item.isActive === false;
                        return (
                            <View key={item._id} style={[styles.tableRow, isInactive && { opacity: 0.45 }]}>
                                <Text style={[styles.tableCell, { flex: 0.5, color: colors.primary, textAlign: 'center' }]}>{item.code}</Text>
                                <View style={{ flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                    <Text style={[styles.tableCell, { textAlign: 'center' }]}>{item.name}</Text>
                                    {isInactive && (
                                        <View style={{ backgroundColor: colors.mutedForeground, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                                            <Text style={{ fontSize: 8, color: colors.white, fontWeight: '700' }}>Off</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>{item.mobile}</Text>
                                <View style={{ flex: 0.7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <Pressable style={styles.editBtn} onPress={() => handleEditFarmer(item)}>
                                        <Edit2 size={14} color={colors.primary} />
                                    </Pressable>
                                    {!isInactive ? (
                                        <Pressable style={styles.deleteBtn} onPress={() => handleDeleteFarmer(item._id, item.name)}>
                                            <Trash2 size={14} color={colors.destructive} />
                                        </Pressable>
                                    ) : (
                                        <Pressable style={[styles.editBtn, { backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '30' }]} onPress={() => handleRestoreFarmer(item._id, item.name)}>
                                            <Power size={14} color={colors.primary} />
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>
            ) : (
                <Text style={styles.infoTextMuted}>No farmers found. Add your first farmer.</Text>
            )}
        </View>
    );

    // Farmer Modal - Centered (like Member tab)
    const renderFarmerModal = () => (
        <Modal
            visible={showFarmerModal}
            animationType="fade"
            transparent
            onRequestClose={() => setShowFarmerModal(false)}
        >
            <View style={styles.centeredModalOverlay}>
                {/* Tap outside to close */}
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowFarmerModal(false)} />

                <View style={styles.centeredModalContainer}>
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        {/* Header */}
                        <View style={styles.farmerModalHeader}>
                            <View style={styles.farmerModalHeaderLeft}>
                                <View style={styles.farmerModalIcon}>
                                    <User size={20} color={colors.white} />
                                </View>
                                <Text style={styles.farmerModalTitle}>{editingFarmer ? 'Edit Farmer' : 'Add New Farmer'}</Text>
                            </View>
                            <Pressable style={styles.farmerModalCloseBtn} onPress={() => setShowFarmerModal(false)}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        {/* Body */}
                        <ScrollView
                            style={styles.farmerModalBody}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.farmerModalBodyContent}
                        >
                            <View style={styles.farmerFormCard}>
                                <View style={styles.farmerModalInputGroup}>
                                    <Text style={styles.label}>Code <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.farmerModalInput}
                                        placeholder="Enter code (numbers only)"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={newCode}
                                        onChangeText={setNewCode}
                                        keyboardType="numeric"
                                    />
                                </View>

                                <View style={styles.farmerModalInputGroup}>
                                    <Text style={styles.label}>Name <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.farmerModalInput}
                                        placeholder="Enter farmer name"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={newName}
                                        onChangeText={setNewName}
                                    />
                                </View>

                                <View style={styles.farmerModalInputGroup}>
                                    <Text style={styles.label}>Mobile <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.farmerModalInput}
                                        placeholder="Enter mobile number"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={newMobile}
                                        onChangeText={setNewMobile}
                                        keyboardType="phone-pad"
                                    />
                                </View>

                                <View style={styles.farmerModalInputGroup}>
                                    <Text style={styles.label}>Address</Text>
                                    <TextInput
                                        style={styles.farmerModalInput}
                                        placeholder="Enter address (optional)"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={newAddress}
                                        onChangeText={setNewAddress}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.farmerModalFooter}>
                            <Pressable style={styles.farmerModalCancelBtn} onPress={() => setShowFarmerModal(false)}>
                                <Text style={styles.farmerModalCancelBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={styles.farmerModalSaveBtn}
                                onPress={editingFarmer ? handleUpdateFarmer : handleAddFarmer}
                                disabled={loading}
                            >
                                <Text style={styles.farmerModalSaveBtnText}>
                                    {loading ? 'Saving...' : (editingFarmer ? 'Update' : 'Save')}
                                </Text>
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
                filterTab="register"
                title="Subscribe to Access Register"
                fullScreen={true}
            />
            <TopBar />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
            >
                {activeTab === 'Payments' && renderPaymentsTab()}
                {activeTab === 'Advances' && renderAdvancesTab()}
                {activeTab === 'Farmer' && renderFarmersTab()}
            </ScrollView>


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

            {/* Farmer Modal */}
            {renderFarmerModal()}

            {/* Edit Payment Modal */}
            <Modal
                visible={editPaymentVisible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={closeEditPaymentModal}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.dateModalOverlay}
                >
                    <Pressable style={{ flex: 1 }} onPress={closeEditPaymentModal} />
                    <View
                        style={[
                            styles.editPaymentModalContent,
                            {
                                backgroundColor: colors.card,
                                paddingBottom: Math.max(insets.bottom, 12),
                                maxHeight: '90%',
                            },
                        ]}
                    >
                        <View style={[styles.editPaymentModalHeader, { paddingTop: 14 }]}>
                            <Text style={[styles.editPaymentModalTitle, { color: colors.foreground }]}>Edit Payment</Text>
                            <Pressable onPress={closeEditPaymentModal} style={styles.dateModalClose}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        {editingPayment && (
                            <ScrollView
                                style={styles.editPaymentModalBody}
                                contentContainerStyle={{ paddingBottom: 16 }}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >
                                <Text style={[styles.editPaymentFarmerInfo, { color: colors.primary }]}>
                                    {editingPayment.farmer?.code} - {editingPayment.farmer?.name}
                                </Text>

                                {/* Editable Period Dates */}
                                <Text style={[styles.editPaymentLabel, { color: colors.mutedForeground, marginTop: 12, marginBottom: 6 }]}>Period</Text>
                                <View style={styles.dateRow}>
                                    <Pressable
                                        style={styles.dateInputWrapper}
                                        onPress={() => {
                                            setTempCalendarDate(editPeriodStart ? new Date(editPeriodStart + 'T00:00:00') : new Date());
                                            setShowEditStartDatePicker(true);
                                        }}
                                    >
                                        <Text style={[styles.dateInputText, !editPeriodStart && { color: colors.mutedForeground }]}>
                                            {editPeriodStart ? formatDateDDMMYYYY(editPeriodStart) : 'Start Date'}
                                        </Text>
                                        <CalendarIcon size={16} color={colors.mutedForeground} />
                                    </Pressable>
                                    <Pressable
                                        style={styles.dateInputWrapper}
                                        onPress={() => {
                                            setTempCalendarDate(editPeriodEnd ? new Date(editPeriodEnd + 'T00:00:00') : new Date());
                                            setShowEditEndDatePicker(true);
                                        }}
                                    >
                                        <Text style={[styles.dateInputText, !editPeriodEnd && { color: colors.mutedForeground }]}>
                                            {editPeriodEnd ? formatDateDDMMYYYY(editPeriodEnd) : 'End Date'}
                                        </Text>
                                        <CalendarIcon size={16} color={colors.mutedForeground} />
                                    </Pressable>
                                </View>

                                <View style={styles.editPaymentInputGroup}>
                                    <Text style={[styles.editPaymentLabel, { color: colors.mutedForeground }]}>Milk Amount (₹)</Text>
                                    <TextInput
                                        style={[styles.editPaymentInput, { backgroundColor: colors.secondary, color: colors.foreground }]}
                                        value={editMilkAmount}
                                        onChangeText={setEditMilkAmount}
                                        keyboardType="numeric"
                                        placeholder="Enter milk amount"
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>

                                <View style={styles.editPaymentInputGroup}>
                                    <Text style={[styles.editPaymentLabel, { color: colors.mutedForeground }]}>Paid Amount (₹)</Text>
                                    <TextInput
                                        style={[styles.editPaymentInput, { backgroundColor: colors.secondary, color: colors.foreground }]}
                                        value={editPaidAmount}
                                        onChangeText={setEditPaidAmount}
                                        keyboardType="numeric"
                                        placeholder="Enter paid amount"
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>

                                {/* Settled Advances Section */}
                                <View style={styles.settledAdvancesSection}>
                                    <Text style={[styles.settledAdvancesTitle, { color: colors.primary }]}>Advance History</Text>

                                    {(!editingPayment.settledAdvances || editingPayment.settledAdvances.length === 0) && (
                                        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>
                                            No advances on this payment
                                        </Text>
                                    )}

                                    {editingPayment.settledAdvances?.map((adv, index) => (
                                        <View key={adv._id || index} style={[styles.settledAdvanceRow, { borderColor: colors.border }]}>
                                            <View style={styles.settledAdvanceInfo}>
                                                <Text style={[styles.settledAdvanceCode, { color: colors.foreground }]}>
                                                    {adv.farmer?.code || editingPayment.farmer?.code || '-'} - {adv.farmer?.name || editingPayment.farmer?.name || '-'}
                                                </Text>
                                                <Text style={[styles.settledAdvanceNote, { color: colors.mutedForeground }]}>
                                                    {adv.note || 'No note'} • {new Date(adv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </Text>
                                            </View>
                                            <Text style={[styles.settledAdvanceAmount, { color: colors.warning, marginRight: 8 }]}>
                                                ₹{adv.amount.toLocaleString('en-IN')}
                                            </Text>
                                            <Pressable
                                                onPress={() => handleDeleteAdvanceFromPayment(adv._id!)}
                                                disabled={deletingAdvanceId === adv._id}
                                                style={{ padding: 6, borderRadius: 6, backgroundColor: colors.destructive + '15' }}
                                                hitSlop={6}
                                            >
                                                {deletingAdvanceId === adv._id ? (
                                                    <ActivityIndicator size="small" color={colors.destructive} />
                                                ) : (
                                                    <Trash2 size={14} color={colors.destructive} />
                                                )}
                                            </Pressable>
                                        </View>
                                    ))}

                                    {/* Add Advance form (2 inputs: amount + note) */}
                                    <View style={{ marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.foreground, marginBottom: 6 }}>
                                            Add Advance
                                        </Text>
                                        <TextInput
                                            style={[styles.editPaymentInput, { backgroundColor: colors.secondary, color: colors.foreground, marginBottom: 6 }]}
                                            value={newAdvAmount}
                                            onChangeText={setNewAdvAmount}
                                            keyboardType="numeric"
                                            placeholder="Amount (₹)"
                                            placeholderTextColor={colors.mutedForeground}
                                        />
                                        <TextInput
                                            style={[styles.editPaymentInput, { backgroundColor: colors.secondary, color: colors.foreground, marginBottom: 8 }]}
                                            value={newAdvNote}
                                            onChangeText={setNewAdvNote}
                                            placeholder="Note (optional)"
                                            placeholderTextColor={colors.mutedForeground}
                                        />
                                        <Pressable
                                            onPress={handleAddAdvanceToPayment}
                                            disabled={addingAdvance}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                                backgroundColor: colors.primary,
                                                paddingVertical: 9,
                                                borderRadius: 6,
                                                opacity: addingAdvance ? 0.7 : 1,
                                            }}
                                        >
                                            {addingAdvance ? (
                                                <ActivityIndicator size="small" color={colors.white} />
                                            ) : (
                                                <>
                                                    <Plus size={14} color={colors.white} />
                                                    <Text style={{ color: colors.white, fontSize: 13, fontWeight: '700' }}>Add Advance</Text>
                                                </>
                                            )}
                                        </Pressable>
                                    </View>
                                </View>

                                <View style={styles.editPaymentSummary}>
                                    <View style={styles.editPaymentSummaryRow}>
                                        <Text style={[styles.editPaymentSummaryLabel, { color: colors.mutedForeground }]}>Advance Deduction:</Text>
                                        <Text style={[styles.editPaymentSummaryValue, { color: colors.warning }]}>
                                            ₹{(editingPayment.totalAdvanceDeduction || 0).toFixed(2)}
                                        </Text>
                                    </View>
                                    <View style={styles.editPaymentSummaryRow}>
                                        <Text style={[styles.editPaymentSummaryLabel, { color: colors.mutedForeground }]}>Previous Balance:</Text>
                                        <Text style={[styles.editPaymentSummaryValue, { color: colors.foreground }]}>
                                            ₹{(editingPayment.previousBalance || 0).toFixed(2)}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.editPaymentBtnRow}>
                                    <Pressable style={[styles.editPaymentCancelBtn, { backgroundColor: colors.muted }]} onPress={closeEditPaymentModal}>
                                        <Text style={[styles.editPaymentCancelBtnText, { color: colors.foreground }]}>Cancel</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.editPaymentSaveBtn, { backgroundColor: colors.primary }]}
                                        onPress={handleUpdatePayment}
                                        disabled={updatingPayment}
                                    >
                                        <Text style={styles.editPaymentSaveBtnText}>
                                            {updatingPayment ? 'Saving...' : 'Save Changes'}
                                        </Text>
                                    </Pressable>
                                </View>
                            </ScrollView>
                        )}

                        {/* Edit Start Date Picker Modal */}
                        <Modal
                            visible={showEditStartDatePicker}
                            transparent
                            animationType="slide"
                            onRequestClose={() => setShowEditStartDatePicker(false)}
                        >
                            <View style={styles.dateModalOverlay}>
                                <Pressable style={{ flex: 1 }} onPress={() => setShowEditStartDatePicker(false)} />
                                <View style={[styles.dateModalContent, { backgroundColor: isDark ? colors.card : '#fff' }]}>
                                    <PaymentRangeCalendar
                                        startDate={editPeriodStart}
                                        endDate={editPeriodEnd}
                                        onStartDateSelect={(date) => {
                                            setEditPeriodStart(date);
                                            setShowEditStartDatePicker(false);
                                        }}
                                        onEndDateSelect={(date) => {
                                            setEditPeriodEnd(date);
                                        }}
                                        blockedPeriods={editBlockedPeriods}
                                        selectingType="start"
                                        onClose={() => setShowEditStartDatePicker(false)}
                                    />
                                </View>
                            </View>
                        </Modal>

                        {/* Edit End Date Picker Modal */}
                        <Modal
                            visible={showEditEndDatePicker}
                            transparent
                            animationType="slide"
                            onRequestClose={() => setShowEditEndDatePicker(false)}
                        >
                            <View style={styles.dateModalOverlay}>
                                <Pressable style={{ flex: 1 }} onPress={() => setShowEditEndDatePicker(false)} />
                                <View style={[styles.dateModalContent, { backgroundColor: isDark ? colors.card : '#fff' }]}>
                                    <PaymentRangeCalendar
                                        startDate={editPeriodStart}
                                        endDate={editPeriodEnd}
                                        onStartDateSelect={(date) => {
                                            setEditPeriodStart(date);
                                        }}
                                        onEndDateSelect={(date) => {
                                            setEditPeriodEnd(date);
                                            setShowEditEndDatePicker(false);
                                        }}
                                        blockedPeriods={editBlockedPeriods}
                                        selectingType="end"
                                        onClose={() => setShowEditEndDatePicker(false)}
                                    />
                                </View>
                            </View>
                        </Modal>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },


    pdfRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 12,
    },
    dateModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    dateModalContent: {
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
    },
    dateModalClose: {
        padding: 4,
    },
    selectedDateDisplay: {
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: isDark ? colors.muted : '#f0fdf4',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    selectedDateLabel: {
        fontSize: 12,
        color: colors.mutedForeground,
        marginBottom: 4,
    },
    selectedDateValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#22c55e',
    },
    dateModalFooter: {
        flexDirection: 'row',
        padding: 12,
        gap: 10,
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
        backgroundColor: '#22c55e',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    confirmModalBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },


    scrollView: {
        flex: 1,
    },
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
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    inputGroup: {
        flex: 1,
        marginBottom: 10,
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
    searchRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 1.2,
        borderColor: '#9CA3AF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.foreground,
    },
    goBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 50,
        minHeight: 40,
    },
    goBtnText: {
        color: colors.white,
        fontSize: 15,
        fontWeight: '700',
    },
    goBtnImproved: {
        backgroundColor: colors.primary,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
        minWidth: 72,
        minHeight: 42,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    goBtnTextImproved: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    balanceReportBtn: {
        backgroundColor: colors.card,
        borderWidth: 1.5,
        borderColor: colors.primary,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 38,
        minHeight: 34,
    },
    pdfBtn: {
        backgroundColor: colors.warning,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        justifyContent: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    pdfBtnText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
    },
    subTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.mutedForeground,
        marginBottom: 4,
    },
    infoText: {
        fontSize: 13,
        color: colors.primary,
    },
    infoTextMuted: {
        fontSize: 13,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginTop: 20,
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
    },
    clearBtnText: {
        color: colors.foreground,
        fontSize: 14,
        fontWeight: '600',
    },
    table: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        overflow: 'hidden',
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: colors.muted,
        paddingVertical: 8,
        paddingHorizontal: 6,
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
    },
    tableCell: {
        fontSize: 12,
        color: colors.foreground,
        textAlign: 'center',
    },
    deleteBtn: {
        padding: 4,
        backgroundColor: colors.destructive + '20',
        borderRadius: 4,
    },
    editBtn: {
        padding: 4,
        backgroundColor: colors.primary + '20',
        borderRadius: 4,
    },
    textInput: {
        flex: 1,
        fontSize: 14,
        color: colors.foreground,
        padding: 0,
    },
    // Payment tab specific styles
    farmerInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingVertical: 8,
    },
    farmerName: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    farmerMobile: {
        fontSize: 13,
        color: colors.mutedForeground,
        marginTop: 2,
    },
    balanceLabel: {
        fontSize: 11,
        color: colors.mutedForeground,
    },
    balanceValue: {
        fontSize: 18,
        fontWeight: '700',
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.mutedForeground,
        marginBottom: 6,
        marginTop: 8,
    },
    dateRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    dateInputWrapper: {
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 1.2,
        borderColor: '#9CA3AF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dateInput: {
        flex: 1,
        fontSize: 13,
        color: colors.foreground,
        padding: 0,
    },
    quickDateRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    quickDateBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
    },
    quickDateText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.foreground,
    },
    calculateBtn: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 4,
        backgroundColor: colors.primary,
        marginLeft: 'auto',
    },
    calculateBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.white,
    },
    summaryCard: {
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    summaryLabel: {
        fontSize: 14,
        color: colors.foreground,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    milkAmountInput: {
        backgroundColor: colors.background,
        borderWidth: 1.2,
        borderColor: '#9CA3AF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
        minWidth: 100,
        textAlign: 'right',
    },
    advanceListCard: {
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
    },
    advanceListTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.mutedForeground,
        marginBottom: 8,
    },
    advanceListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        gap: 8,
    },
    advanceItemNote: {
        flex: 1,
        fontSize: 13,
        color: colors.foreground,
    },
    advanceItemDate: {
        fontSize: 11,
        color: colors.mutedForeground,
    },
    advanceItemAmount: {
        fontSize: 13,
        fontWeight: '600',
    },
    paidInput: {
        backgroundColor: colors.card,
        borderWidth: 1.2,
        borderColor: '#9CA3AF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.foreground,
        marginBottom: 12,
    },
    closingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    closingLabel: {
        fontSize: 14,
        color: colors.foreground,
    },
    closingValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    saveSettlementBtn: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 6,
        alignItems: 'center',
    },
    saveSettlementText: {
        color: colors.white,
        fontSize: 15,
        fontWeight: '700',
    },
    viewEntriesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: colors.card,
        borderWidth: 1.2,
        borderColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 10,
        marginBottom: 12,
    },
    viewEntriesText: {
        fontSize: 13,
        fontWeight: '700',
    },
    clearPaymentBtn: {
        backgroundColor: colors.muted,
        paddingVertical: 10,
        borderRadius: 6,
        alignItems: 'center',
        marginTop: 8,
    },
    clearPaymentText: {
        color: colors.foreground,
        fontSize: 14,
        fontWeight: '600',
    },
    // Custom ranges styles
    rangesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    rangeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    rangeChipBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    rangeChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.foreground,
    },
    rangeDeleteBtn: {
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderLeftWidth: 1,
        borderLeftColor: colors.border,
    },
    addRangeForm: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    rangeInput: {
        width: 50,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 6,
        fontSize: 12,
        color: colors.foreground,
        textAlign: 'center',
    },
    rangeDash: {
        fontSize: 14,
        color: colors.mutedForeground,
    },
    rangeAddConfirmBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
    },
    rangeAddConfirmText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.white,
    },
    rangeCancelBtn: {
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    rangeCancelText: {
        fontSize: 14,
        color: colors.mutedForeground,
    },
    addRangeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: 'dashed',
    },
    addRangeText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.primary,
    },
    // Advances search and PDF styles
    advanceSearchRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        marginTop: 8,
    },
    advanceSearchInput: {
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 1.2,
        borderColor: '#9CA3AF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.foreground,
    },
    advancePdfBtn: {
        backgroundColor: colors.warning,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        justifyContent: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    advancePdfBtnText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
    },
    settledRow: {
        opacity: 0.6,
        backgroundColor: 'rgba(0,0,0,0.03)',
    },
    settledText: {
        color: '#999',
    },
    settledAmountText: {
        textDecorationLine: 'line-through',
        color: colors.destructive,
    },
    dateInputText: {
        flex: 1,
        fontSize: 13,
        color: colors.foreground,
    },
    // History table styles
    historyTable: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        overflow: 'hidden',
    },
    historyTableHeader: {
        flexDirection: 'row',
        backgroundColor: colors.primary,
        paddingVertical: 8,
        paddingHorizontal: 6,
    },
    historyTableHeaderCell: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.white,
        textAlign: 'center',
    },
    historyTableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    historyTableCell: {
        fontSize: 11,
        color: colors.foreground,
        textAlign: 'center',
    },
    // History card styles (for searched farmer)
    historyCard: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    historyCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.primary,
        gap: 4,
    },
    historyPeriod: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.foreground,
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
    },
    // Edit payment button style
    editPaymentBtn: {
        padding: 6,
        backgroundColor: 'rgba(74, 144, 226, 0.15)',
        borderRadius: 6,
    },
    // Edit Payment Modal styles
    editPaymentModalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 30,
    },
    editPaymentModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    editPaymentModalTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    editPaymentModalBody: {
        padding: 16,
    },
    editPaymentFarmerInfo: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    editPaymentPeriod: {
        fontSize: 13,
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
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
    },
    settledAdvancesSection: {
        backgroundColor: colors.muted,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    settledAdvancesTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 10,
        textAlign: 'center',
    },
    settledAdvanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    settledAdvanceInfo: {
        flex: 1,
    },
    settledAdvanceCode: {
        fontSize: 13,
        fontWeight: '500',
    },
    settledAdvanceNote: {
        fontSize: 11,
        marginTop: 2,
    },
    settledAdvanceAmount: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 10,
    },
    editPaymentSummary: {
        backgroundColor: colors.muted,
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
    },
    editPaymentSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
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
    // Farmer Tab - New design like Member tab
    farmerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        gap: 10,
    },
    farmerSearchContainer: {
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
    farmerTabSearchInput: {
        flex: 1,
        fontSize: 14,
        color: colors.foreground,
        padding: 0,
    },
    farmerManagementTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
        marginBottom: 4,
    },
    farmerHeaderBtns: {
        flexDirection: 'row',
        gap: 8,
    },
    printFarmerBtn: {
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
    printFarmerText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.primary,
    },
    addFarmerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: colors.primary,
        borderRadius: 6,
    },
    addFarmerBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.white,
    },
    // Farmer Modal Styles
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
    farmerModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.card,
    },
    farmerModalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    farmerModalIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    farmerModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
    },
    farmerModalCloseBtn: {
        padding: 8,
        backgroundColor: colors.muted,
        borderRadius: 10,
    },
    farmerModalBody: {
        flex: 1,
        paddingHorizontal: 16,
    },
    farmerModalBodyContent: {
        paddingBottom: 30,
        paddingTop: 16,
    },
    farmerFormCard: {
        backgroundColor: colors.background,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    farmerModalInputGroup: {
        marginBottom: 16,
    },
    farmerModalInput: {
        backgroundColor: isDark ? colors.muted : colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 15,
        color: colors.foreground,
    },
    farmerModalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        paddingBottom: 30,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.card,
    },
    farmerModalCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.muted,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    farmerModalCancelBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.foreground,
    },
    farmerModalSaveBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    farmerModalSaveBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.white,
    },
    // Load More Button Styles
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
    // Total Amount Header Styles
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
    },
    totalAmountLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },
    totalAmountValue: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    // Settlement History Header Styles
    settlementHistoryHeader: {
        marginTop: 16,
        marginBottom: 8,
    },
    settlementStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        flexWrap: 'nowrap',
    },
    settlementCombinedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        backgroundColor: 'transparent',
        overflow: 'hidden',
    },
    settlementDateBtnCombined: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    settlementChipDivider: {
        width: 0,
        alignSelf: 'stretch',
        borderLeftWidth: 1,
        borderLeftColor: colors.primary,
        borderStyle: 'dashed',
    },
    settlementStatChipCombined: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    settlementDateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        backgroundColor: 'transparent',
    },
    settlementDateText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.primary,
    },
    settlementStatChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        backgroundColor: 'transparent',
        flexShrink: 1,
    },
    settlementCurrentChip: {
        flex: 1,
        minWidth: 0,
        maxWidth: '38%',
        justifyContent: 'space-between',
    },
    settlementCurrentValue: {
        flexShrink: 1,
        fontSize: 12,
    },
    settlementStatLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.mutedForeground,
        textTransform: 'uppercase',
        flexShrink: 0,
    },
    settlementStatValue: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.primary,
        flexShrink: 1,
    },
});
