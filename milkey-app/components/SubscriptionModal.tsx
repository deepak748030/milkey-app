import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, Pressable, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { X, Crown, Check, Star, Zap } from 'lucide-react-native';
import { Subscription, userSubscriptionsApi } from '@/lib/milkeyApi';

const { width, height } = Dimensions.get('window');

interface SubscriptionModalProps {
    visible: boolean;
    onClose: () => void;
    onSubscribe?: (subscription: Subscription) => void;
    filterTab?: 'purchase' | 'selling' | 'register';
    title?: string;
}

export function SubscriptionModal({
    visible,
    onClose,
    onSubscribe,
    filterTab,
    title = 'Choose a Subscription'
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
                let subs = res.response.subscriptions;

                // Filter by tab if specified
                if (filterTab) {
                    subs = subs.filter(s => s.applicableTabs.includes(filterTab));
                }

                // Filter out already purchased
                subs = subs.filter(s => !s.isPurchased);

                setSubscriptions(subs);
                setIsNewUser(res.response.isNewUser);
            }
        } catch (error) {
            console.error('Failed to fetch subscriptions:', error);
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
        return tabs.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ');
    };

    const styles = createStyles(colors, isDark);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <Crown size={24} color={colors.primary} />
                            <Text style={styles.title}>{title}</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color={colors.mutedForeground} />
                        </Pressable>
                    </View>

                    {/* Content */}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Loading subscriptions...</Text>
                        </View>
                    ) : subscriptions.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No subscriptions available</Text>
                            <Pressable onPress={onClose} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>Close</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.scrollView}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContent}
                        >
                            {isNewUser && subscriptions.some(s => s.isFree && s.forNewUsers) && (
                                <View style={styles.newUserBanner}>
                                    <Star size={18} color={colors.warning} fill={colors.warning} />
                                    <Text style={styles.newUserText}>
                                        🎉 Welcome! You're eligible for free subscriptions!
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

                                    {sub.description && (
                                        <Text style={styles.description}>{sub.description}</Text>
                                    )}

                                    {/* Applicable Tabs */}
                                    <View style={styles.tabsRow}>
                                        <Text style={styles.tabsLabel}>Access to: </Text>
                                        <Text style={styles.tabsValue}>{getTabNames(sub.applicableTabs)}</Text>
                                    </View>

                                    {/* Features */}
                                    <View style={styles.features}>
                                        {sub.applicableTabs.map((tab) => (
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
                                            <ActivityIndicator size="small" color={colors.white} />
                                        ) : (
                                            <Text style={styles.purchaseBtnText}>
                                                {sub.isFree ? 'Activate Free' : 'Subscribe Now'}
                                            </Text>
                                        )}
                                    </Pressable>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: height * 0.85,
        paddingBottom: 20,
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
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
    },
    closeBtn: {
        padding: 4,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: colors.mutedForeground,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 16,
    },
    emptyText: {
        fontSize: 16,
        color: colors.mutedForeground,
        textAlign: 'center',
    },
    closeButton: {
        backgroundColor: colors.muted,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
    },
    closeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        gap: 16,
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
        color: colors.white,
    },
});
