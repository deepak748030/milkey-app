import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, Pressable, StyleSheet, ActivityIndicator, Dimensions, StatusBar, Alert } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Crown, Check, Star, Zap, X, AlertCircle, CheckCircle, Wallet } from 'lucide-react-native';
import { Subscription, userSubscriptionsApi, formatSubscriptionDuration } from '@/lib/milkeyApi';
import { useSubscriptionStore } from '@/lib/subscriptionStore';
import RazorpayPaymentModal from './RazorpayPaymentModal';

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
    const [multipliers, setMultipliers] = useState<Record<string, number>>({});
    const [showRazorpay, setShowRazorpay] = useState(false);
    const [pendingSubscription, setPendingSubscription] = useState<Subscription | null>(null);
    const [pendingOrderId, setPendingOrderId] = useState<string>('');

    const getMultiplier = (subId: string) => multipliers[subId] || 1;
    const setMultiplier = (subId: string, value: number) => {
        setMultipliers(prev => ({ ...prev, [subId]: value }));
    };

    const formatDurationWithMultiplier = (sub: Subscription, mult: number) => {
        const baseType = sub.durationType || 'months';
        const baseValue = sub.durationValue || 1;
        const totalValue = baseValue * mult;

        switch (baseType) {
            case 'days':
                return totalValue === 1 ? '1 Day' : `${totalValue} Days`;
            case 'months':
                return totalValue === 1 ? '1 Month' : `${totalValue} Months`;
            case 'years':
                return totalValue === 1 ? '1 Year' : `${totalValue} Years`;
            default:
                return `${totalValue} Months`;
        }
    };

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

    const generateOrderId = () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `SUB${timestamp}${random}`;
    };

    const handlePurchase = async (subscription: Subscription) => {
        const multiplier = getMultiplier(subscription._id);
        const totalPrice = subscription.amount * multiplier;

        // For paid subscriptions, create pending record first, then show Razorpay
        if (!subscription.isFree && totalPrice > 0) {
            const orderId = generateOrderId();

            try {
                // Create pending subscription BEFORE showing payment modal
                const pendingResult = await userSubscriptionsApi.createPending({
                    subscriptionId: subscription._id,
                    transactionId: orderId,
                    multiplier
                });

                if (!pendingResult.success) {
                    Alert.alert('Error', pendingResult.message || 'Failed to initialize payment');
                    return;
                }

                // Pending subscription created, now show payment modal
                setPendingOrderId(orderId);
                setPendingSubscription(subscription);
                setShowRazorpay(true);
            } catch (error: any) {
                console.error('Error creating pending subscription:', error);
                Alert.alert('Error', 'Failed to initialize payment. Please try again.');
            }
            return;
        }

        // For free subscriptions, proceed directly
        await completePurchase(subscription, multiplier);
    };

    const handleRazorpaySuccess = async (paymentData: any) => {
        setShowRazorpay(false);
        if (pendingSubscription) {
            // Activate the pending subscription - payment already verified by server
            await activatePendingSubscription(paymentData?.paymentId || pendingOrderId);
        }
        setPendingSubscription(null);
        setPendingOrderId('');
    };

    const activatePendingSubscription = async (transactionId: string) => {
        setPurchasing(pendingSubscription?._id || null);
        try {
            const res = await userSubscriptionsApi.activatePending({ transactionId });

            if (res.success) {
                // Clear subscription cache to force refresh
                useSubscriptionStore.getState().clearCache();

                // Clear multiplier
                if (pendingSubscription) {
                    setMultipliers(prev => {
                        const newState = { ...prev };
                        delete newState[pendingSubscription._id];
                        return newState;
                    });
                }

                if (onSubscribe && pendingSubscription) {
                    onSubscribe(pendingSubscription);
                }

                Alert.alert(
                    'Subscription Activated!',
                    'Your subscription has been activated successfully.',
                    [{ text: 'OK', onPress: onClose }]
                );
            }
        } catch (error: any) {
            console.error('Failed to activate subscription:', error);
            Alert.alert(
                'Activation Failed',
                'Payment received but activation failed. Please contact support or try reopening the app.',
                [{ text: 'OK' }]
            );
        } finally {
            setPurchasing(null);
        }
    };

    const completePurchase = async (subscription: Subscription, multiplier: number, transactionId?: string) => {
        setPurchasing(subscription._id);
        try {
            const res = await userSubscriptionsApi.purchase({
                subscriptionId: subscription._id,
                paymentMethod: subscription.isFree ? 'free' : 'upi',
                multiplier,
                transactionId
            });

            if (res.success) {
                // Clear subscription cache to force refresh
                useSubscriptionStore.getState().clearCache();

                // Clear multiplier
                setMultipliers(prev => {
                    const newState = { ...prev };
                    delete newState[subscription._id];
                    return newState;
                });

                if (onSubscribe) {
                    onSubscribe(subscription);
                }

                // Show success message for queued subscriptions
                if (res.isQueued) {
                    Alert.alert(
                        'Subscription Queued!',
                        res.message || 'Your subscription has been queued and will start after your current subscription ends.',
                        [{ text: 'OK', onPress: onClose }]
                    );
                } else {
                    Alert.alert(
                        'Subscription Activated!',
                        'Your subscription has been activated successfully.',
                        [{ text: 'OK', onPress: onClose }]
                    );
                }
            }
        } catch (error: any) {
            console.error('Failed to purchase subscription:', error);
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to purchase subscription';
            const errorCode = error?.response?.data?.errorCode;

            if (errorCode === 'ALREADY_SUBSCRIBED') {
                Alert.alert(
                    'Already Subscribed',
                    'You already have this subscription active. Please wait for it to expire or choose a different plan.',
                    [{ text: 'OK' }]
                );
            } else if (errorCode === 'TABS_ALREADY_COVERED') {
                Alert.alert(
                    'Tabs Already Covered',
                    errorMessage,
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert('Purchase Failed', errorMessage, [{ text: 'OK' }]);
            }
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

                {subscriptions.map((sub) => {
                    const multiplier = getMultiplier(sub._id);
                    const totalPrice = sub.amount * multiplier;
                    const multiplierOptions = [1, 2, 3, 6, 12];

                    return (
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
                                    {sub.isFree ? 'FREE' : `₹${totalPrice}`}
                                </Text>
                                <Text style={styles.duration}>
                                    / {formatDurationWithMultiplier(sub, multiplier)}
                                </Text>
                            </View>

                            {/* Base price info when multiplier > 1 */}
                            {!sub.isFree && multiplier > 1 && (
                                <Text style={styles.basePriceText}>
                                    Base: ₹{sub.amount} × {multiplier} = ₹{totalPrice}
                                </Text>
                            )}

                            {/* Quantity Selector - Only for paid subscriptions */}
                            {!sub.isFree && (
                                <View style={styles.multiplierContainer}>
                                    <Text style={styles.multiplierLabel}>Select Quantity:</Text>
                                    <View style={styles.quantitySelector}>
                                        <Pressable
                                            style={[styles.quantityButton, multiplier <= 1 && styles.quantityButtonDisabled]}
                                            onPress={() => multiplier > 1 && setMultiplier(sub._id, multiplier - 1)}
                                            disabled={multiplier <= 1}
                                        >
                                            <Text style={[styles.quantityButtonText, multiplier <= 1 && styles.quantityButtonTextDisabled]}>−</Text>
                                        </Pressable>
                                        <View style={styles.quantityInputContainer}>
                                            <Text style={styles.quantityInputText}>{multiplier}</Text>
                                        </View>
                                        <Pressable
                                            style={styles.quantityButton}
                                            onPress={() => setMultiplier(sub._id, multiplier + 1)}
                                        >
                                            <Text style={styles.quantityButtonText}>+</Text>
                                        </Pressable>
                                    </View>
                                    <Text style={styles.multiplierHint}>
                                        {formatDurationWithMultiplier(sub, multiplier)} for ₹{totalPrice}
                                    </Text>
                                </View>
                            )}

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
                                        {formatDurationWithMultiplier(sub, multiplier)} Validity
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
                                        {sub.isFree ? 'Activate Free' : `Subscribe for ₹${totalPrice}`}
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    );
                })}
            </ScrollView>
        );
    };

    return (
        <>
            <Modal
                visible={visible && !showRazorpay}
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

            {pendingSubscription && (
                <RazorpayPaymentModal
                    visible={showRazorpay}
                    onClose={() => {
                        setShowRazorpay(false);
                        setPendingSubscription(null);
                        setPendingOrderId('');
                    }}
                    amount={pendingSubscription.amount * getMultiplier(pendingSubscription._id)}
                    orderId={pendingOrderId}
                    description={`Subscription: ${pendingSubscription.name}`}
                    onSuccess={handleRazorpaySuccess}
                />
            )}
        </>
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
    basePriceText: {
        fontSize: 12,
        color: colors.mutedForeground,
        marginBottom: 8,
    },
    multiplierContainer: {
        marginBottom: 12,
        padding: 12,
        backgroundColor: colors.muted,
        borderRadius: 10,
    },
    multiplierLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 8,
    },
    quantitySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 8,
    },
    quantityButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityButtonDisabled: {
        backgroundColor: colors.muted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    quantityButtonText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    quantityButtonTextDisabled: {
        color: colors.mutedForeground,
    },
    quantityInputContainer: {
        minWidth: 60,
        height: 44,
        paddingHorizontal: 16,
        backgroundColor: colors.background,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityInputText: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
    },
    multiplierHint: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '500',
        textAlign: 'center',
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
