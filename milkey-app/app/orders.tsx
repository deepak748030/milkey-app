import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Truck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ordersApi, Order } from '@/lib/milkeyApi';

export default function OrdersScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const styles = createStyles(colors, isDark, insets);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await ordersApi.getAll({ limit: 50 });
            if (res.success && res.response?.data) {
                setOrders(res.response.data);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchOrders();
    }, [fetchOrders]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <Clock size={16} color={colors.warning} />;
            case 'confirmed':
            case 'processing':
                return <Package size={16} color={colors.primary} />;
            case 'delivered':
                return <CheckCircle size={16} color={colors.success} />;
            case 'cancelled':
                return <XCircle size={16} color={colors.destructive} />;
            default:
                return <Clock size={16} color={colors.mutedForeground} />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return colors.warning;
            case 'confirmed':
            case 'processing':
                return colors.primary;
            case 'delivered':
                return colors.success;
            case 'cancelled':
                return colors.destructive;
            default:
                return colors.mutedForeground;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft size={22} color={colors.foreground} />
                    </Pressable>
                    <Text style={styles.headerTitle}>My Orders</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>My Orders</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
            >
                {orders.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Package size={60} color={colors.mutedForeground} />
                        <Text style={styles.emptyTitle}>No orders yet</Text>
                        <Text style={styles.emptySubtitle}>Your order history will appear here</Text>
                        <Pressable onPress={() => router.push('/')} style={styles.shopBtn}>
                            <Text style={styles.shopBtnText}>Start Shopping</Text>
                        </Pressable>
                    </View>
                ) : (
                    orders.map((order) => (
                        <View key={order._id} style={styles.orderCard}>
                            <View style={styles.orderHeader}>
                                <View>
                                    <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
                                    <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                                    {getStatusIcon(order.status)}
                                    <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.itemsList}>
                                {order.items.map((item, index) => (
                                    <View key={index} style={styles.orderItem}>
                                        <Text style={styles.itemName}>{item.name}</Text>
                                        <Text style={styles.itemQty}>x{item.quantity}</Text>
                                        <Text style={styles.itemPrice}>₹{item.total}</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.orderFooter}>
                                <View style={styles.paymentInfo}>
                                    <Text style={styles.paymentLabel}>Payment:</Text>
                                    <Text style={[styles.paymentStatus, { color: order.paymentStatus === 'paid' ? colors.success : colors.warning }]}>
                                        {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                                    </Text>
                                </View>
                                <View style={styles.totalInfo}>
                                    <Text style={styles.totalLabel}>Total:</Text>
                                    <Text style={styles.totalAmount}>₹{order.totalAmount}</Text>
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: insets.top + 8,
        paddingHorizontal: 12,
        paddingBottom: 10,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
    },
    placeholder: {
        width: 36,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 12,
        paddingBottom: 30,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 13,
        color: colors.mutedForeground,
        marginTop: 4,
    },
    shopBtn: {
        marginTop: 20,
        backgroundColor: colors.primary,
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    shopBtnText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
    },
    orderCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    orderNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
    },
    orderDate: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    itemsList: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 10,
        marginBottom: 10,
    },
    orderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    itemName: {
        flex: 1,
        fontSize: 13,
        color: colors.foreground,
    },
    itemQty: {
        fontSize: 12,
        color: colors.mutedForeground,
        marginRight: 12,
    },
    itemPrice: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 10,
    },
    paymentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    paymentLabel: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    paymentStatus: {
        fontSize: 12,
        fontWeight: '600',
    },
    totalInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    totalLabel: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    totalAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
});