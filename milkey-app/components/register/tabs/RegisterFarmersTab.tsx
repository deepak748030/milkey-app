import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Search, X, Plus, User, Edit2, Trash2, FileText, Printer } from 'lucide-react-native';

// Ponytail reusable — single source, no duplication, no UI change
export function RegisterFarmersTab(props:any){
  const { s, styles, colors, t, isDark, customers, setSelectedCustomer, customerSearch, setCustomerSearch, reportStartDate, reportEndDate, setReportStartDate, setReportEndDate, filteredReportCollections, reportSummary, handlePrintReport, handleExportCsv, farmerSearch, setFarmerSearch, setShowAddFarmerModal, setEditingFarmer, handleEditFarmer, handleDeleteFarmer, advances, setSelectedAdvance, advanceSearch, setAdvanceSearch, handleAddAdvance, handleEditAdvance, handleDeleteAdvance } = (props as any).ctx || props;
  return (
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
                                    {!isInactive && (
                                        <Pressable style={styles.deleteBtn} onPress={() => handleDeleteFarmer(item._id, item.name)}>
                                            <Trash2 size={14} color={colors.destructive} />
                                        </Pressable>
                                    )}
                                </View>
                            </View>
  );
}
