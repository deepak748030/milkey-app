import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Calendar as CalendarIcon, Search, Trash2, FileText, Printer, Edit2, DollarSign, User, Download, Check, Plus, X } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import { Calendar } from '@/components/Calendar';
import { membersApi, sellingEntriesApi, paymentsApi, Member, SellingEntry, Payment } from '@/lib/milkeyApi';
import { getAuthToken } from '@/lib/authStore';
import { exportPayments } from '@/lib/csvExport';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';

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
    const [activeTab, setActiveTab] = useState<TabType>('Entry');
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Date picker state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerTarget, setDatePickerTarget] = useState<'entry' | 'reportStart' | 'reportEnd'>('entry');
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

    // Payment state
    const [selectedPaymentMember, setSelectedPaymentMember] = useState<Member | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank'>('cash');
    const [memberSummary, setMemberSummary] = useState<any>(null);
    const [recentPayments, setRecentPayments] = useState<Payment[]>([]);

    // Reports state
    const [reportStartDate, setReportStartDate] = useState(getDateOffset(-7));
    const [reportEndDate, setReportEndDate] = useState(getDateOffset(0));

    // Member state
    const [members, setMembers] = useState<Member[]>([]);
    const [memberName, setMemberName] = useState('');
    const [memberMobile, setMemberMobile] = useState('');
    const [memberAddress, setMemberAddress] = useState('');
    const [memberRatePerLiter, setMemberRatePerLiter] = useState('50');
    const [editingMember, setEditingMember] = useState<Member | null>(null);
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
    // Filtered members for search - by name only
    const filteredMembers = useMemo(() => {
        if (!searchMember.trim()) return members.slice(0, 10);
        const query = searchMember.toLowerCase();
        return members.filter(m =>
            m.name.toLowerCase().includes(query)
        ).slice(0, 10);
    }, [members, searchMember]);

    const totalQuantity = (parseFloat(mornQty) || 0) + (parseFloat(eveQty) || 0);
    const totalAmount = totalQuantity * (parseFloat(rate) || 0);

    // Group entries by date and member for combined M/E display
    const groupedEntries = useMemo((): GroupedEntry[] => {
        const groups: Record<string, GroupedEntry> = {};

        recentEntries.forEach(entry => {
            const dateStr = new Date(entry.date).toISOString().split('T')[0];
            const memberId = entry.member?._id || '';
            const key = `${dateStr}-${memberId}`;

            if (!groups[key]) {
                groups[key] = {
                    date: dateStr,
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
        });

        return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [recentEntries]);

    // Fetch data - members and selling entries
    const fetchData = useCallback(async () => {
        const token = await getAuthToken();
        if (!token) return;

        try {
            setIsLoading(true);
            const [membersRes, entriesRes, paymentsRes] = await Promise.all([
                membersApi.getAll(),
                sellingEntriesApi.getAll({ limit: 50 }),
                paymentsApi.getAll({ limit: 10 })
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

    // Fetch member summary for payment (placeholder - payment feature coming soon)
    const handleSelectPaymentMember = async (member: Member) => {
        setSelectedPaymentMember(member);
        setMemberSummary({ pendingAmount: member.pendingAmount });
        setPaymentAmount(member.pendingAmount?.toString() || '0');
    };

    // Process payment (placeholder - coming soon)
    const handleProcessPayment = async () => {
        showAlert('Coming Soon', 'Payment feature will be available soon');
    };

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
        } else {
            setReportEndDate(date);
        }
    };

    const openDatePicker = (target: 'entry' | 'reportStart' | 'reportEnd') => {
        setDatePickerTarget(target);
        // Set temp calendar date based on target
        if (target === 'entry') {
            setTempCalendarDate(new Date(entryDate));
        } else if (target === 'reportStart') {
            setTempCalendarDate(new Date(reportStartDate));
        } else {
            setTempCalendarDate(new Date(reportEndDate));
        }
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
              <p class="period">Period: ${formatDateDDMMYYYY(reportStartDate)} to ${formatDateDDMMYYYY(reportEndDate)}</p>
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

    const handlePrint = async () => {
        try {
            const html = generateReportHTML();
            await Print.printAsync({ html });
        } catch (error) {
            showAlert('Error', 'Failed to print');
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

    const renderPaymentTab = () => (
        <View style={styles.comingSoonContainer}>
            <Text style={styles.comingSoonText}>Coming Soon</Text>
            <Text style={styles.comingSoonSubtext}>Payment feature will be available soon</Text>
        </View>
    );

    const renderReportsTab = () => {
        const filteredEntries = getFilteredEntries();
        const totalQty = filteredEntries.reduce((s, e) => s + (e.morningQuantity || 0) + (e.eveningQuantity || 0), 0);
        const totalAmt = filteredEntries.reduce((s, e) => s + e.amount, 0);

        // Group by member for summary
        const memberSummaries: Record<string, { name: string; qty: number; amt: number }> = {};
        filteredEntries.forEach(entry => {
            const memberId = entry.member?._id || 'unknown';
            if (!memberSummaries[memberId]) {
                memberSummaries[memberId] = { name: entry.member?.name || 'Unknown', qty: 0, amt: 0 };
            }
            memberSummaries[memberId].qty += (entry.morningQuantity || 0) + (entry.eveningQuantity || 0);
            memberSummaries[memberId].amt += entry.amount;
        });
        const memberSummaryList = Object.values(memberSummaries).sort((a, b) => b.amt - a.amt);

        return (
            <View>
                <Text style={styles.sectionTitle}>Selling Report</Text>

                <View style={styles.filterCard}>
                    <Text style={styles.filterTitle}>Date Range Filter</Text>
                    <View style={styles.dateFilterRow}>
                        <Pressable style={styles.dateFilterBtn} onPress={() => openDatePicker('reportStart')}>
                            <CalendarIcon size={14} color={colors.primary} />
                            <Text style={styles.dateFilterText}>{formatDate(reportStartDate)}</Text>
                        </Pressable>
                        <Text style={styles.dateFilterSeparator}>to</Text>
                        <Pressable style={styles.dateFilterBtn} onPress={() => openDatePicker('reportEnd')}>
                            <CalendarIcon size={14} color={colors.primary} />
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
                        <Text style={[styles.reportCardValue, { color: colors.success }]}>₹{totalAmt.toFixed(0)}</Text>
                    </View>
                </View>

                {/* Member-wise Summary */}
                {memberSummaryList.length > 0 && (
                    <View style={styles.memberSummarySection}>
                        <Text style={styles.memberSummaryTitle}>Member-wise Summary</Text>
                        <View style={styles.table}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Member</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Qty (L)</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Amount</Text>
                            </View>
                            {memberSummaryList.map((item, index) => (
                                <View key={index} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, { flex: 1.5 }]} numberOfLines={1}>{item.name}</Text>
                                    <Text style={[styles.tableCell, { flex: 1 }]}>{item.qty.toFixed(1)}</Text>
                                    <Text style={[styles.tableCell, { flex: 1, color: colors.primary, fontWeight: '600' }]}>₹{item.amt.toFixed(0)}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                <View style={styles.exportBtnsRow}>
                    <Pressable style={styles.pdfBtn} onPress={handlePDF}>
                        <FileText size={16} color={colors.white} />
                        <Text style={styles.exportText}>Download PDF</Text>
                    </Pressable>
                    <Pressable style={styles.csvBtn} onPress={handlePrint}>
                        <Printer size={14} color={colors.primary} />
                        <Text style={styles.csvBtnText}>Print</Text>
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

            <Text style={[styles.sectionTitle, { marginTop: 8, fontSize: 13 }]}>Members List ({members.length})</Text>

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
                            <Calendar selectedDate={tempCalendarDate} onDateSelect={setTempCalendarDate} />
                        </View>
                        <View style={styles.dateModalFooter}>
                            <Pressable style={styles.cancelModalBtn} onPress={() => setShowDatePicker(false)}>
                                <Text style={styles.cancelModalBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.confirmModalBtn} onPress={() => {
                                if (tempCalendarDate) {
                                    // Use local date format to avoid timezone issues
                                    const y = tempCalendarDate.getFullYear();
                                    const m = String(tempCalendarDate.getMonth() + 1).padStart(2, '0');
                                    const d = String(tempCalendarDate.getDate()).padStart(2, '0');
                                    const dateStr = `${y}-${m}-${d}`;
                                    handleDateSelect(dateStr);
                                }
                                setShowDatePicker(false);
                            }}>
                                <Text style={styles.confirmModalBtnText}>Confirm</Text>
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
});
