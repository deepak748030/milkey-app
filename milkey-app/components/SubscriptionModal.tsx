import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, Pressable, StyleSheet, ActivityIndicator, Dimensions, StatusBar } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Crown, Check, Star, Zap, X } from 'lucide-react-native';
import { Subscription, userSubscriptionsApi } from '@/lib/milkeyApi';
import { useSubscriptionStore } from '@/lib/subscriptionStore';

const { width, height } = Dimensions.get('window');

interface SubscriptionModalProps {
    visible: boolean;
    onClose: () => void;
    onSubscribe?: (subscription: Subscription) => void;
    filterTab?: 'purchase' | 'selling' | 'register';
    title?: string;
    /** If true, modal covers full screen */
    fullScreen?: boolean;
}

export function SubscriptionModal({
    visible,
    onClose,
    onSubscribe,
    filterTab,
    title = 'Choose a Subscription',
    fullScreen = false,
}: SubscriptionModalProps) {
    const { colors, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [isNewUser, setIsNewUser] = useState(false);
    const [purchasing, setPurchasing] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            fetchSubscriptions();
        }
    }, [visible, filterTab]);

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            const res = await userSubscriptionsApi.getAvailable();

            if (res.success && res.response) {
                let subs = res.response.subscriptions || [];

                // Filter by tab if specified
                if (filterTab) {
                    subs = subs.filter(s =>
                        s.applicableTabs?.includes(filterTab) ||
                        s.subscriptionType === 'combined'
                    );
                }

                // Filter out already purchased
                subs = subs.filter(s => !s.isPurchased);

                setSubscriptions(subs);
                setIsNewUser(res.response.isNewUser);
            }
        } catch (error) {
            console.error('Failed to fetch subscriptions:', error);
            setSubscriptions([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (subscription: Subscription) => {
        setPurchasing(subscription._id);
        try {
            const res = await userSubscriptionsApi.purchase({
                subscriptionId: subscription._id,
                paymentMethod: subscription.isFree ? 'free' : 'cash'
            });

            if (res.success) {
                // Clear subscription cache to force refresh
                useSubscriptionStore.getState().clearCache();

                if (onSubscribe) {
                    onSubscribe(subscription);
                }
                onClose();
            }
        } catch (error) {
            console.error('Failed to purchase subscription:', error);
        } finally {
            setPurchasing(null);
        }
    };

    const getTypeIcon = (sub: Subscription) => {
        if (sub.isFree) return <Star size={16} color={colors.warning} fill={colors.warning} />;
        if (sub.subscriptionType === 'combined') return <Crown size={16} color={colors.primary} />;
        return <Zap size={16} color={colors.primary} />;
    };

    const getTypeLabel = (sub: Subscription) => {
        if (sub.isFree) return 'FREE';
        if (sub.subscriptionType === 'combined') return 'COMBO';
        return 'SINGLE';
    };

    const getTabNames = (tabs: string[]) => {
        if (!tabs || tabs.length === 0) return '';
        return tabs.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ');
    };

    const styles = createStyles(colors, isDark, fullScreen);

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading subscriptions...</Text>
                </View>
            );
        }

        if (subscriptions.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Crown size={48} color={colors.mutedForeground} />
                    <Text style={styles.emptyTitle}>Subscription Required</Text>
                    <Text style={styles.emptyText}>
                        {filterTab
                            ? `You need an active subscription to access the ${filterTab.charAt(0).toUpperCase() + filterTab.slice(1)} section.`
                            : 'No subscriptions available at the moment.'
                        }
                    </Text>
                    <Text style={styles.emptySubtext}>
                        Please contact support or try again later.
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.scrollContent}
                nestedScrollEnabled={true}
            >
                {isNewUser && subscriptions.some(s => s.isFree && s.forNewUsers) && (
                    <View style={styles.newUserBanner}>
                        <Star size={18} color={colors.warning} fill={colors.warning} />
                        <Text style={styles.newUserText}>
                            🎉 Welcome! You're eligible for free subscriptions!
                        </Text>
                    </View>
                )}

                {/* Tab-specific info banner */}
                {filterTab && (
                    <View style={styles.infoBanner}>
                        <Text style={styles.infoBannerText}>
                            Subscribe to access{' '}
                            <Text style={styles.infoBannerHighlight}>
                                {filterTab.charAt(0).toUpperCase() + filterTab.slice(1)}
                            </Text>{' '}
                            features
                        </Text>
                    </View>
                )}

                {subscriptions.map((sub) => (
                    <View
                        key={sub._id}
                        style={[
                            styles.subscriptionCard,
                            sub.isFree && styles.freeCard
                        ]}
                    >
                        {/* Type Badge */}
                        <View style={[
                            styles.typeBadge,
                            sub.isFree ? styles.freeBadge :
                                sub.subscriptionType === 'combined' ? styles.comboBadge :
                                    styles.singleBadge
                        ]}>
                            {getTypeIcon(sub)}
                            <Text style={[
                                styles.typeBadgeText,
                                sub.isFree && styles.freeBadgeText
                            ]}>
                                {getTypeLabel(sub)}
                            </Text>
                        </View>

                        {/* Card Content */}
                        <Text style={styles.subName}>{sub.name}</Text>

                        <View style={styles.priceRow}>
                            <Text style={[
                                styles.price,
                                sub.isFree && styles.freePrice
                            ]}>
                                {sub.isFree ? 'FREE' : `₹${sub.amount}`}
                            </Text>
                            <Text style={styles.duration}>
                                / {sub.durationMonths} {sub.durationMonths === 1 ? 'month' : 'months'}
                            </Text>
                        </View>

                        {sub.description ? (
                            <Text style={styles.description}>{sub.description}</Text>
                        ) : null}

                        {/* Applicable Tabs */}
                        <View style={styles.tabsRow}>
                            <Text style={styles.tabsLabel}>Access to: </Text>
                            <Text style={styles.tabsValue}>{getTabNames(sub.applicableTabs)}</Text>
                        </View>

                        {/* Features */}
                        <View style={styles.features}>
                            {sub.applicableTabs?.map((tab) => (
                                <View key={tab} style={styles.featureItem}>
                                    <Check size={14} color={colors.primary} />
                                    <Text style={styles.featureText}>
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)} Tab Access
                                    </Text>
                                </View>
                            ))}
                            <View style={styles.featureItem}>
                                <Check size={14} color={colors.primary} />
                                <Text style={styles.featureText}>
                                    {sub.durationMonths} Month{sub.durationMonths > 1 ? 's' : ''} Validity
                                </Text>
                            </View>
                        </View>

                        {/* Purchase Button */}
                        <Pressable
                            style={[
                                styles.purchaseBtn,
                                sub.isFree && styles.freePurchaseBtn,
                                purchasing === sub._id && styles.purchasingBtn
                            ]}
                            onPress={() => handlePurchase(sub)}
                            disabled={purchasing !== null}
                        >
                            {purchasing === sub._id ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.purchaseBtnText}>
                                    {sub.isFree ? 'Activate Free' : 'Subscribe Now'}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                ))}
            </ScrollView>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={!fullScreen}
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent={fullScreen}
        >
            <StatusBar
                backgroundColor={fullScreen ? colors.background : 'rgba(0,0,0,0.6)'}
                barStyle={isDark ? 'light-content' : 'dark-content'}
            />
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <Crown size={24} color={colors.primary} />
                            <Text style={styles.title}>{title}</Text>
                        </View>
                        <Pressable style={styles.closeBtn} onPress={onClose}>
                            <X size={22} color={colors.foreground} />
                        </Pressable>
                    </View>

                    {/* Content */}
                    {renderContent()}
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: any, isDark: boolean, fullScreen: boolean) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: fullScreen ? colors.background : 'rgba(0, 0, 0, 0.6)',
        justifyContent: fullScreen ? 'flex-start' : 'flex-end',
    },
    container: {
        backgroundColor: colors.background,
        borderTopLeftRadius: fullScreen ? 0 : 24,
        borderTopRightRadius: fullScreen ? 0 : 24,
        height: fullScreen ? '100%' : undefined,
        maxHeight: fullScreen ? '100%' : height * 0.85,
        paddingBottom: 20,
        paddingTop: fullScreen ? (StatusBar.currentHeight || 44) : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.muted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.foreground,
    },
    loadingContainer: {
        padding: 60,
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 14,
        color: colors.mutedForeground,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
        marginTop: 8,
    },
    emptyText: {
        fontSize: 14,
        color: colors.mutedForeground,
        textAlign: 'center',
        lineHeight: 20,
    },
    emptySubtext: {
        fontSize: 12,
        color: colors.mutedForeground,
        textAlign: 'center',
    },
    infoBanner: {
        backgroundColor: `${colors.primary}15`,
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: `${colors.primary}30`,
    },
    infoBannerText: {
        fontSize: 14,
        color: colors.foreground,
        textAlign: 'center',
    },
    infoBannerHighlight: {
        fontWeight: '700',
        color: colors.primary,
    },
    scrollView: {
        flexGrow: 0,
        maxHeight: fullScreen ? height - 120 : height * 0.7,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    newUserBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: `${colors.warning}15`,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: `${colors.warning}30`,
        marginBottom: 16,
    },
    newUserText: {
        flex: 1,
        fontSize: 13,
        color: colors.foreground,
        fontWeight: '500',
    },
    subscriptionCard: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 16,
    },
    freeCard: {
        borderColor: colors.warning,
        borderWidth: 2,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        marginBottom: 10,
    },
    freeBadge: {
        backgroundColor: `${colors.warning}20`,
    },
    comboBadge: {
        backgroundColor: `${colors.primary}15`,
    },
    singleBadge: {
        backgroundColor: colors.muted,
    },
    typeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.primary,
    },
    freeBadgeText: {
        color: colors.warning,
    },
    subName: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
        marginBottom: 6,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        marginBottom: 8,
    },
    price: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.primary,
    },
    freePrice: {
        color: colors.warning,
    },
    duration: {
        fontSize: 14,
        color: colors.mutedForeground,
    },
    description: {
        fontSize: 13,
        color: colors.mutedForeground,
        marginBottom: 10,
        lineHeight: 18,
    },
    tabsRow: {
        flexDirection: 'row',
        alignItems: 'center',
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
    features: {
        gap: 6,
        marginBottom: 14,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    featureText: {
        fontSize: 13,
        color: colors.foreground,
    },
    purchaseBtn: {
        backgroundColor: colors.primary,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    freePurchaseBtn: {
        backgroundColor: colors.warning,
    },
    purchasingBtn: {
        opacity: 0.7,
    },
    purchaseBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
