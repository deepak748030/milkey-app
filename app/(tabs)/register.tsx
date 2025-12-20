import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Calendar, FileText, Trash2 } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type TabType = 'Payments' | 'Advances' | 'Farmers';

const mockFarmers = [
    { id: '1', code: '1', name: 'kalu', mobile: '963232' },
    { id: '2', code: '2', name: 'premveer', mobile: '991756481' },
    { id: '3', code: '4', name: 'jhgmn,bjh', mobile: '656322563' },
    { id: '4', code: '5', name: 'ds lodhi', mobile: '9012977624' },
    { id: '5', code: '6', name: 'khurram khalam', mobile: '8545785896' },
];

const mockAdvances = [
    { id: '1', code: '4', note: 'vese hi de diuye', amt: 5000, date: '2025-12-16' },
    { id: '2', code: '1', note: 'cash me diya tha', amt: 2000, date: '2025-12-16' },
    { id: '3', code: '3', note: 'case me diye the rahul ko', amt: 3000, date: '2025-12-16' },
];

export default function RegisterScreen() {
    const { colors, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<TabType>('Payments');

    // Payments state
    const [farmerCode, setFarmerCode] = useState('');

    // Advances state Register
    const [advCode, setAdvCode] = useState('');
    const [advName, setAdvName] = useState('');
    const [advAmount, setAdvAmount] = useState('');
    const [advDate, setAdvDate] = useState('20-12-2025');
    const [advNote, setAdvNote] = useState('');

    // Farmers state
    const [newCode, setNewCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newMobile, setNewMobile] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [searchCode, setSearchCode] = useState('');

    const generateFarmersPDF = async () => {
        const rows = mockFarmers.map(item => `
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
                Alert.alert('PDF Generated', `Saved to: ${uri}`);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to generate PDF');
        }
    };

    const styles = createStyles(colors, isDark);

    const renderPaymentsTab = () => (
        <View>
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Enter Farmer Code"
                    value={farmerCode}
                    onChangeText={setFarmerCode}
                    placeholderTextColor={colors.mutedForeground}
                />
                <Pressable style={styles.goBtn}>
                    <Text style={styles.goBtnText}>Go</Text>
                </Pressable>
            </View>

            <Text style={styles.subTitle}>Recent Settlements</Text>
            <Text style={styles.infoText}>Index missing for global list</Text>

            <Text style={[styles.subTitle, { marginTop: 16 }]}>Settlement History</Text>
            <Text style={styles.infoTextMuted}>Select a farmer to view history</Text>
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
                        onChangeText={setAdvCode}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.muted }]}
                        placeholder="Name"
                        value={advName}
                        onChangeText={setAdvName}
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
                    <View style={styles.dateInput}>
                        <TextInput
                            style={styles.textInput}
                            value={advDate}
                            onChangeText={setAdvDate}
                            placeholderTextColor={colors.mutedForeground}
                        />
                        <Calendar size={16} color={colors.mutedForeground} />
                    </View>
                </View>
            </View>

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
                <Pressable style={styles.saveBtn}>
                    <Text style={styles.saveBtnText}>Save Advance</Text>
                </Pressable>
                <Pressable style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </Pressable>
            </View>

            {/* Advances Table */}
            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Note</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Amt</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date</Text>
                </View>
                {mockAdvances.map((item) => (
                    <View key={item.id} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 0.5, color: colors.primary }]}>{item.code}</Text>
                        <Text style={[styles.tableCell, { flex: 2, textAlign: 'left' }]}>{item.note}</Text>
                        <Text style={[styles.tableCell, { flex: 1, color: colors.warning }]}>₹{item.amt}</Text>
                        <Text style={[styles.tableCell, { flex: 1 }]}>{item.date}</Text>
                    </View>
                ))}
            </View>
        </View>
    );

    const renderFarmersTab = () => (
        <View>
            <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 0.4 }]}>
                    <Text style={styles.label}>Code</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Code"
                        value={newCode}
                        onChangeText={setNewCode}
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
                <Pressable style={styles.saveBtn}>
                    <Text style={styles.saveBtnText}>Add Farmer</Text>
                </Pressable>
                <Pressable style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </Pressable>
            </View>

            {/* Search and PDF */}
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Enter Code"
                    value={searchCode}
                    onChangeText={setSearchCode}
                    placeholderTextColor={colors.mutedForeground}
                />
                <Pressable style={styles.pdfBtn} onPress={generateFarmersPDF}>
                    <FileText size={14} color={colors.white} />
                    <Text style={styles.pdfBtnText}>PDF</Text>
                </Pressable>
            </View>

            {/* Farmers Table */}
            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Name</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Mobile</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Act</Text>
                </View>
                {mockFarmers.map((item) => (
                    <View key={item.id} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 0.5, color: colors.primary }]}>{item.code}</Text>
                        <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'left' }]}>{item.name}</Text>
                        <Text style={[styles.tableCell, { flex: 1.2 }]}>{item.mobile}</Text>
                        <View style={{ flex: 0.5, alignItems: 'center' }}>
                            <Pressable style={styles.deleteBtn}>
                                <Trash2 size={14} color={colors.destructive} />
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
            {/* <Text style={styles.pageTitle}>Register</Text> */}

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

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {activeTab === 'Payments' && renderPaymentsTab()}
                {activeTab === 'Advances' && renderAdvancesTab()}
                {activeTab === 'Farmers' && renderFarmersTab()}
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    pageTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.primary,
        paddingHorizontal: 6,
        marginBottom: 10,
        marginTop: 6,
    },
    tabRow: {
        flexDirection: 'row',
        paddingHorizontal: 6,
        gap: 6,
        marginBottom: 12,
        marginTop: 4,
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
});