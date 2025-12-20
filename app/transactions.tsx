import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, IndianRupee, Wallet, Smartphone, CreditCard, Building2 } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { transactionsApi, ServerTransaction, getToken } from '@/lib/api';
import { EmptyState } from '@/components/EmptyState';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ITEMS_PER_PAGE = 10;

const getPaymentMethodIcon = (method: string) => {
    switch (method?.toLowerCase()) {
        case 'upi':
            return <Smartphone size={16} color={colors.mutedForeground} />;
        case 'card':
            return <CreditCard size={16} color={colors.mutedForeground} />;
        case 'netbanking':
            return <Building2 size={16} color={colors.mutedForeground} />;
        default:
            return <Wallet size={16} color={colors.mutedForeground} />;
    }
};

const formatPaymentMethod = (method: string) => {
    switch (method?.toLowerCase()) {
        case 'upi':
            return 'UPI';
        case 'card':
            return 'Card';
        case 'netbanking':
            return 'Net Banking';
        case 'wallet':
            return 'Wallet';
        case 'cash':
            return 'Cash';
        default:
            return method || 'Unknown';
    }
};

export default function TransactionsScreen() {
    const [transactions, setTransactions] = useState<ServerTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const insets = useSafeAreaInsets();

    const fetchTransactions = useCallback(async (pageNum: number, append: boolean = false) => {
        try {
            const token = await getToken();
            if (!token) {
                Alert.alert('Please Login', 'You need to login to view transactions.');
                router.replace('/');
                return;
            }

            const result = await transactionsApi.getMyTransactions({
                page: pageNum,
                limit: ITEMS_PER_PAGE
            });

            const responseData = (result as any).data || result.response;
            if (result.success && responseData) {
                const newTransactions = responseData.data || responseData;
                const pagination = responseData.pagination;
                if (append) {
                    setTransactions(prev => [...prev, ...newTransactions]);
                } else {
                    setTransactions(newTransactions);
                }
                setHasMore(pagination ? pageNum < pagination.pages : false);
            } else {
                if (!append) {
                    setTransactions([]);
                }
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            if (!append) {
                setTransactions([]);
            }
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            (async () => {
                setLoading(true);
                setPage(1);
                await fetchTransactions(1, false);
                if (isActive) {
                    setLoading(false);
                }
            })();

            return () => {
                isActive = false;
            };
        }, [fetchTransactions])
    );

    const loadMore = async () => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        const nextPage = page + 1;
        await fetchTransactions(nextPage, true);
        setPage(nextPage);
        setLoadingMore(false);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const renderTransaction = ({ item }: { item: ServerTransaction }) => {
        const isRefund = item.type === 'refund';

        return (
            <Pressable
                style={styles.transactionCard}
                onPress={() => item.bookingId && router.push(`/booking-details/${item.bookingId}`)}
            >
                <View style={styles.transactionInfo}>
                    <Text style={styles.eventTitle} numberOfLines={1}>
                        {item.event?.title || 'Event'}
                    </Text>
                    <Text style={styles.bookingDate}>
                        {formatDate(item.createdAt)}
                    </Text>
                    <View style={styles.paymentMethodRow}>
                        {getPaymentMethodIcon(item.paymentMethod)}
                        <Text style={styles.paymentMethodText}>
                            {formatPaymentMethod(item.paymentMethod)}
                        </Text>
                    </View>
                </View>

                <View style={styles.amountSection}>
                    <View style={styles.amountRow}>
                        <Text style={[styles.amountSign, isRefund ? styles.refundedSign : styles.debitedSign]}>
                            {isRefund ? '+' : '-'}
                        </Text>
                        <IndianRupee size={14} color={isRefund ? colors.success : colors.foreground} />
                        <Text style={[styles.amountText, isRefund && styles.refundedAmount]}>
                            {item.amount.toLocaleString('en-IN')}
                        </Text>
                    </View>
                    <Text style={[styles.statusLabel, isRefund ? styles.refundedLabel : styles.debitedLabel]}>
                        {isRefund ? 'Refunded' : 'Debited'}
                    </Text>
                </View>
            </Pressable>
        );
    };

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>Transaction History</Text>
                <View style={styles.placeholder} />
            </View>

            {transactions.length === 0 ? (
                <EmptyState
                    title="No transactions yet"
                    actionLabel="Browse Events"
                    onAction={() => router.push('/(tabs)')}
                />
            ) : (
                <FlatList
                    data={transactions}
                    renderItem={renderTransaction}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.foreground,
    },
    placeholder: {
        width: 32,
    },
    listContent: {
        paddingHorizontal: 8,
        gap: 2,
    },
    transactionCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.border,
    },
    transactionInfo: {
        flex: 1,
        gap: 4,
    },
    eventTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.foreground,
    },
    bookingDate: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    paymentMethodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    paymentMethodText: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    amountSection: {
        alignItems: 'flex-end',
        gap: 4,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    amountSign: {
        fontSize: 16,
        fontWeight: '700',
        marginRight: 2,
    },
    debitedSign: {
        color: colors.foreground,
    },
    refundedSign: {
        color: colors.success,
    },
    amountText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
    },
    refundedAmount: {
        color: colors.success,
    },
    statusLabel: {
        fontSize: 11,
        fontWeight: '500',
    },
    debitedLabel: {
        color: colors.mutedForeground,
    },
    refundedLabel: {
        color: colors.success,
    },
    loadingMore: {
        paddingVertical: 16,
        alignItems: 'center',
    },
});
