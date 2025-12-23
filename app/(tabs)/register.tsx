import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Calendar, FileText, Trash2 } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { farmersApi, advancesApi, Farmer, Advance } from '@/lib/milkeyApi';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';

type TabType = 'Payments' | 'Advances' | 'Farmers';

export default function RegisterScreen() {
    const { colors, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<TabType>('Farmers');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Data state
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [advances, setAdvances] = useState<Advance[]>([]);

    // Payments state
    const [farmerCode, setFarmerCode] = useState('');

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
            const [farmersRes, advancesRes] = await Promise.all([
                farmersApi.getAll(),
                advancesApi.getAll(),
            ]);

            if (farmersRes.success && farmersRes.response?.data) {
                setFarmers(farmersRes.response.data);
            }
            if (advancesRes.success && advancesRes.response?.data) {
                setAdvances(advancesRes.response.data);
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

    // Filter farmers by search
    const filteredFarmers = searchCode
        ? farmers.filter(f => f.code.includes(searchCode))
        : farmers;

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
            <Text style={styles.infoText}>Select a farmer to view payments</Text>

            <Text style={[styles.subTitle, { marginTop: 16 }]}>Settlement History</Text>
            <Text style={styles.infoTextMuted}>No settlements yet</Text>
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
                <Pressable style={styles.saveBtn} onPress={handleAddAdvance} disabled={loading}>
                    <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save Advance'}</Text>
                </Pressable>
                <Pressable style={styles.clearBtn} onPress={clearAdvanceForm}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </Pressable>
            </View>

            {/* Advances Table */}
            {advances.length > 0 ? (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Note</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Amt</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date</Text>
                    </View>
                    {advances.map((item) => (
                        <View key={item._id} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 0.5, color: colors.primary }]}>{item.farmer?.code}</Text>
                            <Text style={[styles.tableCell, { flex: 2, textAlign: 'left' }]}>{item.note || '-'}</Text>
                            <Text style={[styles.tableCell, { flex: 1, color: colors.warning }]}>₹{item.amount}</Text>
                            <Text style={[styles.tableCell, { flex: 1 }]}>{new Date(item.date).toLocaleDateString()}</Text>
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={styles.infoTextMuted}>No advances recorded yet</Text>
            )}
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
                <Pressable style={styles.saveBtn} onPress={handleAddFarmer} disabled={loading}>
                    <Text style={styles.saveBtnText}>{loading ? 'Adding...' : 'Add Farmer'}</Text>
                </Pressable>
                <Pressable style={styles.clearBtn} onPress={clearFarmerForm}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </Pressable>
            </View>

            {/* Search and PDF */}
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by Code"
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
            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : filteredFarmers.length > 0 ? (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Mobile</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Act</Text>
                    </View>
                    {filteredFarmers.map((item) => (
                        <View key={item._id} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 0.5, color: colors.primary }]}>{item.code}</Text>
                            <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'left' }]}>{item.name}</Text>
                            <Text style={[styles.tableCell, { flex: 1.2 }]}>{item.mobile}</Text>
                            <View style={{ flex: 0.5, alignItems: 'center' }}>
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
});
