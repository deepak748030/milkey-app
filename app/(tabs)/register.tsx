import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { ClipboardList, UserPlus, Users, CheckCircle } from 'lucide-react-native';

const mockFarmers = [
    { id: '1', name: 'Rajesh Kumar', phone: '9876543210', status: 'Active', milk: '45L/day' },
    { id: '2', name: 'Suresh Patel', phone: '9876543211', status: 'Active', milk: '38L/day' },
    { id: '3', name: 'Mohan Singh', phone: '9876543212', status: 'Pending', milk: '32L/day' },
    { id: '4', name: 'Anil Sharma', phone: '9876543213', status: 'Active', milk: '28L/day' },
];

export default function RegisterScreen() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    const styles = createStyles(colors, isDark);

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <Text style={styles.title}>Register</Text>
                <Pressable style={styles.addButton}>
                    <UserPlus size={20} color={colors.white} />
                </Pressable>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Summary Cards */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { backgroundColor: colors.statCard1 }]}>
                        <Users size={20} color={colors.primary} />
                        <Text style={styles.summaryValue}>24</Text>
                        <Text style={styles.summaryLabel}>Total Farmers</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: colors.statCard2 }]}>
                        <ClipboardList size={20} color={colors.primary} />
                        <Text style={styles.summaryValue}>3</Text>
                        <Text style={styles.summaryLabel}>Pending Approval</Text>
                    </View>
                </View>

                {/* Farmers List */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Registered Farmers</Text>
                </View>

                {mockFarmers.map((farmer) => (
                    <Pressable key={farmer.id} style={styles.farmerCard}>
                        <View style={styles.farmerAvatar}>
                            <Text style={styles.avatarText}>{farmer.name.charAt(0)}</Text>
                        </View>
                        <View style={styles.farmerInfo}>
                            <Text style={styles.farmerName}>{farmer.name}</Text>
                            <Text style={styles.farmerPhone}>{farmer.phone}</Text>
                        </View>
                        <View style={styles.farmerStats}>
                            <View style={[styles.statusBadge, { backgroundColor: farmer.status === 'Active' ? colors.success + '20' : colors.warning + '20' }]}>
                                <Text style={[styles.statusText, { color: farmer.status === 'Active' ? colors.success : colors.warning }]}>{farmer.status}</Text>
                            </View>
                            <Text style={styles.milkAmount}>{farmer.milk}</Text>
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
    farmerCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    farmerAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.white,
    },
    farmerInfo: {
        flex: 1,
    },
    farmerName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 4,
    },
    farmerPhone: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    farmerStats: {
        alignItems: 'flex-end',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
    },
    milkAmount: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.primary,
    },
});
