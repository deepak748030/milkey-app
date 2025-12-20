import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Calendar, Search, Trash2, FileText, Printer } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type TabType = 'Entry' | 'Payment' | 'Reports' | 'Member';

const mockRecentEntries = [
    { id: '1', date: '2025-12-17', name: 'Raju', me: '5/3', amt: 400 },
    { id: '2', date: '2025-12-17', name: 'Shyam', me: '2/2', amt: 200 },
    { id: '3', date: '2025-12-16', name: 'Mohan', me: '4/0', amt: 200 },
];

const mockMembers = [
    { id: '1', name: 'Raju Kumar', mobile: '9876543210', rate: 50, address: 'Village A' },
    { id: '2', name: 'Shyam Singh', mobile: '9876543211', rate: 50, address: 'Village B' },
    { id: '3', name: 'Mohan Lal', mobile: '9876543212', rate: 50, address: 'Village C' },
];

export default function SellingScreen() {
    const { colors, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<TabType>('Entry');

    // Entry state
    const [searchMember, setSearchMember] = useState('');
    const [entryDate, setEntryDate] = useState('20-12-2025');
    const [morningLiters, setMorningLiters] = useState('0');
    const [eveningLiters, setEveningLiters] = useState('0');

    // Member state
    const [memberName, setMemberName] = useState('');
    const [memberMobile, setMemberMobile] = useState('');
    const [memberRate, setMemberRate] = useState('');
    const [memberAddress, setMemberAddress] = useState('');

    const totalAmount = (parseFloat(morningLiters) || 0) * 50 + (parseFloat(eveningLiters) || 0) * 50;

    const generateReportHTML = () => {
        const rows = mockRecentEntries.map(item => `
      <tr>
        <td>${item.date}</td>
        <td>${item.name}</td>
        <td>${item.me}</td>
        <td>₹${item.amt}</td>
      </tr>
    `).join('');

        return `
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
          <h1>Milk Selling Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>M/E (L)</th>
              <th>Amount</th>
            </tr>
            ${rows}
          </table>
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

    const styles = createStyles(colors, isDark);

    const renderEntryTab = () => (
        <View>
            <Text style={styles.sectionTitle}>Milk Selling Entry</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Member (Customer)</Text>
                <View style={styles.searchInput}>
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={styles.searchTextInput}
                        placeholder="Search member..."
                        value={searchMember}
                        onChangeText={setSearchMember}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date</Text>
                    <View style={styles.dateInput}>
                        <TextInput
                            style={styles.textInput}
                            value={entryDate}
                            onChangeText={setEntryDate}
                            placeholderTextColor={colors.mutedForeground}
                        />
                        <Calendar size={16} color={colors.mutedForeground} />
                    </View>
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Morn (L)</Text>
                    <TextInput
                        style={styles.input}
                        value={morningLiters}
                        onChangeText={setMorningLiters}
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Eve (L)</Text>
                    <TextInput
                        style={styles.input}
                        value={eveningLiters}
                        onChangeText={setEveningLiters}
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
                    <Pressable style={styles.saveBtn}>
                        <Text style={styles.saveBtnText}>Save Entry</Text>
                    </Pressable>
                    <Pressable style={styles.clearBtn}>
                        <Text style={styles.clearBtnText}>Clear</Text>
                    </Pressable>
                </View>
            </View>

            <View style={styles.entriesHeader}>
                <Text style={styles.sectionTitle}>Recent Entries</Text>
                <Text style={styles.lastCount}>(Last 20)</Text>
            </View>

            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Name</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>M/E (L)</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Amt</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Action</Text>
                </View>
                {mockRecentEntries.map((item) => (
                    <View key={item.id} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 1 }]}>{item.date}</Text>
                        <Text style={[styles.tableCell, { flex: 1 }]}>{item.name}</Text>
                        <Text style={[styles.tableCell, { flex: 0.8 }]}>{item.me}</Text>
                        <Text style={[styles.tableCell, { flex: 0.8, color: colors.primary }]}>₹{item.amt}</Text>
                        <View style={{ flex: 0.6, alignItems: 'center' }}>
                            <Pressable style={styles.deleteBtn}>
                                <Trash2 size={12} color={colors.destructive} />
                            </Pressable>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );

    const renderPaymentTab = () => (
        <View>
            <Text style={styles.sectionTitle}>Payment Management</Text>
            <Text style={styles.infoTextMuted}>Select a member to record payment</Text>
        </View>
    );

    const renderReportsTab = () => (
        <View>
            <Text style={styles.sectionTitle}>Reports</Text>
            <Text style={styles.infoTextMuted}>Generate sales and payment reports</Text>

            <View style={styles.exportBtnsRow}>
                <Pressable style={styles.pdfBtn} onPress={handlePDF}>
                    <FileText size={14} color={colors.white} />
                    <Text style={styles.exportText}>Generate PDF</Text>
                </Pressable>
                <Pressable style={styles.printBtn} onPress={handlePrint}>
                    <Printer size={14} color={colors.white} />
                    <Text style={styles.exportText}>Print Report</Text>
                </Pressable>
            </View>
        </View>
    );

    const renderMemberTab = () => (
        <View>
            <Text style={styles.sectionTitle}>Add Member</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Member Name"
                    value={memberName}
                    onChangeText={setMemberName}
                    placeholderTextColor={colors.mutedForeground}
                />
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Mobile</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Mobile Number"
                        value={memberMobile}
                        onChangeText={setMemberMobile}
                        keyboardType="phone-pad"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Rate (₹/L)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Rate"
                        value={memberRate}
                        onChangeText={setMemberRate}
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Address"
                    value={memberAddress}
                    onChangeText={setMemberAddress}
                    placeholderTextColor={colors.mutedForeground}
                />
            </View>

            <View style={styles.buttonRow}>
                <Pressable style={styles.saveBtn}>
                    <Text style={styles.saveBtnText}>Save Member</Text>
                </Pressable>
                <Pressable style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Members List</Text>

            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Name</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Mobile</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Rate</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Address</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Action</Text>
                </View>
                {mockMembers.map((item) => (
                    <View key={item.id} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'left' }]}>{item.name}</Text>
                        <Text style={[styles.tableCell, { flex: 1 }]}>{item.mobile}</Text>
                        <Text style={[styles.tableCell, { flex: 0.5 }]}>{item.rate}</Text>
                        <Text style={[styles.tableCell, { flex: 1, textAlign: 'left' }]}>{item.address}</Text>
                        <View style={{ flex: 0.5, alignItems: 'center' }}>
                            <Pressable style={styles.deleteBtn}>
                                <Trash2 size={12} color={colors.destructive} />
                            </Pressable>
                        </View>
                    </View>
                ))}
            </View>
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

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {activeTab === 'Entry' && renderEntryTab()}
                {activeTab === 'Payment' && renderPaymentTab()}
                {activeTab === 'Reports' && renderReportsTab()}
                {activeTab === 'Member' && renderMemberTab()}
            </ScrollView>
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
        paddingHorizontal: 6,
        paddingBottom: 80,
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
    searchInput: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
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
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    textInput: {
        flex: 1,
        fontSize: 14,
        color: colors.foreground,
        padding: 0,
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
        fontSize: 12,
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
        paddingVertical: 10,
        borderRadius: 6,
        alignItems: 'center',
    },
    saveBtnText: {
        color: colors.white,
        fontSize: 13,
        fontWeight: '600',
    },
    clearBtn: {
        backgroundColor: colors.muted,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
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
        marginBottom: 10,
    },
    lastCount: {
        fontSize: 11,
        color: colors.mutedForeground,
    },
    infoTextMuted: {
        fontSize: 13,
        color: colors.mutedForeground,
    },
    exportBtnsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    pdfBtn: {
        flex: 1,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 6,
    },
    printBtn: {
        flex: 1,
        backgroundColor: colors.destructive,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 6,
    },
    exportText: {
        color: colors.white,
        fontSize: 13,
        fontWeight: '600',
    },
    table: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        overflow: 'hidden',
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
});