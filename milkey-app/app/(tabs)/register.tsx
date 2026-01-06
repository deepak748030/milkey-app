import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Modal, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Calendar as CalendarIcon, FileText, Trash2, Plus, Search, X, Edit2, Printer, User } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { farmersApi, advancesApi, paymentsApi, Farmer, Advance, Payment, FarmerPaymentSummary } from '@/lib/milkeyApi';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Calendar } from '@/components/Calendar';
import { PaymentRangeCalendar, BlockedPeriod } from '@/components/PaymentRangeCalendar';
import { useLocalSearchParams } from 'expo-router';
import { useSubscriptionCheck } from '@/hooks/useSubscriptionCheck';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { useDebounce } from '@/hooks/useDebounce';

// Helper function to format date as dd/mm/yyyy
const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

type TabType = 'Payments' | 'Advances' | 'Farmers';

// Custom date range interface
interface DateRange {
    id: string;
    startDay: number;
    endDay: number;
    label: string;
}

export default function RegisterScreen() {
    const { colors, isDark } = useTheme();
    const { tab } = useLocalSearchParams<{ tab?: string }>();

    // Subscription check
    const {
        hasAccess,
        loading: subscriptionLoading,
        showSubscriptionModal,
        handleModalClose,
        handleSubscriptionSuccess
    } = useSubscriptionCheck('register');

    const [activeTab, setActiveTab] = useState<TabType>('Farmers');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Set active tab from URL params
    useEffect(() => {
        if (tab && ['Payments', 'Advances', 'Farmers'].includes(tab)) {
            setActiveTab(tab as TabType);
        }
    }, [tab]);

    // Data state
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [advances, setAdvances] = useState<Advance[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);

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

    // Custom date ranges state
    const [customRanges, setCustomRanges] = useState<DateRange[]>([
        { id: '1', startDay: 1, endDay: 10, label: '1-10' },
        { id: '2', startDay: 11, endDay: 20, label: '11-20' },
        { id: '3', startDay: 21, endDay: 31, label: '21-End' },
    ]);
    const [showAddRange, setShowAddRange] = useState(false);
    const [newRangeStart, setNewRangeStart] = useState('');
    const [newRangeEnd, setNewRangeEnd] = useState('');

    // Advances search and date picker
    const [advanceSearch, setAdvanceSearch] = useState('');
    const [showAdvDatePicker, setShowAdvDatePicker] = useState(false);

    // Payment date pickers
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [dateSelectingType, setDateSelectingType] = useState<'start' | 'end'>('start');

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

    const fetchData = async () => {
        setLoading(true);
        try {
            const [farmersRes, advancesRes, paymentsRes] = await Promise.all([
                farmersApi.getAll(),
                advancesApi.getAll(),
                paymentsApi.getAll({ limit: 20 }),
            ]);

            if (farmersRes.success && farmersRes.response?.data) {
                // Sort farmers by code as numeric values in ascending order
                const sortedFarmers = [...farmersRes.response.data].sort((a, b) => {
                    const codeA = parseInt(a.code, 10) || 0;
                    const codeB = parseInt(b.code, 10) || 0;
                    return codeA - codeB;
                });
                setFarmers(sortedFarmers);
            }
            if (advancesRes.success && advancesRes.response?.data) {
                setAdvances(advancesRes.response.data);
            }
            if (paymentsRes.success && paymentsRes.response?.data) {
                setPayments(paymentsRes.response.data);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, []);

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
                setMilkAmount(res.response.milk.totalAmount.toFixed(2));
                setPaidAmount('');
            } else {
                showAlert('Error', res.message || 'Farmer not found');
                setPaymentFarmer(null);
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

    // Set date range from custom range and update upper date display
    const applyCustomRange = (range: DateRange) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        const start = new Date(year, month, range.startDay);
        let end: Date;
        if (range.endDay >= 28) {
            // If end day is 28 or more, use last day of month
            end = new Date(year, month + 1, 0);
        } else {
            end = new Date(year, month, range.endDay);
        }

        const startStr = formatLocalDate(start);
        const endStr = formatLocalDate(end);

        // Check if the range overlaps with existing blocked periods
        const overlapping = getOverlappingPeriodsForRange(startStr, endStr);
        if (overlapping.length > 0) {
            const periodsList = overlapping.map(p => {
                const s = new Date(p.startDate);
                const e = new Date(p.endDate);
                return `${s.getDate()}/${s.getMonth() + 1}/${s.getFullYear()} - ${e.getDate()}/${e.getMonth() + 1}/${e.getFullYear()}`;
            }).join('\n');
            showAlert('Date Conflict', `This date range overlaps with existing payment period(s):\n\n${periodsList}\n\nPlease select a different range.`);
            return;
        }

        setDateStart(startStr);
        setDateEnd(endStr);

        // Also update temp calendar date for visual feedback
        setTempCalendarDate(start);
    };

    // Add new custom range
    const handleAddCustomRange = () => {
        const startDay = parseInt(newRangeStart);
        const endDay = parseInt(newRangeEnd);

        if (isNaN(startDay) || isNaN(endDay) || startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) {
            showAlert('Error', 'Please enter valid day numbers (1-31)');
            return;
        }
        if (startDay > endDay) {
            showAlert('Error', 'Start day must be less than or equal to end day');
            return;
        }

        const newRange: DateRange = {
            id: Date.now().toString(),
            startDay,
            endDay,
            label: `${startDay}-${endDay >= 28 ? 'End' : endDay}`,
        };
        setCustomRanges([...customRanges, newRange]);
        setNewRangeStart('');
        setNewRangeEnd('');
        setShowAddRange(false);
    };

    // Remove custom range
    const handleRemoveRange = (id: string) => {
        setCustomRanges(customRanges.filter(r => r.id !== id));
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
            const milkAmountValue = parseFloat(milkAmount) || 0;
            console.log('Creating payment with period:', { periodStart: dateStart, periodEnd: dateEnd });
            const res = await paymentsApi.create({
                farmerCode: paymentFarmer.farmer.code,
                amount,
                paymentMethod: 'cash',
                totalMilkAmount: milkAmountValue,
                periodStart: dateStart,
                periodEnd: dateEnd,
            });
            console.log('Payment response:', JSON.stringify(res));

            if (res.success) {
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
        showConfirm('Delete Farmer', `Are you sure you want to delete ${name}?`, async () => {
            setConfirmVisible(false);
            const res = await farmersApi.delete(id);
            if (res.success) {
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to delete');
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

    // Generate PDF
    const generateFarmersPDF = async () => {
        const rows = farmers.map(item => `
      <tr>
        <td>${item.code}</td>
        <td>${item.name}</td>
        <td>${item.mobile}</td>
      </tr>
    `).join('');

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
          </style>
        </head>
        <body>
          <h1>Farmers List</h1>
          <table>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Mobile</th>
            </tr>
            ${rows}
          </table>
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

    const styles = createStyles(colors, isDark);

    // Show all farmers (removed search filter)
    const filteredFarmers = farmers;

    // Filter advances by search (name or code)
    const filteredAdvances = advanceSearch
        ? advances.filter(a =>
            a.farmer?.code?.toLowerCase().includes(advanceSearch.toLowerCase()) ||
            a.farmer?.name?.toLowerCase().includes(advanceSearch.toLowerCase())
        )
        : advances;

    // Generate Advances PDF
    const generateAdvancesPDF = async () => {
        const dataToExport = filteredAdvances;
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

    // Calculate closing balance with editable milk amount + previous balance
    const currentMilkAmount = parseFloat(milkAmount) || 0;
    const advanceAmount = paymentFarmer ? paymentFarmer.advances.totalPending : 0;
    const previousBalance = paymentFarmer?.farmer?.currentBalance || 0;
    const netPayable = currentMilkAmount - advanceAmount + previousBalance;
    const closingBalance = netPayable - (parseFloat(paidAmount) || 0);

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
                    style={styles.goBtn}
                    onPress={() => {
                        Keyboard.dismiss();
                        handleFetchFarmerSummary();
                    }}
                    disabled={paymentLoading}
                >
                    <Text style={styles.goBtnText}>{paymentLoading ? '...' : 'Go'}</Text>
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
                            <Text style={[styles.balanceValue, { color: colors.primary }]}>
                                ₹{(paymentFarmer.farmer.currentBalance || 0).toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* Date Range */}
                    <Text style={styles.sectionLabel}>Calculation Period</Text>
                    <View style={styles.dateRow}>
                        <Pressable
                            style={styles.dateInputWrapper}
                            onPress={() => {
                                setDateSelectingType('start');
                                setShowStartDatePicker(true);
                            }}
                        >
                            <Text style={[styles.dateInputText, !dateStart && { color: colors.mutedForeground }]}>
                                {dateStart ? formatDateDDMMYYYY(dateStart) : 'Start Date'}
                            </Text>
                            <CalendarIcon size={16} color={colors.mutedForeground} />
                        </Pressable>
                        <Pressable
                            style={styles.dateInputWrapper}
                            onPress={() => {
                                setDateSelectingType('end');
                                setShowEndDatePicker(true);
                            }}
                        >
                            <Text style={[styles.dateInputText, !dateEnd && { color: colors.mutedForeground }]}>
                                {dateEnd ? formatDateDDMMYYYY(dateEnd) : 'End Date'}
                            </Text>
                            <CalendarIcon size={16} color={colors.mutedForeground} />
                        </Pressable>
                    </View>

                    {/* Start Date Picker Modal with Range Calendar */}
                    <Modal
                        visible={showStartDatePicker}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setShowStartDatePicker(false)}
                    >
                        <View style={styles.dateModalOverlay}>
                            <Pressable style={{ flex: 1 }} onPress={() => setShowStartDatePicker(false)} />
                            <View style={[styles.dateModalContent, { backgroundColor: isDark ? colors.card : '#fff' }]}>
                                <PaymentRangeCalendar
                                    startDate={dateStart}
                                    endDate={dateEnd}
                                    onStartDateSelect={(date) => {
                                        setDateStart(date);
                                        setShowStartDatePicker(false);
                                    }}
                                    onEndDateSelect={(date) => {
                                        setDateEnd(date);
                                    }}
                                    blockedPeriods={blockedPeriods}
                                    selectingType="start"
                                    onClose={() => setShowStartDatePicker(false)}
                                />
                            </View>
                        </View>
                    </Modal>

                    {/* End Date Picker Modal with Range Calendar */}
                    <Modal
                        visible={showEndDatePicker}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setShowEndDatePicker(false)}
                    >
                        <View style={styles.dateModalOverlay}>
                            <Pressable style={{ flex: 1 }} onPress={() => setShowEndDatePicker(false)} />
                            <View style={[styles.dateModalContent, { backgroundColor: isDark ? colors.card : '#fff' }]}>
                                <PaymentRangeCalendar
                                    startDate={dateStart}
                                    endDate={dateEnd}
                                    onStartDateSelect={(date) => {
                                        setDateStart(date);
                                    }}
                                    onEndDateSelect={(date) => {
                                        setDateEnd(date);
                                        setShowEndDatePicker(false);
                                    }}
                                    blockedPeriods={blockedPeriods}
                                    selectingType="end"
                                    onClose={() => setShowEndDatePicker(false)}
                                />
                            </View>
                        </View>
                    </Modal>

                    {/* Custom date ranges */}
                    <Text style={styles.sectionLabel}>Date Ranges</Text>
                    <View style={styles.rangesContainer}>
                        {customRanges.map((range) => (
                            <View key={range.id} style={styles.rangeChip}>
                                <Pressable
                                    style={styles.rangeChipBtn}
                                    onPress={() => applyCustomRange(range)}
                                >
                                    <Text style={styles.rangeChipText}>{range.label}</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.rangeDeleteBtn}
                                    onPress={() => handleRemoveRange(range.id)}
                                >
                                    <Trash2 size={12} color={colors.destructive} />
                                </Pressable>
                            </View>
                        ))}

                        {showAddRange ? (
                            <View style={styles.addRangeForm}>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="Start"
                                    value={newRangeStart}
                                    onChangeText={setNewRangeStart}
                                    keyboardType="numeric"
                                    placeholderTextColor={colors.mutedForeground}
                                />
                                <Text style={styles.rangeDash}>-</Text>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="End"
                                    value={newRangeEnd}
                                    onChangeText={setNewRangeEnd}
                                    keyboardType="numeric"
                                    placeholderTextColor={colors.mutedForeground}
                                />
                                <Pressable style={styles.rangeAddConfirmBtn} onPress={handleAddCustomRange}>
                                    <Text style={styles.rangeAddConfirmText}>Add</Text>
                                </Pressable>
                                <Pressable style={styles.rangeCancelBtn} onPress={() => setShowAddRange(false)}>
                                    <Text style={styles.rangeCancelText}>✕</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable style={styles.addRangeBtn} onPress={() => setShowAddRange(true)}>
                                <Plus size={14} color={colors.primary} />
                                <Text style={styles.addRangeText}>Add Range</Text>
                            </Pressable>
                        )}
                    </View>

                    {/* Summary card */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Milk Amount:</Text>
                            <TextInput
                                style={styles.milkAmountInput}
                                value={milkAmount}
                                onChangeText={setMilkAmount}
                                onFocus={() => {
                                    // Clear if value is 0.00 or 0
                                    if (milkAmount === '0.00' || milkAmount === '0') {
                                        setMilkAmount('');
                                    }
                                }}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor={colors.mutedForeground}
                            />
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

                    {/* Paid Amount Input */}
                    <Text style={styles.sectionLabel}>Paid Amount</Text>
                    <TextInput
                        style={styles.paidInput}
                        placeholder="Enter Paid Amount"
                        value={paidAmount}
                        onChangeText={setPaidAmount}
                        keyboardType="numeric"
                        placeholderTextColor={colors.mutedForeground}
                    />

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
                            <Text style={styles.saveSettlementText}>
                                {savingPayment ? 'Saving...' : 'SAVE SETTLEMENT'}
                            </Text>
                        </Pressable>
                    </View>
                    <Pressable style={styles.clearPaymentBtn} onPress={clearPaymentForm}>
                        <Text style={styles.clearPaymentText}>Clear</Text>
                    </Pressable>
                </>
            )}

            {/* Settlement History - Show filtered by farmer code when searched */}
            <Text style={[styles.subTitle, { marginTop: 16 }]}>
                Settlement History {paymentFarmer ? `(${paymentFarmer.farmer.code})` : ''}
            </Text>
            {(() => {
                // Filter payments by farmer code if a farmer is selected
                const filteredPayments = paymentFarmer
                    ? payments.filter(p => p.farmer?.code === paymentFarmer.farmer.code)
                    : payments;

                if (filteredPayments.length === 0) {
                    return (
                        <Text style={styles.infoTextMuted}>
                            {paymentFarmer ? `No settlements for ${paymentFarmer.farmer.name}` : 'No settlements yet'}
                        </Text>
                    );
                }

                // When farmer is searched - show card format
                if (paymentFarmer) {
                    return (
                        <View style={{ gap: 8 }}>
                            {filteredPayments.slice(0, 10).map((p) => (
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
                                        <Pressable
                                            style={styles.editPaymentBtn}
                                            onPress={() => handleEditPayment(p)}
                                        >
                                            <Edit2 size={14} color={colors.primary} />
                                        </Pressable>
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
                        </View>
                    );
                }

                // Without search - show table format
                return (
                    <View style={styles.historyTable}>
                        <View style={styles.historyTableHeader}>
                            <Text style={[styles.historyTableHeaderCell, { flex: 0.6 }]}>Code</Text>
                            <Text style={[styles.historyTableHeaderCell, { flex: 1 }]}>Date</Text>
                            <Text style={[styles.historyTableHeaderCell, { flex: 0.9 }]}>Milk</Text>
                            <Text style={[styles.historyTableHeaderCell, { flex: 0.7 }]}>Adv</Text>
                            <Text style={[styles.historyTableHeaderCell, { flex: 0.8 }]}>Paid</Text>
                            <Text style={[styles.historyTableHeaderCell, { flex: 0.8 }]}>Bal</Text>
                        </View>
                        {filteredPayments.slice(0, 15).map((p) => (
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
                            </View>
                        ))}
                    </View>
                );
            })()}
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

            {/* Search bar and PDF button */}
            <View style={styles.advanceSearchRow}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10 }}>
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={[styles.advanceSearchInput, { borderWidth: 0, backgroundColor: 'transparent', marginLeft: 8 }]}
                        placeholder="Search by name or code"
                        value={advanceSearch}
                        onChangeText={setAdvanceSearch}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <Pressable style={styles.advancePdfBtn} onPress={generateAdvancesPDF}>
                    <FileText size={14} color={colors.white} />
                    <Text style={styles.advancePdfBtnText}>PDF</Text>
                </Pressable>
            </View>

            {/* Advances Table */}
            {filteredAdvances.length > 0 ? (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Note</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Amt</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Date</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Del</Text>
                    </View>
                    {filteredAdvances.map((item) => {
                        // Only show cross-line for advances that are settled or partial (used in payments)
                        const isUsedInPayment = item.status === 'settled' || item.status === 'partial';
                        return (
                            <View key={item._id} style={[styles.tableRow, isUsedInPayment && styles.settledRow]}>
                                <Text style={[styles.tableCell, { flex: 0.5, color: colors.primary, textAlign: 'center' }]}>{item.farmer?.code}</Text>
                                <Text style={[styles.tableCell, { flex: 1.3, textAlign: 'center' }]}>{item.farmer?.name || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'center' }]}>{item.note || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'center' }, isUsedInPayment ? styles.settledAmountText : { color: colors.warning }]}>₹{item.amount}</Text>
                                <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'center' }]}>
                                    {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </Text>
                                <View style={{ flex: 0.5, alignItems: 'center', justifyContent: 'center' }}>
                                    <Pressable
                                        style={styles.deleteBtn}
                                        onPress={() => handleDeleteAdvance(item._id, item.farmer?.name || 'Unknown')}
                                    >
                                        <Trash2 size={14} color={colors.destructive} />
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })}
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
                        placeholder="Search by code, name, mobile, address..."
                        placeholderTextColor={colors.mutedForeground}
                        value={farmerTabSearch}
                        onChangeText={setFarmerTabSearch}
                    />
                    {farmerSearchLoading && (
                        <ActivityIndicator size="small" color={colors.primary} />
                    )}
                </View>
                <View style={styles.farmerHeaderBtns}>
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
            <Text style={[styles.sectionTitle, { marginTop: 4, fontSize: 13 }]}>Farmers List ({farmers.length})</Text>

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
                    {farmers.map((item) => (
                        <View key={item._id} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 0.5, color: colors.primary, textAlign: 'center' }]}>{item.code}</Text>
                            <Text style={[styles.tableCell, { flex: 1.3, textAlign: 'center' }]}>{item.name}</Text>
                            <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>{item.mobile}</Text>
                            <View style={{ flex: 0.7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <Pressable style={styles.editBtn} onPress={() => handleEditFarmer(item)}>
                                    <Edit2 size={14} color={colors.primary} />
                                </Pressable>
                                <Pressable style={styles.deleteBtn} onPress={() => handleDeleteFarmer(item._id, item.name)}>
                                    <Trash2 size={14} color={colors.destructive} />
                                </Pressable>
                            </View>
                        </View>
                    ))}
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

            {/* Tabs */}
            <View style={styles.tabRow}>
                {(['Payments', 'Advances', 'Farmers'] as TabType[]).map((tab) => (
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
            >
                {activeTab === 'Payments' && renderPaymentsTab()}
                {activeTab === 'Advances' && renderAdvancesTab()}
                {activeTab === 'Farmers' && renderFarmersTab()}
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
                onRequestClose={closeEditPaymentModal}
            >
                <View style={styles.dateModalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={closeEditPaymentModal} />
                    <View style={[styles.editPaymentModalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.editPaymentModalHeader}>
                            <Text style={[styles.editPaymentModalTitle, { color: colors.foreground }]}>Edit Payment</Text>
                            <Pressable onPress={closeEditPaymentModal} style={styles.dateModalClose}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        {editingPayment && (
                            <ScrollView style={styles.editPaymentModalBody} showsVerticalScrollIndicator={false}>
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
                </View>
            </Modal>
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
        marginBottom: 12,
        marginTop: 4,
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
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
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
    },
    tabTextActive: {
        color: colors.white,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 6,
        paddingBottom: 80,
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
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
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
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        color: colors.foreground,
    },
    goBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 6,
        justifyContent: 'center',
    },
    goBtnText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
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
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
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
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
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
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
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
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
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
});
