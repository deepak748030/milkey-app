import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Modal, Keyboard } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Calendar as CalendarIcon, FileText, Trash2, Plus, Search, X, Edit2 } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { farmersApi, advancesApi, paymentsApi, Farmer, Advance, Payment, FarmerPaymentSummary } from '@/lib/milkeyApi';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Calendar } from '@/components/Calendar';

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
    const [activeTab, setActiveTab] = useState<TabType>('Farmers');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

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

    // Temp calendar date for confirmation
    const [tempCalendarDate, setTempCalendarDate] = useState<Date | null>(null);

    // Modal state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmData, setConfirmData] = useState<{ title: string; message: string; onConfirm: () => void }>({ title: '', message: '', onConfirm: () => { } });

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

    const fetchData = async () => {
        setLoading(true);
        try {
            const [farmersRes, advancesRes, paymentsRes] = await Promise.all([
                farmersApi.getAll(),
                advancesApi.getAll(),
                paymentsApi.getAll({ limit: 20 }),
            ]);

            if (farmersRes.success && farmersRes.response?.data) {
                setFarmers(farmersRes.response.data);
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
        if (!paymentFarmer || !paidAmount) {
            showAlert('Error', 'Please enter paid amount');
            return;
        }

        const amount = parseFloat(paidAmount);
        if (isNaN(amount) || amount <= 0) {
            showAlert('Error', 'Please enter a valid amount');
            return;
        }

        setSavingPayment(true);
        try {
            const milkAmountValue = parseFloat(milkAmount) || 0;
            const res = await paymentsApi.create({
                farmerCode: paymentFarmer.farmer.code,
                amount,
                paymentMethod: 'cash',
                totalMilkAmount: milkAmountValue,
            });

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
    };

    // Edit farmer - populate form with farmer data
    const handleEditFarmer = (farmer: Farmer) => {
        setEditingFarmer(farmer);
        setNewCode(farmer.code);
        setNewName(farmer.name);
        setNewMobile(farmer.mobile);
        setNewAddress(farmer.address || '');
    };

    // Update farmer
    const handleUpdateFarmer = async () => {
        if (!editingFarmer || !newName || !newMobile) {
            showAlert('Error', 'Please fill name and mobile');
            return;
        }

        setLoading(true);
        try {
            const res = await farmersApi.update(editingFarmer._id, {
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
                    keyboardType="default"
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
                                setTempCalendarDate(dateStart ? new Date(dateStart + 'T00:00:00') : new Date());
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
                                setTempCalendarDate(dateEnd ? new Date(dateEnd + 'T00:00:00') : new Date());
                                setShowEndDatePicker(true);
                            }}
                        >
                            <Text style={[styles.dateInputText, !dateEnd && { color: colors.mutedForeground }]}>
                                {dateEnd ? formatDateDDMMYYYY(dateEnd) : 'End Date'}
                            </Text>
                            <CalendarIcon size={16} color={colors.mutedForeground} />
                        </Pressable>
                    </View>

                    {/* Start Date Picker Modal */}
                    <Modal
                        visible={showStartDatePicker}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setShowStartDatePicker(false)}
                    >
                        <View style={styles.dateModalOverlay}>
                            <Pressable style={{ flex: 1 }} onPress={() => setShowStartDatePicker(false)} />
                            <View style={[styles.dateModalContent, { backgroundColor: colors.card }]}>
                                <View style={styles.dateModalHeader}>
                                    <Text style={[styles.dateModalTitle, { color: colors.foreground }]}>Select Start Date</Text>
                                    <Pressable onPress={() => setShowStartDatePicker(false)} style={styles.dateModalClose}>
                                        <X size={20} color={colors.foreground} />
                                    </Pressable>
                                </View>
                                <Calendar
                                    onDateSelect={(date) => {
                                        if (date) {
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            setDateStart(`${year}-${month}-${day}`);
                                            setShowStartDatePicker(false);
                                        }
                                    }}
                                    selectedDate={tempCalendarDate}
                                />
                            </View>
                        </View>
                    </Modal>

                    {/* End Date Picker Modal */}
                    <Modal
                        visible={showEndDatePicker}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setShowEndDatePicker(false)}
                    >
                        <View style={styles.dateModalOverlay}>
                            <Pressable style={{ flex: 1 }} onPress={() => setShowEndDatePicker(false)} />
                            <View style={[styles.dateModalContent, { backgroundColor: colors.card }]}>
                                <View style={styles.dateModalHeader}>
                                    <Text style={[styles.dateModalTitle, { color: colors.foreground }]}>Select End Date</Text>
                                    <Pressable onPress={() => setShowEndDatePicker(false)} style={styles.dateModalClose}>
                                        <X size={20} color={colors.foreground} />
                                    </Pressable>
                                </View>
                                <Calendar
                                    onDateSelect={(date) => {
                                        if (date) {
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            setDateEnd(`${year}-${month}-${day}`);
                                            setShowEndDatePicker(false);
                                        }
                                    }}
                                    selectedDate={tempCalendarDate}
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
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={[styles.historyPeriod, { color: colors.primary, fontWeight: '700' }]}>
                                                {p.farmer?.code || '-'}
                                            </Text>
                                            <Text style={[styles.historyPeriod, { color: colors.foreground }]}>
                                                {p.farmer?.name || '-'}
                                            </Text>
                                        </View>
                                        <Text style={styles.historyDate}>{formatDateDDMMYYYY(p.date)}</Text>
                                    </View>
                                    <View style={[styles.historyRow, { marginBottom: 4 }]}>
                                        <Text style={[styles.historyLabel, { fontSize: 10 }]}>Period:</Text>
                                        <Text style={[styles.historyValue, { fontSize: 10, color: colors.mutedForeground }]}>
                                            {formatDateDDMMYYYY(p.periodStart || p.date)} - {formatDateDDMMYYYY(p.periodEnd || p.date)}
                                        </Text>
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
                                        <Text style={[styles.historyLabel, { fontWeight: '700' }]}>Closing Balance:</Text>
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
                        <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Note</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Amt</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date</Text>
                    </View>
                    {filteredAdvances.map((item) => {
                        // Only show cross-line for advances that are settled or partial (used in payments)
                        const isUsedInPayment = item.status === 'settled' || item.status === 'partial';
                        return (
                            <View key={item._id} style={[styles.tableRow, isUsedInPayment && styles.settledRow]}>
                                <Text style={[styles.tableCell, { flex: 0.5, color: colors.primary, textAlign: 'center' }]}>{item.farmer?.code}</Text>
                                <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'center' }]}>{item.farmer?.name || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>{item.note || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'center' }, isUsedInPayment ? styles.settledAmountText : { color: colors.warning }]}>₹{item.amount}</Text>
                                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
                                    {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </Text>
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
            <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 0.4 }]}>
                    <Text style={styles.label}>Code</Text>
                    <TextInput
                        style={[styles.input, editingFarmer && { backgroundColor: colors.muted }]}
                        placeholder="Code"
                        value={newCode}
                        onChangeText={setNewCode}
                        editable={!editingFarmer}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Name"
                        value={newName}
                        onChangeText={setNewName}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Mobile</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Mobile"
                        value={newMobile}
                        onChangeText={setNewMobile}
                        keyboardType="phone-pad"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Address</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Address"
                        value={newAddress}
                        onChangeText={setNewAddress}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            <View style={styles.buttonRow}>
                <Pressable
                    style={[styles.saveBtn, editingFarmer && { backgroundColor: '#f59e0b' }]}
                    onPress={editingFarmer ? handleUpdateFarmer : handleAddFarmer}
                    disabled={loading}
                >
                    <Text style={styles.saveBtnText}>
                        {loading ? (editingFarmer ? 'Updating...' : 'Adding...') : (editingFarmer ? 'Update Farmer' : 'Add Farmer')}
                    </Text>
                </Pressable>
                <Pressable style={styles.clearBtn} onPress={clearFarmerForm}>
                    <Text style={styles.clearBtnText}>{editingFarmer ? 'Cancel' : 'Clear'}</Text>
                </Pressable>
            </View>

            {/* PDF button only - removed search bar */}
            <View style={styles.pdfRow}>
                <Pressable style={styles.pdfBtn} onPress={generateFarmersPDF}>
                    <FileText size={14} color={colors.white} />
                    <Text style={styles.pdfBtnText}>Download PDF</Text>
                </Pressable>
            </View>

            {/* Farmers Table */}
            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : filteredFarmers.length > 0 ? (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Mobile</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Actions</Text>
                    </View>
                    {filteredFarmers.map((item) => (
                        <View key={item._id} style={[styles.tableRow, editingFarmer?._id === item._id && { backgroundColor: colors.primary + '15' }]}>
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
                <Text style={styles.infoTextMuted}>No farmers found. Add your first farmer above.</Text>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
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
});
