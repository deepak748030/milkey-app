import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Calendar, Search, Trash2, FileText, Printer, Edit2, DollarSign, User, Download, Calculator } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import DatePickerModal from '@/components/DatePickerModal';
import { farmersApi, milkCollectionsApi, paymentsApi, rateChartsApi, MilkCollection, Farmer, Payment } from '@/lib/milkeyApi';
import { getAuthToken } from '@/lib/authStore';
import { exportMembers, exportMilkCollections, exportPayments } from '@/lib/csvExport';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type TabType = 'Entry' | 'Payment' | 'Reports' | 'Member';

export default function SellingScreen() {
    const { colors, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<TabType>('Entry');
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Date picker state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerTarget, setDatePickerTarget] = useState<'entry' | 'reportStart' | 'reportEnd'>('entry');

    // Entry state
    const [searchMember, setSearchMember] = useState('');
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [quantity, setQuantity] = useState('');
    const [rate, setRate] = useState('50');
    const [fat, setFat] = useState('');
    const [snf, setSnf] = useState('');
    const [shift, setShift] = useState<'morning' | 'evening'>(new Date().getHours() < 12 ? 'morning' : 'evening');
    const [recentEntries, setRecentEntries] = useState<MilkCollection[]>([]);

    // Payment state
    const [selectedPaymentFarmer, setSelectedPaymentFarmer] = useState<Farmer | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank'>('cash');
    const [farmerSummary, setFarmerSummary] = useState<any>(null);
    const [recentPayments, setRecentPayments] = useState<Payment[]>([]);

    // Reports state
    const [reportStartDate, setReportStartDate] = useState(getDateOffset(-7));
    const [reportEndDate, setReportEndDate] = useState(getDateOffset(0));

    // Member state
    const [members, setMembers] = useState<Farmer[]>([]);
    const [memberCode, setMemberCode] = useState('');
    const [memberName, setMemberName] = useState('');
    const [memberMobile, setMemberMobile] = useState('');
    const [memberAddress, setMemberAddress] = useState('');
    const [editingMember, setEditingMember] = useState<Farmer | null>(null);

    // Helper function for date offset
    function getDateOffset(days: number) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    }

    // Filtered members for search
    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
        m.code.toLowerCase().includes(searchMember.toLowerCase())
    );

    const totalAmount = (parseFloat(quantity) || 0) * (parseFloat(rate) || 0);

    // Fetch data
    const fetchData = useCallback(async () => {
        const token = await getAuthToken();
        if (!token) return;

        try {
            setIsLoading(true);
            const [farmersRes, collectionsRes, paymentsRes] = await Promise.all([
                farmersApi.getAll(),
                milkCollectionsApi.getAll({ limit: 20 }),
                paymentsApi.getAll({ limit: 10 })
            ]);

            if (farmersRes.success) {
                setMembers(farmersRes.response?.data || []);
            }
            if (collectionsRes.success) {
                setRecentEntries(collectionsRes.response?.data || []);
            }
            if (paymentsRes.success) {
                setRecentPayments(paymentsRes.response?.data || []);
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

    // Calculate rate based on FAT and SNF
    const handleCalculateRate = async () => {
        if (!fat || !snf) {
            Alert.alert('Info', 'Enter FAT and SNF values to calculate rate');
            return;
        }
        try {
            const res = await rateChartsApi.calculate(parseFloat(fat), parseFloat(snf));
            if (res.success && res.response) {
                setRate(res.response.rate.toFixed(2));
                Alert.alert('Rate Calculated', `Rate: ₹${res.response.rate.toFixed(2)}/L based on FAT ${fat}% and SNF ${snf}%`);
            } else {
                Alert.alert('Error', 'No rate chart configured. Using default rate.');
            }
        } catch (error) {
            console.error('Rate calculation error:', error);
        }
    };

    // Save milk entry
    const handleSaveEntry = async () => {
        if (!selectedFarmer) {
            Alert.alert('Error', 'Please select a member first');
            return;
        }

        const qty = parseFloat(quantity) || 0;
        if (qty <= 0) {
            Alert.alert('Error', 'Please enter valid quantity');
            return;
        }

        try {
            setIsLoading(true);
            const res = await milkCollectionsApi.create({
                farmerCode: selectedFarmer.code,
                quantity: qty,
                rate: parseFloat(rate) || 50,
                shift,
                date: entryDate,
                fat: fat ? parseFloat(fat) : undefined,
                snf: snf ? parseFloat(snf) : undefined,
            });

            if (res.success) {
                Alert.alert('Success', 'Entry saved successfully');
                setQuantity('');
                setFat('');
                setSnf('');
                setSelectedFarmer(null);
                setSearchMember('');
                fetchData();
            } else {
                Alert.alert('Error', res.message || 'Failed to save entry');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to save entry');
        } finally {
            setIsLoading(false);
        }
    };

    // Delete entry
    const handleDeleteEntry = async (id: string) => {
        Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const res = await milkCollectionsApi.delete(id);
                        if (res.success) {
                            fetchData();
                        } else {
                            Alert.alert('Error', 'Failed to delete entry');
                        }
                    } catch (error) {
                        Alert.alert('Error', 'Failed to delete entry');
                    }
                }
            }
        ]);
    };

    // Fetch farmer summary for payment
    const handleSelectPaymentFarmer = async (farmer: Farmer) => {
        setSelectedPaymentFarmer(farmer);
        try {
            const res = await paymentsApi.getFarmerSummary(farmer.code);
            if (res.success) {
                setFarmerSummary(res.response);
                setPaymentAmount(res.response?.totalDue?.toString() || res.response?.netPayable?.toString() || '0');
            }
        } catch (error) {
            console.error('Fetch summary error:', error);
        }
    };

    // Process payment
    const handleProcessPayment = async () => {
        if (!selectedPaymentFarmer) {
            Alert.alert('Error', 'Please select a member first');
            return;
        }

        const amount = parseFloat(paymentAmount) || 0;
        if (amount <= 0) {
            Alert.alert('Error', 'Please enter valid amount');
            return;
        }

        try {
            setIsLoading(true);
            const res = await paymentsApi.create({
                farmerCode: selectedPaymentFarmer.code,
                amount,
                paymentMethod,
                notes: `Payment via ${paymentMethod}`
            });

            if (res.success) {
                Alert.alert('Success', 'Payment processed successfully');
                setPaymentAmount('');
                setSelectedPaymentFarmer(null);
                setFarmerSummary(null);
                fetchData();
            } else {
                Alert.alert('Error', res.message || 'Failed to process payment');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to process payment');
        } finally {
            setIsLoading(false);
        }
    };

    // Save member
    const handleSaveMember = async () => {
        if (!memberCode || !memberName || !memberMobile) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        try {
            setIsLoading(true);

            if (editingMember) {
                const res = await farmersApi.update(editingMember._id, {
                    name: memberName,
                    mobile: memberMobile,
                    address: memberAddress
                });
                if (res.success) {
                    Alert.alert('Success', 'Member updated successfully');
                    clearMemberForm();
                    fetchData();
                } else {
                    Alert.alert('Error', res.message || 'Failed to update member');
                }
            } else {
                const res = await farmersApi.create({
                    code: memberCode,
                    name: memberName,
                    mobile: memberMobile,
                    address: memberAddress
                });
                if (res.success) {
                    Alert.alert('Success', 'Member added successfully');
                    clearMemberForm();
                    fetchData();
                } else {
                    Alert.alert('Error', res.message || 'Failed to add member');
                }
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to save member');
        } finally {
            setIsLoading(false);
        }
    };

    const clearMemberForm = () => {
        setMemberCode('');
        setMemberName('');
        setMemberMobile('');
        setMemberAddress('');
        setEditingMember(null);
    };

    const handleEditMember = (member: Farmer) => {
        setEditingMember(member);
        setMemberCode(member.code);
        setMemberName(member.name);
        setMemberMobile(member.mobile);
        setMemberAddress(member.address || '');
    };

    const handleDeleteMember = async (id: string) => {
        Alert.alert('Delete Member', 'Are you sure you want to delete this member?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const res = await farmersApi.delete(id);
                        if (res.success) {
                            fetchData();
                        } else {
                            Alert.alert('Error', 'Failed to delete member');
                        }
                    } catch (error) {
                        Alert.alert('Error', 'Failed to delete member');
                    }
                }
            }
        ]);
    };

    // Date picker handler
    const handleDateSelect = (date: string) => {
        if (datePickerTarget === 'entry') {
            setEntryDate(date);
        } else if (datePickerTarget === 'reportStart') {
            setReportStartDate(date);
        } else {
            setReportEndDate(date);
        }
    };

    const openDatePicker = (target: 'entry' | 'reportStart' | 'reportEnd') => {
        setDatePickerTarget(target);
        setShowDatePicker(true);
    };

    // Filter entries by date range for reports
    const getFilteredEntries = () => {
        return recentEntries.filter(entry => {
            const entryDate = new Date(entry.date).toISOString().split('T')[0];
            return entryDate >= reportStartDate && entryDate <= reportEndDate;
        });
    };

    const getFilteredPayments = () => {
        return recentPayments.filter(payment => {
            const paymentDate = new Date(payment.date || payment.createdAt || '').toISOString().split('T')[0];
            return paymentDate >= reportStartDate && paymentDate <= reportEndDate;
        });
    };

    // Generate PDF Report
    const generateReportHTML = () => {
        const filteredEntries = getFilteredEntries();
        const rows = filteredEntries.map(item => `
          <tr>
            <td>${new Date(item.date).toLocaleDateString()}</td>
            <td>${(item.farmer as any)?.name || item.farmerCode}</td>
            <td>${item.shift}</td>
            <td>${item.quantity} L</td>
            <td>${item.fat || '-'}%</td>
            <td>${item.snf || '-'}%</td>
            <td>₹${item.rate}</td>
            <td>₹${item.amount}</td>
          </tr>
        `).join('');

        const totalQty = filteredEntries.reduce((sum, e) => sum + e.quantity, 0);
        const totalAmt = filteredEntries.reduce((sum, e) => sum + e.amount, 0);

        return `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #22C55E; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 12px; }
                th { background-color: #22C55E; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
                .summary { margin-top: 20px; font-weight: bold; background: #f5f5f5; padding: 15px; border-radius: 8px; }
              </style>
            </head>
            <body>
              <h1>Milk Selling Report</h1>
              <p>Period: ${reportStartDate} to ${reportEndDate}</p>
              <p>Generated on: ${new Date().toLocaleDateString()}</p>
              <table>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Shift</th>
                  <th>Qty</th>
                  <th>FAT</th>
                  <th>SNF</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
                ${rows}
              </table>
              <div class="summary">
                <p>Total Entries: ${filteredEntries.length}</p>
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
                Alert.alert('PDF Generated', `Saved to: ${uri}`);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to generate PDF');
        }
    };

    const handlePrint = async () => {
        try {
            const html = generateReportHTML();
            await Print.printAsync({ html });
        } catch (error) {
            Alert.alert('Error', 'Failed to print');
        }
    };

    // Export handlers
    const handleExportMembers = async () => {
        setIsLoading(true);
        await exportMembers(members);
        setIsLoading(false);
    };

    const handleExportCollections = async () => {
        setIsLoading(true);
        await exportMilkCollections(getFilteredEntries());
        setIsLoading(false);
    };

    const handleExportPayments = async () => {
        setIsLoading(true);
        await exportPayments(getFilteredPayments());
        setIsLoading(false);
    };

    const styles = createStyles(colors, isDark);

    const renderMemberDropdown = () => {
        if (!searchMember || selectedFarmer) return null;

        return (
            <View style={styles.dropdown}>
                {filteredMembers.slice(0, 5).map(member => (
                    <Pressable
                        key={member._id}
                        style={styles.dropdownItem}
                        onPress={() => {
                            setSelectedFarmer(member);
                            setSearchMember(member.name);
                            setRate(member.rate?.toString() || '50');
                        }}
                    >
                        <Text style={styles.dropdownText}>{member.code} - {member.name}</Text>
                    </Pressable>
                ))}
                {filteredMembers.length === 0 && (
                    <Text style={styles.dropdownEmpty}>No members found</Text>
                )}
            </View>
        );
    };

    const renderEntryTab = () => (
        <View>
            <Text style={styles.sectionTitle}>Milk Selling Entry</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Member (Customer) *</Text>
                <View style={styles.searchInput}>
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={styles.searchTextInput}
                        placeholder="Search by name or code..."
                        value={searchMember}
                        onChangeText={(text) => {
                            setSearchMember(text);
                            if (selectedFarmer) setSelectedFarmer(null);
                        }}
                        placeholderTextColor={colors.mutedForeground}
                    />
                    {selectedFarmer && (
                        <Pressable onPress={() => { setSelectedFarmer(null); setSearchMember(''); }}>
                            <Trash2 size={14} color={colors.destructive} />
                        </Pressable>
                    )}
                </View>
                {renderMemberDropdown()}
            </View>

            <View style={styles.shiftRow}>
                <Pressable
                    style={[styles.shiftBtn, shift === 'morning' && styles.shiftBtnActive]}
                    onPress={() => setShift('morning')}
                >
                    <Text style={[styles.shiftText, shift === 'morning' && styles.shiftTextActive]}>☀️ Morning</Text>
                </Pressable>
                <Pressable
                    style={[styles.shiftBtn, shift === 'evening' && styles.shiftBtnActive]}
                    onPress={() => setShift('evening')}
                >
                    <Text style={[styles.shiftText, shift === 'evening' && styles.shiftTextActive]}>🌙 Evening</Text>
                </Pressable>
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date</Text>
                    <Pressable style={styles.dateInput} onPress={() => openDatePicker('entry')}>
                        <Text style={styles.dateText}>{entryDate}</Text>
                        <Calendar size={16} color={colors.mutedForeground} />
                    </Pressable>
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Quantity (L) *</Text>
                    <TextInput
                        style={styles.input}
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            {/* FAT and SNF inputs */}
            <View style={styles.qualityCard}>
                <Text style={styles.qualityTitle}>Milk Quality (Optional)</Text>
                <View style={styles.row}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>FAT %</Text>
                        <TextInput
                            style={styles.input}
                            value={fat}
                            onChangeText={setFat}
                            keyboardType="decimal-pad"
                            placeholder="3.5"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>SNF %</Text>
                        <TextInput
                            style={styles.input}
                            value={snf}
                            onChangeText={setSnf}
                            keyboardType="decimal-pad"
                            placeholder="8.5"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                    <Pressable style={styles.calcBtn} onPress={handleCalculateRate}>
                        <Calculator size={16} color={colors.white} />
                    </Pressable>
                </View>
                <View style={styles.rateRow}>
                    <Text style={styles.label}>Rate (₹/L)</Text>
                    <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={rate}
                        onChangeText={setRate}
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            <View style={styles.totalRow}>
                <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>Total (₹)</Text>
                    <Text style={styles.totalValue}>{totalAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.buttonRow}>
                    <Pressable style={styles.saveBtn} onPress={handleSaveEntry} disabled={isLoading}>
                        {isLoading ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Entry</Text>
                        )}
                    </Pressable>
                    <Pressable style={styles.clearBtn} onPress={() => {
                        setQuantity('');
                        setFat('');
                        setSnf('');
                        setSelectedFarmer(null);
                        setSearchMember('');
                    }}>
                        <Text style={styles.clearBtnText}>Clear</Text>
                    </Pressable>
                </View>
            </View>

            <View style={styles.entriesHeader}>
                <Text style={styles.sectionTitle}>Recent Entries</Text>
                <Text style={styles.lastCount}>(Last 20)</Text>
            </View>

            {recentEntries.length === 0 ? (
                <Text style={styles.emptyText}>No entries yet</Text>
            ) : (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Date</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Qty</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>FAT</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Amt</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.3 }]}></Text>
                    </View>
                    {recentEntries.map((item) => (
                        <View key={item._id} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 0.8 }]}>{new Date(item.date).toLocaleDateString()}</Text>
                            <Text style={[styles.tableCell, { flex: 1 }]}>{(item.farmer as any)?.name || item.farmerCode}</Text>
                            <Text style={[styles.tableCell, { flex: 0.5 }]}>{item.quantity}L</Text>
                            <Text style={[styles.tableCell, { flex: 0.5 }]}>{item.fat || '-'}</Text>
                            <Text style={[styles.tableCell, { flex: 0.6, color: colors.primary }]}>₹{item.amount}</Text>
                            <View style={{ flex: 0.3, alignItems: 'center' }}>
                                <Pressable style={styles.deleteBtn} onPress={() => handleDeleteEntry(item._id)}>
                                    <Trash2 size={12} color={colors.destructive} />
                                </Pressable>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );

    const renderPaymentTab = () => (
        <View>
            <Text style={styles.sectionTitle}>Payment Management</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Select Member</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberChips}>
                    {members.slice(0, 10).map(member => (
                        <Pressable
                            key={member._id}
                            style={[
                                styles.memberChip,
                                selectedPaymentFarmer?._id === member._id && styles.memberChipActive
                            ]}
                            onPress={() => handleSelectPaymentFarmer(member)}
                        >
                            <User size={12} color={selectedPaymentFarmer?._id === member._id ? colors.white : colors.foreground} />
                            <Text style={[
                                styles.memberChipText,
                                selectedPaymentFarmer?._id === member._id && styles.memberChipTextActive
                            ]}>{member.name}</Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            {selectedPaymentFarmer && farmerSummary && (
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>{selectedPaymentFarmer.name}</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total Milk:</Text>
                        <Text style={styles.summaryValue}>{farmerSummary.totalQuantity || farmerSummary.milk?.totalQuantity || 0} L</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Milk Amount:</Text>
                        <Text style={styles.summaryValue}>₹{farmerSummary.totalMilkAmount || farmerSummary.milk?.totalAmount || 0}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Advances:</Text>
                        <Text style={[styles.summaryValue, { color: colors.destructive }]}>-₹{farmerSummary.totalAdvances || farmerSummary.advances?.totalPending || 0}</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.summaryTotal]}>
                        <Text style={styles.summaryTotalLabel}>Net Payable:</Text>
                        <Text style={styles.summaryTotalValue}>₹{farmerSummary.totalDue || farmerSummary.netPayable || 0}</Text>
                    </View>
                </View>
            )}

            {selectedPaymentFarmer && (
                <>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Payment Amount (₹)</Text>
                        <TextInput
                            style={styles.input}
                            value={paymentAmount}
                            onChangeText={setPaymentAmount}
                            keyboardType="decimal-pad"
                            placeholder="Enter amount"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Payment Method</Text>
                        <View style={styles.methodRow}>
                            {(['cash', 'upi', 'bank'] as const).map(method => (
                                <Pressable
                                    key={method}
                                    style={[styles.methodBtn, paymentMethod === method && styles.methodBtnActive]}
                                    onPress={() => setPaymentMethod(method)}
                                >
                                    <DollarSign size={14} color={paymentMethod === method ? colors.white : colors.foreground} />
                                    <Text style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}>
                                        {method.toUpperCase()}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    <Pressable style={styles.payBtn} onPress={handleProcessPayment} disabled={isLoading}>
                        {isLoading ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <Text style={styles.payBtnText}>Process Payment</Text>
                        )}
                    </Pressable>
                </>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Recent Payments</Text>
            {recentPayments.length === 0 ? (
                <Text style={styles.emptyText}>No payments yet</Text>
            ) : (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Amount</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Method</Text>
                    </View>
                    {recentPayments.map((item) => (
                        <View key={item._id} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 1 }]}>{new Date(item.createdAt || item.date).toLocaleDateString()}</Text>
                            <Text style={[styles.tableCell, { flex: 1 }]}>{(item.farmer as any)?.name || '-'}</Text>
                            <Text style={[styles.tableCell, { flex: 0.8, color: colors.primary }]}>₹{item.amount}</Text>
                            <Text style={[styles.tableCell, { flex: 0.6 }]}>{item.paymentMethod}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );

    const renderReportsTab = () => {
        const filteredEntries = getFilteredEntries();
        const filteredPaymentsData = getFilteredPayments();
        const totalQty = filteredEntries.reduce((s, e) => s + e.quantity, 0);
        const totalAmt = filteredEntries.reduce((s, e) => s + e.amount, 0);
        const totalPaymentsAmt = filteredPaymentsData.reduce((s, p) => s + p.amount, 0);

        return (
            <View>
                <Text style={styles.sectionTitle}>Reports</Text>

                {/* Date Range Filter */}
                <View style={styles.filterCard}>
                    <Text style={styles.filterTitle}>Date Range Filter</Text>
                    <View style={styles.dateFilterRow}>
                        <Pressable style={styles.dateFilterBtn} onPress={() => openDatePicker('reportStart')}>
                            <Calendar size={14} color={colors.primary} />
                            <Text style={styles.dateFilterText}>{reportStartDate}</Text>
                        </Pressable>
                        <Text style={styles.dateFilterSeparator}>to</Text>
                        <Pressable style={styles.dateFilterBtn} onPress={() => openDatePicker('reportEnd')}>
                            <Calendar size={14} color={colors.primary} />
                            <Text style={styles.dateFilterText}>{reportEndDate}</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.reportSummary}>
                    <View style={styles.reportCard}>
                        <Text style={styles.reportCardLabel}>Entries</Text>
                        <Text style={styles.reportCardValue}>{filteredEntries.length}</Text>
                    </View>
                    <View style={styles.reportCard}>
                        <Text style={styles.reportCardLabel}>Quantity</Text>
                        <Text style={styles.reportCardValue}>{totalQty.toFixed(1)} L</Text>
                    </View>
                    <View style={styles.reportCard}>
                        <Text style={styles.reportCardLabel}>Amount</Text>
                        <Text style={styles.reportCardValue}>₹{totalAmt.toFixed(0)}</Text>
                    </View>
                </View>

                <View style={styles.reportSummary}>
                    <View style={styles.reportCard}>
                        <Text style={styles.reportCardLabel}>Payments</Text>
                        <Text style={styles.reportCardValue}>{filteredPaymentsData.length}</Text>
                    </View>
                    <View style={[styles.reportCard, { flex: 2 }]}>
                        <Text style={styles.reportCardLabel}>Total Paid</Text>
                        <Text style={[styles.reportCardValue, { color: colors.success }]}>₹{totalPaymentsAmt.toFixed(0)}</Text>
                    </View>
                </View>

                <View style={styles.exportBtnsRow}>
                    <Pressable style={styles.pdfBtn} onPress={handlePDF}>
                        <FileText size={14} color={colors.white} />
                        <Text style={styles.exportText}>PDF</Text>
                    </Pressable>
                    <Pressable style={styles.printBtn} onPress={handlePrint}>
                        <Printer size={14} color={colors.white} />
                        <Text style={styles.exportText}>Print</Text>
                    </Pressable>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Export as CSV</Text>
                <View style={styles.exportBtnsRow}>
                    <Pressable style={styles.csvBtn} onPress={handleExportCollections}>
                        <Download size={14} color={colors.primary} />
                        <Text style={styles.csvBtnText}>Collections</Text>
                    </Pressable>
                    <Pressable style={styles.csvBtn} onPress={handleExportPayments}>
                        <Download size={14} color={colors.primary} />
                        <Text style={styles.csvBtnText}>Payments</Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    const renderMemberTab = () => (
        <View>
            <View style={styles.memberHeader}>
                <Text style={styles.sectionTitle}>{editingMember ? 'Edit Member' : 'Add Member'}</Text>
                <Pressable style={styles.exportMemberBtn} onPress={handleExportMembers}>
                    <Download size={14} color={colors.primary} />
                    <Text style={styles.exportMemberText}>Export</Text>
                </Pressable>
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Code *</Text>
                    <TextInput
                        style={[styles.input, editingMember && styles.inputDisabled]}
                        placeholder="F001"
                        value={memberCode}
                        onChangeText={setMemberCode}
                        editable={!editingMember}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={[styles.inputGroup, { flex: 2 }]}>
                    <Text style={styles.label}>Name *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Member Name"
                        value={memberName}
                        onChangeText={setMemberName}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Mobile *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="9876543210"
                        value={memberMobile}
                        onChangeText={setMemberMobile}
                        keyboardType="phone-pad"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Address</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Village/City"
                        value={memberAddress}
                        onChangeText={setMemberAddress}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            <View style={styles.buttonRow}>
                <Pressable style={styles.saveBtn} onPress={handleSaveMember} disabled={isLoading}>
                    {isLoading ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <Text style={styles.saveBtnText}>{editingMember ? 'Update Member' : 'Save Member'}</Text>
                    )}
                </Pressable>
                <Pressable style={styles.clearBtn} onPress={clearMemberForm}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Members List ({members.length})</Text>

            {members.length === 0 ? (
                <Text style={styles.emptyText}>No members yet. Add your first member above.</Text>
            ) : (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Mobile</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Actions</Text>
                    </View>
                    {members.map((item) => (
                        <View key={item._id} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 0.5 }]}>{item.code}</Text>
                            <Text style={[styles.tableCell, { flex: 1, textAlign: 'left' }]}>{item.name}</Text>
                            <Text style={[styles.tableCell, { flex: 1 }]}>{item.mobile}</Text>
                            <View style={{ flex: 0.6, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
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

    return (
        <View style={styles.container}>
            <TopBar />
            {/* Tabs */}
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

            {/* Date Picker Modal */}
            <DatePickerModal
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                onSelect={handleDateSelect}
                selectedDate={datePickerTarget === 'entry' ? entryDate : datePickerTarget === 'reportStart' ? reportStartDate : reportEndDate}
                title={datePickerTarget === 'entry' ? 'Select Entry Date' : datePickerTarget === 'reportStart' ? 'Select Start Date' : 'Select End Date'}
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
        gap: 4,
        marginTop: 6,
        marginBottom: 12,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tabActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    tabText: {
        fontSize: 12,
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
        paddingHorizontal: 10,
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
        maxHeight: 150,
    },
    dropdownItem: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    dropdownText: {
        fontSize: 14,
        color: colors.foreground,
    },
    dropdownEmpty: {
        padding: 12,
        fontSize: 13,
        color: colors.mutedForeground,
        textAlign: 'center',
    },
    shiftRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    shiftBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 6,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
    },
    shiftBtnActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    shiftText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
    },
    shiftTextActive: {
        color: colors.white,
    },
    qualityCard: {
        backgroundColor: colors.card,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    qualityTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 10,
    },
    calcBtn: {
        backgroundColor: colors.primary,
        borderRadius: 6,
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'flex-end',
    },
    rateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
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
    totalLabel: {
        fontSize: 11,
        color: colors.mutedForeground,
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
        marginBottom: 10,
    },
    exportMemberBtn: {
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
    exportMemberText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.primary,
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
});
