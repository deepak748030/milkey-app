import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Calendar, TrendingUp, Milk, Plus } from 'lucide-react-native';

const mockRecords = [
    { id: '1', date: 'Today', morning: '45L', evening: '38L', total: '83L', rate: '₹28/L' },
    { id: '2', date: 'Yesterday', morning: '42L', evening: '40L', total: '82L', rate: '₹28/L' },
    { id: '3', date: '14 Dec', morning: '48L', evening: '35L', total: '83L', rate: '₹27/L' },
    { id: '4', date: '13 Dec', morning: '44L', evening: '39L', total: '83L', rate: '₹27/L' },
];

export default function DairyScreen() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    const styles = createStyles(colors, isDark);

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <Text style={styles.title}>Dairy Records</Text>
                <Pressable style={styles.addButton}>
                    <Plus size={20} color={colors.white} />
                </Pressable>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Summary Cards */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { backgroundColor: colors.statCard1 }]}>
                        <Milk size={20} color={colors.primary} />
                        <Text style={styles.summaryValue}>125L</Text>
                        <Text style={styles.summaryLabel}>Today's Collection</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: colors.statCard2 }]}>
                        <TrendingUp size={20} color={colors.primary} />
                        <Text style={styles.summaryValue}>₹3,500</Text>
                        <Text style={styles.summaryLabel}>Today's Earnings</Text>
                    </View>
                </View>

                {/* Records List */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Records</Text>
                    <Pressable style={styles.filterButton}>
                        <Calendar size={16} color={colors.primary} />
                        <Text style={styles.filterText}>Filter</Text>
                    </Pressable>
                </View>

                {mockRecords.map((record) => (
                    <Pressable key={record.id} style={styles.recordCard}>
                        <View style={styles.recordHeader}>
                            <Text style={styles.recordDate}>{record.date}</Text>
                            <Text style={styles.recordRate}>{record.rate}</Text>
                        </View>
                        <View style={styles.recordDetails}>
                            <View style={styles.recordItem}>
                                <Text style={styles.recordLabel}>Morning</Text>
                                <Text style={styles.recordValue}>{record.morning}</Text>
                            </View>
                            <View style={styles.recordItem}>
                                <Text style={styles.recordLabel}>Evening</Text>
                                <Text style={styles.recordValue}>{record.evening}</Text>
                            </View>
                            <View style={styles.recordItem}>
                                <Text style={styles.recordLabel}>Total</Text>
                                <Text style={[styles.recordValue, { color: colors.primary }]}>{record.total}</Text>
                            </View>
                        </View>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.foreground,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 6,
        paddingTop: 12,
        paddingBottom: 80,
    },
    summaryRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    summaryCard: {
        flex: 1,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    summaryValue: {
        fontSize: 22,
        fontWeight: '700',
        color: isDark ? colors.white : colors.foreground,
        marginTop: 8,
    },
    summaryLabel: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginTop: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    filterText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    recordCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    recordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    recordDate: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    recordRate: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    recordDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    recordItem: {
        alignItems: 'center',
    },
    recordLabel: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginBottom: 4,
    },
    recordValue: {
        fontSize: 16,
        fontWeight: '700',
        color: isDark ? colors.white : colors.foreground,
    },
});
