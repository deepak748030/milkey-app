import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Package, TrendingUp, Plus, ArrowRight } from 'lucide-react-native';

const mockProducts = [
    { id: '1', name: 'Fresh Cow Milk', stock: '250L', price: '₹52/L', sold: '180L' },
    { id: '2', name: 'Buffalo Milk', stock: '150L', price: '₹68/L', sold: '120L' },
    { id: '3', name: 'Paneer', stock: '50 Kg', price: '₹320/Kg', sold: '35 Kg' },
    { id: '4', name: 'Fresh Curd', stock: '80 Kg', price: '₹80/Kg', sold: '60 Kg' },
];

export default function SellingScreen() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    const styles = createStyles(colors, isDark);

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <Text style={styles.title}>Selling</Text>
                <Pressable style={styles.addButton}>
                    <Plus size={20} color={colors.white} />
                </Pressable>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Summary Cards */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { backgroundColor: colors.statCard1 }]}>
                        <Package size={20} color={colors.primary} />
                        <Text style={styles.summaryValue}>4</Text>
                        <Text style={styles.summaryLabel}>Products Listed</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: colors.statCard2 }]}>
                        <TrendingUp size={20} color={colors.primary} />
                        <Text style={styles.summaryValue}>₹18,500</Text>
                        <Text style={styles.summaryLabel}>Total Sales</Text>
                    </View>
                </View>

                {/* Products List */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Your Products</Text>
                    <Pressable style={styles.viewAllButton}>
                        <Text style={styles.viewAllText}>View All</Text>
                        <ArrowRight size={14} color={colors.primary} />
                    </Pressable>
                </View>

                {mockProducts.map((product) => (
                    <Pressable key={product.id} style={styles.productCard}>
                        <View style={styles.productIcon}>
                            <Text style={styles.productEmoji}>🥛</Text>
                        </View>
                        <View style={styles.productInfo}>
                            <Text style={styles.productName}>{product.name}</Text>
                            <Text style={styles.productPrice}>{product.price}</Text>
                        </View>
                        <View style={styles.productStats}>
                            <View style={styles.productStat}>
                                <Text style={styles.statLabel}>Stock</Text>
                                <Text style={styles.statValue}>{product.stock}</Text>
                            </View>
                            <View style={styles.productStat}>
                                <Text style={styles.statLabel}>Sold</Text>
                                <Text style={[styles.statValue, { color: colors.primary }]}>{product.sold}</Text>
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
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    viewAllText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    productCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    productIcon: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    productEmoji: {
        fontSize: 24,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 4,
    },
    productPrice: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    productStats: {
        flexDirection: 'row',
        gap: 16,
    },
    productStat: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 10,
        color: colors.mutedForeground,
        marginBottom: 2,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        color: isDark ? colors.white : colors.foreground,
    },
});
