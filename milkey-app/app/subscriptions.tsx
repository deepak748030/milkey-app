import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, CreditCard, Clock, CheckCircle, XCircle, Crown, Sparkles, Gift, Calendar, Zap } from 'lucide-react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { userSubscriptionsApi, UserSubscription, Subscription as AvailableSubscription } from '@/lib/milkeyApi';

export default function SubscriptionsScreen() {
    const { colors, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<'active' | 'available' | 'expired'>('active');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSubscriptions, setActiveSubscriptions] = useState<UserSubscription[]>([]);
    const [expiredSubscriptions, setExpiredSubscriptions] = useState<UserSubscription[]>([]);
    const [availableSubscriptions, setAvailableSubscriptions] = useState<AvailableSubscription[]>([]);
    const [isNewUser, setIsNewUser] = useState(false);
    const [purchasing, setPurchasing] = useState<string | null>(null);

    const styles = createStyles(colors, isDark);

    const fetchData = useCallback(async () => {
        try {
            // Fetch user's subscriptions
            const mySubsResponse = await userSubscriptionsApi.getMy();
            if (mySubsResponse.success && mySubsResponse.response) {
                setActiveSubscriptions(mySubsResponse.response.active || []);
                setExpiredSubscriptions(mySubsResponse.response.expired || []);
            }

            // Fetch available subscriptions
            const availableResponse = await userSubscriptionsApi.getAvailable();
            if (availableResponse.success && availableResponse.response) {
                setAvailableSubscriptions(availableResponse.response.subscriptions || []);
                setIsNewUser(availableResponse.response.isNewUser || false);
            }
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    const handlePurchase = async (subscriptionId: string) => {
        setPurchasing(subscriptionId);
        try {
            const response = await userSubscriptionsApi.purchase({ subscriptionId });
            if (response.success) {
                await fetchData();
                setActiveTab('active');
            }
        } catch (error) {
            console.error('Error purchasing subscription:', error);
        } finally {
            setPurchasing(null);
        }
    };

    const getTypeIcon = (type?: string) => {
        switch (type) {
            case 'free': return Gift;
            case 'combo': return Crown;
            default: return Sparkles;
        }
    };

    const getTabNames = (tabs: string[]) => {
        return tabs.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const getDaysRemaining = (endDate: string) => {
        const end = new Date(endDate);
        const now = new Date();
        const diffTime = end.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const renderActiveSubscription = (item: UserSubscription) => {
        const daysRemaining = getDaysRemaining(item.endDate);
        const TypeIcon = getTypeIcon(item.subscription.subscriptionType);

        return (
            <View key={item._id} style={styles.subscriptionCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                        <TypeIcon size={24} color={colors.primary} />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                        <Text style={styles.subscriptionName}>{item.subscription.name}</Text>
                        <View style={styles.statusBadge}>
                            <CheckCircle size={12} color={colors.success} />
                            <Text style={styles.statusText}>Active</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                        <Calendar size={14} color={colors.mutedForeground} />
                        <Text style={styles.detailText}>Valid till: {formatDate(item.endDate)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Clock size={14} color={daysRemaining <= 7 ? colors.warning : colors.mutedForeground} />
                        <Text style={[styles.detailText, daysRemaining <= 7 && { color: colors.warning }]}>
                            {daysRemaining} days remaining
                        </Text>
                    </View>
                </View>

                <View style={styles.tabsContainer}>
                    <Text style={styles.tabsLabel}>Covers: </Text>
                    <Text style={styles.tabsValue}>{getTabNames(item.subscription.applicableTabs)}</Text>
                </View>
            </View>
        );
    };

    const renderExpiredSubscription = (item: UserSubscription) => {
        const TypeIcon = getTypeIcon(item.subscription.subscriptionType);

        return (
            <View key={item._id} style={[styles.subscriptionCard, styles.expiredCard]}>
                <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, styles.expiredIcon]}>
                        <TypeIcon size={24} color={colors.mutedForeground} />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                        <Text style={[styles.subscriptionName, styles.expiredText]}>{item.subscription.name}</Text>
                        <View style={[styles.statusBadge, styles.expiredBadge]}>
                            <XCircle size={12} color={colors.destructive} />
                            <Text style={[styles.statusText, { color: colors.destructive }]}>Expired</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                        <Calendar size={14} color={colors.mutedForeground} />
                        <Text style={styles.detailText}>Expired on: {formatDate(item.endDate)}</Text>
                    </View>
                </View>

                <View style={styles.tabsContainer}>
                    <Text style={styles.tabsLabel}>Covered: </Text>
                    <Text style={styles.tabsValue}>{getTabNames(item.subscription.applicableTabs)}</Text>
                </View>
            </View>
        );
    };

    const renderAvailableSubscription = (item: AvailableSubscription) => {
        const TypeIcon = getTypeIcon(item.subscriptionType);
        const isPurchasing = purchasing === item._id;
        const isPurchased = item.isPurchased || false;

        return (
            <View key={item._id} style={styles.subscriptionCard}>
                {item.isFree && isNewUser && (
                    <View style={styles.newUserBanner}>
                        <Gift size={14} color={colors.white} />
                        <Text style={styles.newUserText}>Free for New Users!</Text>
                    </View>
                )}

                <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                        <TypeIcon size={24} color={colors.primary} />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                        <Text style={styles.subscriptionName}>{item.name}</Text>
                        <View style={styles.priceContainer}>
                            {item.isFree ? (
                                <Text style={styles.freeText}>FREE</Text>
                            ) : (
                                <Text style={styles.priceText}>₹{item.amount}</Text>
                            )}
                            <Text style={styles.durationText}>/ {item.durationMonths} month{item.durationMonths > 1 ? 's' : ''}</Text>
                        </View>
                    </View>
                </View>

                {item.description && (
                    <Text style={styles.descriptionText}>{item.description}</Text>
                )}

                <View style={styles.tabsContainer}>
                    <Text style={styles.tabsLabel}>Covers: </Text>
                    <Text style={styles.tabsValue}>{getTabNames(item.applicableTabs)}</Text>
                </View>

                <Pressable
                    style={[styles.purchaseButton, isPurchased && styles.purchasedButton]}
                    onPress={() => !isPurchased && handlePurchase(item._id)}
                    disabled={isPurchased || isPurchasing}
                >
                    {isPurchasing ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <Text style={styles.purchaseButtonText}>
                            {isPurchased ? 'Already Subscribed' : item.isFree ? 'Activate Free' : 'Subscribe Now'}
                        </Text>
                    )}
                </Pressable>
            </View>
        );
    };

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading subscriptions...</Text>
                </View>
            );
        }

        let items: React.ReactNode[] = [];
        let emptyMessage = '';

        switch (activeTab) {
            case 'active':
                items = activeSubscriptions.map(renderActiveSubscription);
                emptyMessage = 'No active subscriptions';
                break;
            case 'available':
                items = availableSubscriptions.map(renderAvailableSubscription);
                emptyMessage = 'No subscriptions available';
                break;
            case 'expired':
                items = expiredSubscriptions.map(renderExpiredSubscription);
                emptyMessage = 'No expired subscriptions';
                break;
        }

        if (items.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <CreditCard size={48} color={colors.mutedForeground} />
                    <Text style={styles.emptyText}>{emptyMessage}</Text>
                    {activeTab === 'active' && (
                        <Pressable style={styles.browseButton} onPress={() => setActiveTab('available')}>
                            <Text style={styles.browseButtonText}>Browse Available Plans</Text>
                        </Pressable>
                    )}
                </View>
            );
        }

        return <View style={styles.listContainer}>{items}</View>;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <ArrowLeft size={24} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>My Subscriptions</Text>
                <View style={styles.headerSpacer} />
            </View>

            {/* Tabs */}
            <View style={styles.tabsBar}>
                <Pressable
                    style={[styles.tab, activeTab === 'active' && styles.activeTab]}
                    onPress={() => setActiveTab('active')}
                >
                    <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
                        Active ({activeSubscriptions.length})
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.tab, activeTab === 'available' && styles.activeTab]}
                    onPress={() => setActiveTab('available')}
                >
                    <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>
                        Available ({availableSubscriptions.length})
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.tab, activeTab === 'expired' && styles.activeTab]}
                    onPress={() => setActiveTab('expired')}
                >
                    <Text style={[styles.tabText, activeTab === 'expired' && styles.activeTabText]}>
                        Expired ({expiredSubscriptions.length})
                    </Text>
                </Pressable>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
            >
                {renderContent()}
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
    },
    headerSpacer: {
        width: 40,
    },
    tabsBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: colors.secondary,
        alignItems: 'center',
    },
    activeTab: {
        backgroundColor: colors.primary,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.mutedForeground,
    },
    activeTabText: {
        color: colors.white,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: colors.mutedForeground,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
        color: colors.mutedForeground,
    },
    browseButton: {
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: colors.primary,
        borderRadius: 8,
    },
    browseButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.white,
    },
    listContainer: {
        gap: 16,
    },
    subscriptionCard: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    expiredCard: {
        opacity: 0.7,
    },
    newUserBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.success,
        paddingVertical: 8,
        marginTop: -16,
        marginHorizontal: -16,
        marginBottom: 16,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        gap: 6,
    },
    newUserText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.white,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    expiredIcon: {
        backgroundColor: colors.muted,
    },
    cardHeaderInfo: {
        flex: 1,
    },
    subscriptionName: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
        marginBottom: 4,
    },
    expiredText: {
        color: colors.mutedForeground,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    expiredBadge: {},
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.success,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    priceText: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.primary,
    },
    freeText: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.success,
    },
    durationText: {
        fontSize: 12,
        color: colors.mutedForeground,
        marginLeft: 4,
    },
    descriptionText: {
        fontSize: 13,
        color: colors.mutedForeground,
        marginBottom: 12,
        lineHeight: 18,
    },
    cardDetails: {
        gap: 6,
        marginBottom: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailText: {
        fontSize: 13,
        color: colors.mutedForeground,
    },
    tabsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: colors.secondary,
        borderRadius: 8,
        marginBottom: 12,
    },
    tabsLabel: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    tabsValue: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.foreground,
    },
    featuresContainer: {
        gap: 6,
        marginBottom: 12,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    featureText: {
        fontSize: 13,
        color: colors.foreground,
    },
    purchaseButton: {
        backgroundColor: colors.primary,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    purchasedButton: {
        backgroundColor: colors.muted,
    },
    purchaseButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.white,
    },
});
