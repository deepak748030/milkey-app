import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Calendar, Search, Trash2, FileText, Printer, Edit2, DollarSign, User, Download, Check, Plus, X } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import DatePickerModal from '@/components/DatePickerModal';
import { farmersApi, milkCollectionsApi, paymentsApi, MilkCollection, Farmer, Payment } from '@/lib/milkeyApi';
import { getAuthToken } from '@/lib/authStore';
import { exportMembers, exportMilkCollections, exportPayments } from '@/lib/csvExport';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';

type TabType = 'Entry' | 'Payment' | 'Reports' | 'Member';

// Helper to group collections by date and farmer for combined M/E display
interface GroupedEntry {
    date: string;
    farmerId: string;
    farmerName: string;
    farmerCode: string;
    morningQty: number;
    eveningQty: number;
    morningId?: string;
    eveningId?: string;
    totalAmount: number;
    rate: number;
}

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
    const [selectedMember, setSelectedMember] = useState<Farmer | null>(null);
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [mornQty, setMornQty] = useState('');
    const [eveQty, setEveQty] = useState('');
    const [rate, setRate] = useState('50');
    const [recentEntries, setRecentEntries] = useState<MilkCollection[]>([]);
    const [entriesPage, setEntriesPage] = useState(1);
    const [hasMoreEntries, setHasMoreEntries] = useState(true);
    const [savingEntry, setSavingEntry] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Payment state
    const [selectedPaymentMember, setSelectedPaymentMember] = useState<Farmer | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank'>('cash');
    const [memberSummary, setMemberSummary] = useState<any>(null);
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
    const [showMemberModal, setShowMemberModal] = useState(false);

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

    // Helper function for date offset
    function getDateOffset(days: number) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    }

    // Filtered members for search - auto suggest
    const filteredMembers = useMemo(() => {
        if (!searchMember.trim()) return members.slice(0, 10);
        const query = searchMember.toLowerCase();
        return members.filter(m =>
            m.name.toLowerCase().includes(query) ||
            m.code.toLowerCase().includes(query)
        ).slice(0, 10);
    }, [members, searchMember]);

    const totalQuantity = (parseFloat(mornQty) || 0) + (parseFloat(eveQty) || 0);
    const totalAmount = totalQuantity * (parseFloat(rate) || 0);

    // Group entries by date and farmer for combined M/E display
    const groupedEntries = useMemo((): GroupedEntry[] => {
        const groups: Record<string, GroupedEntry> = {};

        recentEntries.forEach(entry => {
            const dateStr = new Date(entry.date).toISOString().split('T')[0];
            const farmerId = (entry.farmer as any)?._id || entry.farmerCode;
            const key = `${dateStr}-${farmerId}`;

            if (!groups[key]) {
                groups[key] = {
                    date: dateStr,
                    farmerId,
                    farmerName: (entry.farmer as any)?.name || entry.farmerCode,
                    farmerCode: (entry.farmer as any)?.code || entry.farmerCode,
                    morningQty: 0,
                    eveningQty: 0,
                    totalAmount: 0,
                    rate: entry.rate,
                };
            }

            if (entry.shift === 'morning') {
                groups[key].morningQty += entry.quantity;
                groups[key].morningId = entry._id;
            } else {
                groups[key].eveningQty += entry.quantity;
                groups[key].eveningId = entry._id;
            }
            groups[key].totalAmount += entry.amount;
        });

        return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [recentEntries]);

    // Fetch data - only members (type: 'member')
    const fetchData = useCallback(async () => {
        const token = await getAuthToken();
        if (!token) return;

        try {
            setIsLoading(true);
            const [membersRes, collectionsRes, paymentsRes] = await Promise.all([
                farmersApi.getAll({ type: 'member' }),
                milkCollectionsApi.getAll({ limit: 50 }),
                paymentsApi.getAll({ limit: 10 })
            ]);

            if (membersRes.success) {
                setMembers(membersRes.response?.data || []);
            }
            if (collectionsRes.success) {
                setRecentEntries(collectionsRes.response?.data || []);
                setHasMoreEntries((collectionsRes.response?.data || []).length >= 50);
                setEntriesPage(1);
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

    // Load more entries
    const handleLoadMore = async () => {
        if (loadingMore || !hasMoreEntries) return;
        setLoadingMore(true);
        try {
            const nextPage = entriesPage + 1;
            const res = await milkCollectionsApi.getAll({ limit: 50, page: nextPage });
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

    // Save milk entry
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
            const entries = [];

            if (morn > 0) {
                entries.push(milkCollectionsApi.create({
                    farmerCode: selectedMember.code,
                    quantity: morn,
                    rate: parseFloat(rate) || 50,
                    shift: 'morning',
                    date: entryDate,
                }));
            }

            if (eve > 0) {
                entries.push(milkCollectionsApi.create({
                    farmerCode: selectedMember.code,
                    quantity: eve,
                    rate: parseFloat(rate) || 50,
                    shift: 'evening',
                    date: entryDate,
                }));
            }

            const results = await Promise.all(entries);
            const allSuccess = results.every(res => res.success);

            if (allSuccess) {
                showAlert('Success', 'Entry saved successfully');
                setMornQty('');
                setEveQty('');
                setSelectedMember(null);
                setSearchMember('');
                fetchData();
            } else {
                showAlert('Error', 'Failed to save one or more entries');
            }
        } catch (error) {
            showAlert('Error', 'Failed to save entry');
        } finally {
            setSavingEntry(false);
        }
    };

    // Delete entry
    const handleDeleteEntry = async (morningId?: string, eveningId?: string) => {
        showConfirm('Delete Entry', 'Are you sure you want to delete this entry?', async () => {
            setConfirmVisible(false);
            try {
                const deletes = [];
                if (morningId) deletes.push(milkCollectionsApi.delete(morningId));
                if (eveningId) deletes.push(milkCollectionsApi.delete(eveningId));
                await Promise.all(deletes);
                fetchData();
            } catch (error) {
                showAlert('Error', 'Failed to delete entry');
            }
        });
    };

    // Fetch member summary for payment
    const handleSelectPaymentMember = async (member: Farmer) => {
        setSelectedPaymentMember(member);
        try {
            const res = await paymentsApi.getFarmerSummary(member.code);
            if (res.success) {
                setMemberSummary(res.response);
                setPaymentAmount(res.response?.netPayable?.toString() || '0');
            }
        } catch (error) {
            console.error('Fetch summary error:', error);
        }
    };

    // Process payment
    const handleProcessPayment = async () => {
        if (!selectedPaymentMember) {
            showAlert('Error', 'Please select a member first');
            return;
        }

        const amount = parseFloat(paymentAmount) || 0;
        if (amount <= 0) {
            showAlert('Error', 'Please enter valid amount');
            return;
        }

        try {
            setIsLoading(true);
            const res = await paymentsApi.create({
                farmerCode: selectedPaymentMember.code,
                amount,
                paymentMethod,
                notes: `Payment via ${paymentMethod}`
            });

            if (res.success) {
                showAlert('Success', 'Payment processed successfully');
                setPaymentAmount('');
                setSelectedPaymentMember(null);
                setMemberSummary(null);
                fetchData();
            } else {
                showAlert('Error', res.message || 'Failed to process payment');
            }
        } catch (error) {
            showAlert('Error', 'Failed to process payment');
        } finally {
            setIsLoading(false);
        }
    };

    // Save member
    const handleSaveMember = async () => {
        if (!memberCode || !memberName || !memberMobile) {
            showAlert('Error', 'Please fill all required fields');
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
                    showAlert('Success', 'Member updated successfully');
                    clearMemberForm();
                    setShowMemberModal(false);
                    fetchData();
                } else {
                    showAlert('Error', res.message || 'Failed to update member');
                }
            } else {
                const res = await farmersApi.create({
                    code: memberCode,
                    name: memberName,
                    mobile: memberMobile,
                    address: memberAddress,
                    type: 'member'
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
        setShowMemberModal(true);
    };

    const handleDeleteMember = async (id: string) => {
        showConfirm('Delete Member', 'Are you sure you want to delete this member?', async () => {
            setConfirmVisible(false);
            try {
                const res = await farmersApi.delete(id);
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
                showAlert('PDF Generated', `Saved to: ${uri}`);
            }
        } catch (error) {
            showAlert('Error', 'Failed to generate PDF');
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
                                setShowSuggestions(false);
                            }}
                        >
                            <View style={styles.dropdownItemContent}>
                                <Text style={styles.dropdownCode}>{member.code}</Text>
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
                        placeholder="Search member by name or code..."
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
                        <Calendar size={16} color={colors.mutedForeground} />
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

            <View style={styles.entriesHeader}>
                <Text style={styles.sectionTitle}>Recent Entries</Text>
                <Text style={styles.lastCount}>({groupedEntries.length} days)</Text>
            </View>

            {groupedEntries.length === 0 ? (
                <Text style={styles.emptyText}>No entries yet</Text>
            ) : (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>M/E (L)</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Amt</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Act</Text>
                    </View>
                    {groupedEntries.map((item, index) => (
                        <View key={`${item.date}-${item.farmerId}-${index}`} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 1 }]}>{formatDate(item.date)}</Text>
                            <Text style={[styles.tableCell, { flex: 1.2 }]} numberOfLines={1}>{item.farmerName}</Text>
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={styles.meText}>
                                    {item.morningQty > 0 ? item.morningQty : '-'} + {item.eveningQty > 0 ? item.eveningQty : '-'}
                                </Text>
                            </View>
                            <Text style={[styles.tableCell, { flex: 0.8, color: colors.primary, fontWeight: '600' }]}>₹{item.totalAmount.toFixed(0)}</Text>
                            <View style={{ flex: 0.5, alignItems: 'center', justifyContent: 'center' }}>
                                <Pressable style={styles.deleteBtn} onPress={() => handleDeleteEntry(item.morningId, item.eveningId)}>
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
                                selectedPaymentMember?._id === member._id && styles.memberChipActive
                            ]}
                            onPress={() => handleSelectPaymentMember(member)}
                        >
                            <User size={12} color={selectedPaymentMember?._id === member._id ? colors.white : colors.foreground} />
                            <Text style={[
                                styles.memberChipText,
                                selectedPaymentMember?._id === member._id && styles.memberChipTextActive
                            ]}>{member.name}</Text>
                            {selectedPaymentMember?._id === member._id && (
                                <Check size={12} color={colors.white} />
                            )}
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            {selectedPaymentMember && memberSummary && (
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>{selectedPaymentMember.name}</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total Milk:</Text>
                        <Text style={styles.summaryValue}>{memberSummary.totalQuantity || memberSummary.milk?.totalQuantity || 0} L</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Milk Amount:</Text>
                        <Text style={styles.summaryValue}>₹{memberSummary.totalMilkAmount || memberSummary.milk?.totalAmount || 0}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Advances:</Text>
                        <Text style={[styles.summaryValue, { color: colors.destructive }]}>-₹{memberSummary.totalAdvances || memberSummary.advances?.totalPending || 0}</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.summaryTotal]}>
                        <Text style={styles.summaryTotalLabel}>Net Payable:</Text>
                        <Text style={styles.summaryTotalValue}>₹{memberSummary.totalDue || memberSummary.netPayable || 0}</Text>
                    </View>
                </View>
            )}

            {selectedPaymentMember && (
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
                            <Text style={[styles.tableCell, { flex: 1 }]}>{formatDate(item.createdAt || item.date)}</Text>
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

                <View style={styles.filterCard}>
                    <Text style={styles.filterTitle}>Date Range Filter</Text>
                    <View style={styles.dateFilterRow}>
                        <Pressable style={styles.dateFilterBtn} onPress={() => openDatePicker('reportStart')}>
                            <Calendar size={14} color={colors.primary} />
                            <Text style={styles.dateFilterText}>{formatDate(reportStartDate)}</Text>
                        </Pressable>
                        <Text style={styles.dateFilterSeparator}>to</Text>
                        <Pressable style={styles.dateFilterBtn} onPress={() => openDatePicker('reportEnd')}>
                            <Calendar size={14} color={colors.primary} />
                            <Text style={styles.dateFilterText}>{formatDate(reportEndDate)}</Text>
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
                        <FileText size={16} color={colors.white} />
                        <Text style={styles.exportText}>PDF</Text>
                    </Pressable>
                    <Pressable style={styles.printBtn} onPress={handlePrint}>
                        <Printer size={16} color={colors.primary} />
                        <Text style={[styles.exportText, { color: colors.primary }]}>Print</Text>
                    </Pressable>
                </View>

                <View style={[styles.exportBtnsRow, { marginTop: 8 }]}>
                    <Pressable style={styles.csvBtn} onPress={handleExportCollections}>
                        <Download size={14} color={colors.primary} />
                        <Text style={styles.csvBtnText}>Collections CSV</Text>
                    </Pressable>
                    <Pressable style={styles.csvBtn} onPress={handleExportPayments}>
                        <Download size={14} color={colors.primary} />
                        <Text style={styles.csvBtnText}>Payments CSV</Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    const renderMemberTab = () => (
        <View>
            <View style={styles.memberHeader}>
                <Text style={styles.sectionTitle}>Member Management</Text>
                <View style={styles.memberHeaderBtns}>
                    <Pressable style={styles.exportMemberBtn} onPress={handleExportMembers}>
                        <Download size={14} color={colors.primary} />
                        <Text style={styles.exportMemberText}>Export</Text>
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

            <Text style={[styles.sectionTitle, { marginTop: 8, fontSize: 13 }]}>Members List ({members.length})</Text>

            {members.length === 0 ? (
                <Text style={styles.emptyText}>No members yet. Add your first member.</Text>
            ) : (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Code</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Mobile</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Actions</Text>
                    </View>
                    {members.map((item) => (
                        <View key={item._id} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 0.6 }]}>{item.code}</Text>
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

    // Member Modal
    const renderMemberModal = () => (
        <Modal
            visible={showMemberModal}
            animationType="slide"
            transparent={false}
            onRequestClose={() => setShowMemberModal(false)}
            statusBarTranslucent
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{editingMember ? 'Edit Member' : 'Add New Member'}</Text>
                    <Pressable style={styles.modalCloseBtn} onPress={() => setShowMemberModal(false)}>
                        <X size={24} color={colors.foreground} />
                    </Pressable>
                </View>

                <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Code *</Text>
                        <TextInput
                            style={[styles.input, editingMember && styles.inputDisabled]}
                            placeholder="M001"
                            value={memberCode}
                            onChangeText={setMemberCode}
                            editable={!editingMember}
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            value={memberName}
                            onChangeText={setMemberName}
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Mobile *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="10-digit number"
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
                </ScrollView>

                <View style={styles.modalFooter}>
                    <Pressable style={styles.modalCancelBtn} onPress={() => setShowMemberModal(false)}>
                        <Text style={styles.modalCancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.modalSaveBtn} onPress={handleSaveMember} disabled={isLoading}>
                        {isLoading ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <Text style={styles.modalSaveBtnText}>{editingMember ? 'Update' : 'Save'}</Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </Modal>
    );

    return (
        <View style={styles.container}>
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

            <DatePickerModal
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                onSelect={handleDateSelect}
                selectedDate={datePickerTarget === 'entry' ? entryDate : datePickerTarget === 'reportStart' ? reportStartDate : reportEndDate}
                title={datePickerTarget === 'entry' ? 'Select Entry Date' : datePickerTarget === 'reportStart' ? 'Select Start Date' : 'Select End Date'}
            />

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
    memberHeaderBtns: {
        flexDirection: 'row',
        gap: 8,
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
});
