import React, { useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, FlatList } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { Search, X, Plus, Trash2, FileText, Printer } from 'lucide-react-native';
import AmountFilterIcon from '@/components/AmountFilterIcon';

// Ponytail reusable — single source, no duplication, no UI change
export function RegisterAdvancesTab(props: any) {
  const {
    s,
    styles,
    colors,
    t,
    isDark,
    customers,
    setSelectedCustomer,
    customerSearch,
    setCustomerSearch,
    reportStartDate,
    reportEndDate,
    setReportStartDate,
    setReportEndDate,
    filteredReportCollections,
    reportSummary,
    handlePrintReport,
    handleExportCsv,
    farmerSearch,
    setFarmerSearch,
    setShowAddFarmerModal,
    setEditingFarmer,
    handleEditFarmer,
    handleDeleteFarmer,
    advances,
    setSelectedAdvance,
    advanceSearch,
    setAdvanceSearch,
    handleAddAdvance,
    handleEditAdvance,
    handleDeleteAdvance,
    generateAdvancesPDF,
    printAdvancesThermal,
    totalPendingAmount,
  } = (props as any).ctx || props;

  const [amountSort, setAmountSort] = useState<'asc' | 'desc' | null>(null);
  const toggleSort = () => setAmountSort((prev) => (prev === 'asc' ? 'desc' : 'asc'));

  const displayAdvances = useMemo(() => {
    if (!amountSort || !advances) return advances || [];
    const arr = [...advances];
    arr.sort((a: any, b: any) => {
      const av = Number(a.amount) || 0;
      const bv = Number(b.amount) || 0;
      return amountSort === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [advances, amountSort]);

  // Note: This component is a pony-tail mirror; main inline render lives in register.tsx
  // but we keep it functional for any future usage
  return (
    <View>
      {/* Search bar and PDF button + filter */}
      <View style={styles.advanceSearchRow}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 6,
            paddingHorizontal: 10,
          }}
        >
          <Search size={16} color={colors.mutedForeground} />
          <TextInput
            style={[
              styles.advanceSearchInput,
              { borderWidth: 0, backgroundColor: 'transparent', marginLeft: 8 },
            ]}
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
        <Pressable
          style={[styles.advancePdfBtn, { backgroundColor: colors.primary }]}
          onPress={printAdvancesThermal}
        >
          <Printer size={14} color={colors.white} />
          <Text style={styles.advancePdfBtnText}>Print</Text>
        </Pressable>
        <AmountFilterIcon sort={amountSort} onToggle={toggleSort} />
      </View>

      {/* Total Amount Header */}
      {advances?.length > 0 && (
        <View style={styles.totalAmountHeader}>
          <Text style={styles.totalAmountLabel}>Total Amount</Text>
          <Text style={styles.totalAmountValue}>
            ₹{(totalPendingAmount || 0).toLocaleString('en-IN')}
          </Text>
        </View>
      )}

      {/* Advances Table */}
      {displayAdvances?.length > 0 ? (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Name</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Note</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Amt</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Date</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Del</Text>
          </View>
          {displayAdvances.map((item: any) => {
            const isUsedInPayment = item.status === 'settled' || item.status === 'partial';
            return (
              <View key={item._id} style={[styles.tableRow, isUsedInPayment && styles.settledRow]}>
                <Text
                  style={[
                    styles.tableCell,
                    { flex: 0.5, color: colors.primary, textAlign: 'center' },
                  ]}
                >
                  {item.farmer?.code}
                </Text>
                <Text style={[styles.tableCell, { flex: 1.3, textAlign: 'center' }]}>
                  {item.farmer?.name || '-'}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'center' }]}>
                  {item.note || '-'}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { flex: 0.7, textAlign: 'center' },
                    isUsedInPayment ? styles.settledAmountText : { color: colors.warning },
                  ]}
                >
                  ₹{item.amount}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'center' }]}>
                  {new Date(item.date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                  })}
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
      ) : null}
    </View>
  );
}
