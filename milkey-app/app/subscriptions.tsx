import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Modal, Dimensions } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { ArrowLeft, CreditCard, Clock, CheckCircle, XCircle, Crown, Sparkles, Gift, Calendar, Zap, Check, Star, AlertCircle, X, ShieldCheck, Lock, Wallet, ChevronRight, TrendingUp } from 'lucide-react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { userSubscriptionsApi, UserSubscription, Subscription as AvailableSubscription, formatSubscriptionDuration } from '@/lib/milkeyApi';
import RazorpayPaymentModal from '@/components/RazorpayPaymentModal';
import { useSubscriptionStore } from '@/lib/subscriptionStore';

const { height } = Dimensions.get('window');

interface ErrorModalProps {
    visible: boolean;
    title: string;
    message: string;
    onClose: () => void;
}

function ErrorModal({ visible, title, message, onClose }: ErrorModalProps) {
    const { colors, isDark } = useTheme();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.6)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24,
            }}>
                <View style={{
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    padding: 24,
                    width: '100%',
                    maxWidth: 340,
                    alignItems: 'center',
                }}>
                    <View style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: `${colors.destructive}15`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                    }}>
                        <AlertCircle size={32} color={colors.destructive} />
                    </View>
                    <Text style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: colors.foreground,
                        marginBottom: 8,
                        textAlign: 'center',
                    }}>{title}</Text>
                    <Text style={{
                        fontSize: 14,
                        color: colors.mutedForeground,
                        textAlign: 'center',
                        lineHeight: 20,
                        marginBottom: 24,
                    }}>{message}</Text>
                    <Pressable
                        style={{
                            backgroundColor: colors.primary,
                            paddingVertical: 12,
                            paddingHorizontal: 32,
                            borderRadius: 10,
                            width: '100%',
                        }}
                        onPress={onClose}
                    >
                        <Text style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: '#FFFFFF',
                            textAlign: 'center',
                        }}>Got it</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

interface SuccessModalProps {
    visible: boolean;
    title: string;
    message: string;
    onClose: () => void;
}

function SuccessModal({ visible, title, message, onClose }: SuccessModalProps) {
    const { colors } = useTheme();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.6)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24,
            }}>
                <View style={{
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    padding: 24,
                    width: '100%',
                    maxWidth: 340,
                    alignItems: 'center',
                }}>
                    <View style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: `${colors.success}15`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                    }}>
                        <CheckCircle size={32} color={colors.success} />
                    </View>
                    <Text style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: colors.foreground,
                        marginBottom: 8,
                        textAlign: 'center',
                    }}>{title}</Text>
                    <Text style={{
                        fontSize: 14,
                        color: colors.mutedForeground,
                        textAlign: 'center',
                        lineHeight: 20,
                        marginBottom: 24,
                    }}>{message}</Text>
                    <Pressable
                        style={{
                            backgroundColor: colors.primary,
                            paddingVertical: 12,
                            paddingHorizontal: 32,
                            borderRadius: 10,
                            width: '100%',
                        }}
                        onPress={onClose}
                    >
                        <Text style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: '#FFFFFF',
                            textAlign: 'center',
                        }}>Continue</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

export default function SubscriptionsScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'active' | 'available'>('active');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSubscriptions, setActiveSubscriptions] = useState<UserSubscription[]>([]);
    const [availableSubscriptions, setAvailableSubscriptions] = useState<AvailableSubscription[]>([]);
    const [isNewUser, setIsNewUser] = useState(false);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });
    const [successModal, setSuccessModal] = useState({ visible: false, title: '', message: '' });
    // Track multiplier per subscription (for extending duration)
    const [multipliers, setMultipliers] = useState<Record<string, number>>({});
    // Razorpay Payment states
    const [showRazorpay, setShowRazorpay] = useState(false);
    const [pendingSubscription, setPendingSubscription] = useState<AvailableSubscription | null>(null);
    const [pendingOrderId, setPendingOrderId] = useState<string>('');
    // Active subscription warning modal
    const [showActiveWarning, setShowActiveWarning] = useState(false);

    const styles = createStyles(colors, isDark);

    // Get multiplier for a subscription (default 1)
    const getMultiplier = (subId: string) => multipliers[subId] || 1;

    // Set multiplier for a subscription
    const setMultiplier = (subId: string, value: number) => {
        setMultipliers(prev => ({ ...prev, [subId]: value }));
    };

    // Format duration with multiplier
    const formatDurationWithMultiplier = (sub: AvailableSubscription, mult: number) => {
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

    const fetchData = useCallback(async () => {
        try {
            const mySubsResponse = await userSubscriptionsApi.getMy();
            if (mySubsResponse.success && mySubsResponse.response) {
                setActiveSubscriptions(mySubsResponse.response.active || []);
            }

            const availableResponse = await userSubscriptionsApi.getAvailable();
            if (availableResponse.success && availableResponse.response) {
                const subs = (availableResponse.response as any).subscriptions || (availableResponse.response as any).data || [];
                setAvailableSubscriptions(subs);
                setIsNewUser((availableResponse.response as any).isNewUser || false);
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

    const generateOrderId = () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `SUB${timestamp}${random}`;
    };

    const handlePurchase = async (subscriptionId: string) => {
        const subscription = availableSubscriptions.find(s => s._id === subscriptionId);
        if (!subscription) return;

        // Check if user already has an active subscription
        if (activeSubscriptions.length > 0) {
            setShowActiveWarning(true);
            return;
        }

        const multiplier = getMultiplier(subscriptionId);
        const totalPrice = subscription.amount * multiplier;

        // For paid subscriptions, create pending record first, then show Razorpay
        if (!subscription.isFree && totalPrice > 0) {
            const orderId = generateOrderId();

            try {
                // Create pending subscription BEFORE showing payment modal
                const pendingResult = await userSubscriptionsApi.createPending({
                    subscriptionId,
                    transactionId: orderId,
                    multiplier
                });

                if (!pendingResult.success) {
                    setErrorModal({
                        visible: true,
                        title: 'Error',
                        message: pendingResult.message || 'Failed to initialize payment'
                    });
                    return;
                }

                // Pending subscription created, now show payment modal
                setPendingOrderId(orderId);
                setPendingSubscription(subscription);
                setShowRazorpay(true);
            } catch (error: any) {
                console.error('Error creating pending subscription:', error);
                setErrorModal({
                    visible: true,
                    title: 'Error',
                    message: 'Failed to initialize payment. Please try again.'
                });
            }
            return;
        }

        // For free subscriptions, proceed directly
        await completePurchase(subscriptionId, multiplier);
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
            const response = await userSubscriptionsApi.activatePending({
                transactionId
            });
            if (response.success) {
                // Clear subscription cache to force refresh
                useSubscriptionStore.getState().clearCache();

                await fetchData();
                setActiveTab('active');

                setSuccessModal({
                    visible: true,
                    title: 'Subscription Activated!',
                    message: response.message || 'Your subscription is now active.'
                });
            }
        } catch (error: any) {
            console.error('Error activating subscription:', error);
            setErrorModal({
                visible: true,
                title: 'Activation Failed',
                message: 'Payment received but activation failed. Please contact support or try reopening the app.'
            });
        } finally {
            setPurchasing(null);
        }
    };

    const completePurchase = async (subscriptionId: string, multiplier: number, transactionId?: string) => {
        setPurchasing(subscriptionId);
        try {
            const response = await userSubscriptionsApi.purchase({
                subscriptionId,
                multiplier,
                paymentMethod: transactionId ? 'upi' : 'free',
                transactionId
            });
            if (response.success) {
                // Clear subscription cache to force refresh
                useSubscriptionStore.getState().clearCache();

                // Clear multiplier after successful purchase
                setMultipliers(prev => {
                    const newState = { ...prev };
                    delete newState[subscriptionId];
                    return newState;
                });
                await fetchData();
                setActiveTab('active');

                // Show success message
                const isQueued = response.isQueued;
                if (isQueued) {
                    setSuccessModal({
                        visible: true,
                        title: 'Subscription Queued!',
                        message: response.message || 'Your subscription has been queued and will start after your current subscription ends.'
                    });
                } else {
                    setSuccessModal({
                        visible: true,
                        title: 'Subscription Activated!',
                        message: response.message || 'Your subscription is now active.'
                    });
                }
            }
        } catch (error: any) {
            console.error('Error purchasing subscription:', error);
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to purchase subscription';
            const errorCode = error?.response?.data?.errorCode;

            if (errorCode === 'ALREADY_SUBSCRIBED') {
                setErrorModal({
                    visible: true,
                    title: 'Already Subscribed',
                    message: 'You already have this subscription active. Please wait for it to expire or choose a different plan.'
                });
            } else if (errorCode === 'TABS_ALREADY_COVERED') {
                setErrorModal({
                    visible: true,
                    title: 'Tabs Already Covered',
                    message: errorMessage
                });
            } else {
                setErrorModal({
                    visible: true,
                    title: 'Purchase Failed',
                    message: errorMessage
                });
            }
        } finally {
            setPurchasing(null);
        }
    };

    const getTypeIcon = (type?: string) => {
        switch (type) {
            case 'free': return Star;
            case 'combined': return Crown;
            default: return Zap;
        }
    };

    const getTypeLabel = (sub: AvailableSubscription) => {
        if (sub.isFree) return 'FREE';
        if (sub.subscriptionType === 'combined') return 'COMBO';
        return 'SINGLE';
    };

    const getTabNames = (tabs: string[]) => {
        if (!tabs || tabs.length === 0) return '';
        return tabs.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ');
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
        const subscriptionName = item.lockedSubscriptionName || item.subscription?.name || 'Subscription';
        const subscriptionType = item.subscription?.subscriptionType || (item.isFree ? 'free' : (item.applicableTabs?.length > 1 ? 'combined' : 'single'));
        const daysRemaining = getDaysRemaining(item.endDate);
        const isQueued = new Date(item.startDate) > new Date();
        const TypeIcon = getTypeIcon(subscriptionType);
        const isFree = subscriptionType === 'free';
        const isCombo = subscriptionType === 'combined';
        return (
            <View key={item._id} style={[styles.subscriptionCard, isQueued ? styles.queuedCard : styles.activeCard]}>
                <View style={[styles.cardAccent, isQueued ? styles.accentQueued : isFree ? styles.accentFree : isCombo ? styles.accentCombo : styles.accentActive]} />
                <View style={styles.badgesRow}>
                    <View style={[styles.typeBadge, isQueued ? styles.badgeQueued : isFree ? styles.badgeFree : isCombo ? styles.badgeCombo : styles.badgeSingle]}>
                        <TypeIcon size={14} color={isQueued ? colors.warning : isFree ? '#92400e' : '#fff'} fill={isFree ? colors.warning : undefined} />
                        <Text style={[styles.typeBadgeText, isQueued ? styles.typeBadgeTextWarn : isFree ? styles.typeBadgeTextFree : styles.typeBadgeTextOnDark]}>{isQueued ? 'QUEUED' : isFree ? 'FREE ACTIVE' : isCombo ? 'COMBO ACTIVE' : 'ACTIVE'}</Text>
                    </View>
                    {!isQueued && (
                        <View style={styles.saveBadge}>
                            <Clock size={10} color={daysRemaining <= 7 ? '#92400e' : '#065f46'} />
                            <Text style={[styles.saveBadgeText, { color: daysRemaining <= 7 ? '#92400e' : '#065f46' }]}>{daysRemaining}d left</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.subscriptionName}>{subscriptionName}</Text>
                {(item.multiplier && item.multiplier > 1) || item.baseAmount ? (
                    <View style={styles.lockedInfoContainer}>
                        <Wallet size={12} color={colors.primary} />
                        <Text style={styles.lockedInfoText}>Paid: ₹{item.amount}{item.multiplier && item.multiplier > 1 ? ` (${item.multiplier}× plan)` : ''}</Text>
                    </View>
                ) : null}
                <View style={styles.cardDetails}>
                    {isQueued && (
                        <View style={styles.detailRow}>
                            <Calendar size={14} color={colors.warning} />
                            <Text style={[styles.detailText, { color: colors.warning }]}>Starts: {formatDate(item.startDate)}</Text>
                        </View>
                    )}
                    <View style={styles.detailRow}>
                        <Calendar size={14} color={colors.mutedForeground} />
                        <Text style={styles.detailText}>Valid till: {formatDate(item.endDate)}</Text>
                    </View>
                    {!isQueued && (
                        <View style={styles.detailRow}>
                            <TrendingUp size={14} color={daysRemaining <= 7 ? colors.warning : colors.success} />
                            <Text style={[styles.detailText, daysRemaining <= 7 && { color: colors.warning, fontWeight: '700' }]}>{daysRemaining} days remaining</Text>
                        </View>
                    )}
                </View>
                <View style={styles.tabsContainer}>
                    <ShieldCheck size={12} color={colors.mutedForeground} />
                    <Text style={styles.tabsLabel}>Covers: </Text>
                    <Text style={styles.tabsValue}>{getTabNames(item.applicableTabs || item.subscription.applicableTabs || [])}</Text>
                </View>
                <View style={styles.activeFooter}>
                    <CheckCircle size={14} color={colors.success} />
                    <Text style={styles.activeFooterText}>{isQueued ? 'Will auto-activate after current plan' : 'Premium access unlocked'}</Text>
                </View>
            </View>
        );
    };

    const renderAvailableSubscription = (item: AvailableSubscription) => {
        const TypeIcon = getTypeIcon(item.subscriptionType);
        const isPurchasing = purchasing === item._id;
        const isPurchased = item.isPurchased || false;
        const isFree = !!item.isFree;
        const isCombo = item.subscriptionType === 'combined';
        const typeLabel = getTypeLabel(item);
        const multiplier = getMultiplier(item._id);
        const totalPrice = item.amount * multiplier;
        const perMonthApprox = (() => {
            const baseValue = item.durationValue || 1;
            const baseType = item.durationType || 'months';
            let months = baseValue;
            if (baseType === 'days') months = baseValue / 30;
            if (baseType === 'years') months = baseValue * 12;
            months = months * multiplier;
            if (months <= 0) return null;
            return Math.round(totalPrice / months);
        })();

        return (
            <View key={item._id} style={[styles.availableCard, isFree && styles.freeCard, isCombo && styles.comboCard]}>
                <View style={[styles.cardAccent, isFree ? styles.accentFree : isCombo ? styles.accentCombo : styles.accentSingle]} />
                <View style={styles.badgesRow}>
                    <View style={[styles.typeBadge, isFree ? styles.badgeFree : isCombo ? styles.badgeCombo : styles.badgeSingle]}>
                        <TypeIcon size={14} color={isFree ? '#92400e' : '#fff'} fill={isFree ? colors.warning : undefined} />
                        <Text style={[styles.typeBadgeText, isFree ? styles.typeBadgeTextFree : styles.typeBadgeTextOnDark]}>{isFree ? 'FREE TRIAL' : isCombo ? 'BEST VALUE' : 'POPULAR'}</Text>
                    </View>
                    {!isFree && isCombo && (
                        <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>Save 30%</Text></View>
                    )}
                    {isFree && isNewUser && item.forNewUsers && (
                        <View style={styles.newUserMiniBadge}><Gift size={10} color="#fff" /><Text style={styles.newUserMiniText}>New user</Text></View>
                    )}
                </View>
                <Text style={styles.availableName}>{item.name}</Text>
                {item.description ? <Text style={styles.descriptionText}>{item.description}</Text> : null}
                <View style={styles.priceBlock}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                        <Text style={[styles.priceText, isFree && styles.freePriceText]}>{isFree ? 'FREE' : `₹${totalPrice.toLocaleString('en-IN')}`}</Text>
                        <Text style={styles.durationText}>/ {formatDurationWithMultiplier(item, multiplier)}</Text>
                    </View>
                    {!isFree && perMonthApprox !== null && <Text style={styles.perMonth}>≈ ₹{perMonthApprox}/month • Billed once</Text>}
                    {!isFree && multiplier > 1 && <Text style={styles.basePriceText}>Base ₹{item.amount} × {multiplier} = ₹{totalPrice}</Text>}
                </View>
                {!isFree && !isPurchased && (
                    <View style={styles.stepperCard}>
                        <View style={styles.stepperHeader}>
                            <Clock size={14} color={colors.mutedForeground} />
                            <Text style={styles.stepperLabel}>Duration</Text>
                            <Text style={styles.stepperValue}>{formatDurationWithMultiplier(item, multiplier)}</Text>
                        </View>
                        <View style={styles.stepperRow}>
                            <Pressable onPress={() => multiplier > 1 && setMultiplier(item._id, multiplier - 1)} disabled={multiplier <= 1} style={[styles.stepBtn, multiplier <= 1 && styles.stepBtnDisabled]}>
                                <Text style={[styles.stepBtnText, multiplier <= 1 && styles.stepBtnTextDisabled]}>–</Text>
                            </Pressable>
                            <View style={styles.stepValueBox}>
                                <Text style={styles.stepValueText}>{multiplier}×</Text>
                                <Text style={styles.stepValueSub}>{formatDurationWithMultiplier(item, multiplier)}</Text>
                            </View>
                            <Pressable onPress={() => setMultiplier(item._id, multiplier + 1)} style={styles.stepBtn}>
                                <Text style={styles.stepBtnText}>+</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
                <View style={styles.metaRow}>
                    <View style={styles.metaPill}>
                        <Wallet size={12} color={colors.mutedForeground} />
                        <Text style={styles.metaText}>{getTabNames(item.applicableTabs)}</Text>
                    </View>
                </View>
                <View style={styles.featuresContainer}>
                    {item.applicableTabs?.map((tab) => (
                        <View key={tab} style={styles.featureRow}>
                            <View style={styles.checkCircle}><Check size={10} color="#fff" strokeWidth={3} /></View>
                            <Text style={styles.featureText}>{tab.charAt(0).toUpperCase() + tab.slice(1)} access unlocked</Text>
                        </View>
                    ))}
                    <View style={styles.featureRow}>
                        <View style={styles.checkCircle}><Check size={10} color="#fff" strokeWidth={3} /></View>
                        <Text style={styles.featureText}>{formatDurationWithMultiplier(item, multiplier)} validity • Instant activation</Text>
                    </View>
                    <View style={styles.featureRow}>
                        <View style={[styles.checkCircle, { backgroundColor: isDark ? '#334155' : '#e5e7eb' }]}><ShieldCheck size={10} color={isDark ? '#9ca3af' : '#6b7280'} /></View>
                        <Text style={[styles.featureText, { color: colors.mutedForeground }]}>Secure payment • No hidden charges</Text>
                    </View>
                </View>
                <Pressable
                    style={({ pressed }: any) => [styles.purchaseButton, isPurchased ? styles.purchasedButton : isFree ? styles.freePurchaseButton : isCombo ? styles.comboPurchaseButton : styles.singlePurchaseButton, pressed && { opacity: 0.92 }]}
                    onPress={() => !isPurchased && handlePurchase(item._id)}
                    disabled={isPurchased || !!isPurchasing}
                >
                    {isPurchasing ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.purchaseButtonText}>{isPurchased ? 'Already Subscribed' : isFree ? 'Start Free Plan' : `Pay ₹${totalPrice.toLocaleString('en-IN')}`}</Text>
                            {!isPurchased && <View style={styles.ctaArrow}><ChevronRight size={14} color="#fff" /></View>}
                        </View>
                    )}
                </Pressable>
                {!isFree && !isPurchased && <Text style={styles.ctaNote}><Lock size={10} color={colors.mutedForeground} />  100% safe & encrypted checkout</Text>}
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
                items = activeSubscriptions.map(renderActiveSubscription).filter(Boolean);
                emptyMessage = 'No active subscriptions';
                break;
            case 'available':
                items = availableSubscriptions.map(renderAvailableSubscription).filter(Boolean);
                emptyMessage = 'No subscriptions available';
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
                <Text style={styles.headerTitle}>{t.subscriptions.title}</Text>
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

            <ErrorModal
                visible={errorModal.visible}
                title={errorModal.title}
                message={errorModal.message}
                onClose={() => setErrorModal({ visible: false, title: '', message: '' })}
            />

            <SuccessModal
                visible={successModal.visible}
                title={successModal.title}
                message={successModal.message}
                onClose={() => setSuccessModal({ visible: false, title: '', message: '' })}
            />

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

            {/* Active Subscription Warning Bottom Sheet */}
            <Modal
                visible={showActiveWarning}
                transparent
                animationType="slide"
                onRequestClose={() => setShowActiveWarning(false)}
            >
                <Pressable
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'flex-end',
                    }}
                    onPress={() => setShowActiveWarning(false)}
                >
                    <Pressable
                        style={{
                            backgroundColor: colors.card,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            padding: 24,
                            paddingBottom: 40,
                        }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={{
                            width: 40,
                            height: 4,
                            backgroundColor: colors.border,
                            borderRadius: 2,
                            alignSelf: 'center',
                            marginBottom: 20,
                        }} />
                        <View style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            backgroundColor: `${colors.warning || colors.primary}15`,
                            alignItems: 'center',
                            justifyContent: 'center',
                            alignSelf: 'center',
                            marginBottom: 16,
                        }}>
                            <Crown size={32} color={colors.warning || colors.primary} />
                        </View>
                        <Text style={{
                            fontSize: 20,
                            fontWeight: '700',
                            color: colors.foreground,
                            textAlign: 'center',
                            marginBottom: 8,
                        }}>Already Subscribed</Text>
                        <Text style={{
                            fontSize: 14,
                            color: colors.mutedForeground,
                            textAlign: 'center',
                            lineHeight: 22,
                            marginBottom: 24,
                        }}>You already have an active subscription. Please wait for it to expire before purchasing a new one.</Text>
                        <Pressable
                            style={{
                                backgroundColor: colors.primary,
                                paddingVertical: 14,
                                borderRadius: 12,
                                alignItems: 'center',
                            }}
                            onPress={() => setShowActiveWarning(false)}
                        >
                            <Text style={{
                                fontSize: 16,
                                fontWeight: '600',
                                color: '#FFFFFF',
                            }}>Got it</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
        backgroundColor: colors.card,
    },
    backButton: {
        width: 38, height: 38, borderRadius: 12, backgroundColor: colors.background,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { fontSize: 17, fontWeight: '800', color: colors.foreground, letterSpacing: -0.3 },
    headerSpacer: { width: 38 },
    tabsBar: {
        flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8,
        backgroundColor: colors.background,
    },
    tab: {
        flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.card,
        alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    activeTab: {
        backgroundColor: colors.primary, borderColor: colors.primary,
        shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    },
    tabText: { fontSize: 13, fontWeight: '700', color: colors.mutedForeground },
    activeTabText: { color: '#fff' },
    scrollView: { flex: 1 },
    scrollContent: { padding: 14, paddingBottom: 32, gap: 14 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    loadingText: { fontSize: 13, color: colors.mutedForeground, fontWeight: '600' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, color: colors.mutedForeground, fontWeight: '600' },
    browseButton: {
        marginTop: 4, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: colors.primary,
        borderRadius: 12, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    },
    browseButtonText: { fontSize: 13, fontWeight: '800', color: '#fff' },
    listContainer: { gap: 14 },

    // --- Premium active card (My Subscriptions) ---
    subscriptionCard: {
        backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border,
        overflow: 'hidden', shadowColor: '#000', shadowOpacity: isDark ? 0.2 : 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
    },
    activeCard: { borderColor: `${colors.primary}30`, borderWidth: 1.2 },
    queuedCard: { borderColor: '#f59e0b', borderWidth: 1.5, backgroundColor: isDark ? '#1c1500' : '#fffbeb' },
    expiredCard: { opacity: 0.7 },
    cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
    accentActive: { backgroundColor: colors.primary },
    accentQueued: { backgroundColor: '#f59e0b' },
    accentFree: { backgroundColor: '#f59e0b' },
    accentCombo: { backgroundColor: colors.primary },
    accentSingle: { backgroundColor: isDark ? '#334155' : '#e2e8f0' },
    badgesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeFree: { backgroundColor: isDark ? '#422006' : '#fef3c7', borderWidth: 1, borderColor: isDark ? '#92400e' : '#fde68a' },
    badgeCombo: { backgroundColor: colors.primary },
    badgeSingle: { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderWidth: 1, borderColor: colors.border },
    badgeQueued: { backgroundColor: isDark ? '#422006' : '#fef3c7', borderWidth: 1, borderColor: '#fde68a' },
    typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
    typeBadgeTextFree: { color: '#92400e' },
    typeBadgeTextOnDark: { color: '#fff' },
    typeBadgeTextWarn: { color: '#92400e' },
    saveBadge: { backgroundColor: isDark ? '#064e3b' : '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: isDark ? '#047857' : '#a7f3d0', flexDirection: 'row', alignItems: 'center', gap: 4 },
    saveBadgeText: { fontSize: 10, fontWeight: '800', color: '#047857' },
    subscriptionName: { fontSize: 16, fontWeight: '800', color: colors.foreground, letterSpacing: -0.2 },
    lockedInfoContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${colors.primary}10`,
        paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: `${colors.primary}18`,
    },
    lockedInfoText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
    cardDetails: { gap: 7, marginTop: 10 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailText: { fontSize: 12, color: colors.mutedForeground, fontWeight: '500' },
    tabsContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10,
        backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 10,
    },
    tabsLabel: { fontSize: 11, color: colors.mutedForeground, fontWeight: '600' },
    tabsValue: { fontSize: 11, fontWeight: '700', color: colors.foreground },
    activeFooter: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
        backgroundColor: isDark ? '#0f2e1a' : '#f0fdf5', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#166534' : '#bbf7d0',
    },
    activeFooterText: { fontSize: 11, color: isDark ? '#86efac' : '#166534', fontWeight: '700' },

    // --- Premium available card (like modal) ---
    availableCard: {
        backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border,
        overflow: 'hidden', shadowColor: '#000', shadowOpacity: isDark ? 0.2 : 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
    },
    freeCard: { borderColor: '#f59e0b', borderWidth: 1.5 },
    comboCard: { borderColor: `${colors.primary}55`, borderWidth: 1.2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    iconContainer: {
        width: 44, height: 44, borderRadius: 12, backgroundColor: `${colors.primary}15`,
        alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: `${colors.primary}18`,
    },
    queuedIconContainer: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
    expiredIcon: { backgroundColor: colors.muted },
    cardHeaderInfo: { flex: 1 },
    expiredText: { color: colors.mutedForeground },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    queuedBadge: {},
    expiredBadge: {},
    statusText: { fontSize: 11, fontWeight: '700', color: colors.success },
    typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
    freeBadgeText: { color: '#92400e' },
    newUserBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success,
        paddingVertical: 6, marginTop: -14, marginHorizontal: -14, marginBottom: 12, borderTopLeftRadius: 14, borderTopRightRadius: 14, gap: 6,
    },
    newUserText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    newUserMiniBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success,
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 6,
    },
    newUserMiniText: { fontSize: 10, fontWeight: '700', color: '#fff' },
    availableName: { fontSize: 16, fontWeight: '800', color: colors.foreground, letterSpacing: -0.2 },
    priceBlock: {
        marginTop: 8, marginBottom: 10, backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border,
    },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    priceText: { fontSize: 24, fontWeight: '900', color: colors.foreground, letterSpacing: -0.5 },
    freePriceText: { color: '#f59e0b' },
    durationText: { fontSize: 11, color: colors.mutedForeground, fontWeight: '700' },
    perMonth: { fontSize: 11, color: colors.mutedForeground, fontWeight: '600', marginTop: 2 },
    descriptionText: { fontSize: 12, color: colors.mutedForeground, lineHeight: 16, marginTop: 6, fontWeight: '500' },
    basePriceText: { fontSize: 11, color: colors.mutedForeground, marginTop: 4, fontWeight: '500' },
    stepperCard: {
        backgroundColor: isDark ? '#0f172a' : '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.border,
        padding: 10, marginBottom: 10,
    },
    stepperHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    stepperLabel: { fontSize: 12, fontWeight: '700', color: colors.foreground, flex: 1 },
    stepperValue: {
        fontSize: 11, fontWeight: '700', color: colors.primary, backgroundColor: `${colors.primary}15`,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
    },
    stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    stepBtn: {
        width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    },
    stepBtnDisabled: { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 },
    stepBtnText: { fontSize: 20, fontWeight: '800', color: '#fff' },
    stepBtnTextDisabled: { color: colors.mutedForeground },
    stepValueBox: {
        flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background,
        borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: 6,
    },
    stepValueText: { fontSize: 15, fontWeight: '900', color: colors.foreground },
    stepValueSub: { fontSize: 10, fontWeight: '600', color: colors.mutedForeground, marginTop: 1 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    metaPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    },
    metaText: { fontSize: 11, fontWeight: '700', color: colors.foreground },
    featuresContainer: {
        gap: 7, marginBottom: 10, backgroundColor: isDark ? 'transparent' : '#fff',
        borderRadius: 10, padding: isDark ? 0 : 6, borderWidth: isDark ? 0 : 1, borderColor: isDark ? 'transparent' : '#f1f5f9',
    },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    featureText: { fontSize: 12, color: colors.foreground, fontWeight: '600', flex: 1 },
    purchaseButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 13, borderRadius: 12, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    purchasedButton: { backgroundColor: colors.muted, shadowOpacity: 0, elevation: 0 },
    freePurchaseButton: { backgroundColor: '#f59e0b' },
    comboPurchaseButton: { backgroundColor: colors.primary },
    singlePurchaseButton: { backgroundColor: isDark ? '#334155' : '#0f172a' },
    purchaseButtonText: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
    ctaArrow: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
    ctaNote: { fontSize: 10, color: colors.mutedForeground, textAlign: 'center', marginTop: 6, fontWeight: '500' },
    // legacy kept for compat
    tabsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    tabsRowLabel: { fontSize: 11, color: colors.mutedForeground },
    tabsRowValue: { fontSize: 11, fontWeight: '700', color: colors.foreground },
    multiplierContainer: { marginBottom: 10, padding: 12, backgroundColor: colors.secondary, borderRadius: 10 },
    multiplierLabel: { fontSize: 12, fontWeight: '700', color: colors.foreground, marginBottom: 8 },
    quantitySelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 },
    quantityButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    quantityButtonDisabled: { backgroundColor: colors.muted },
    quantityButtonText: { fontSize: 20, fontWeight: '800', color: '#fff' },
    quantityButtonTextDisabled: { color: colors.mutedForeground },
    quantityInputContainer: { minWidth: 60, height: 44, paddingHorizontal: 16, backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    quantityInputText: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    multiplierHint: { fontSize: 11, color: colors.primary, fontWeight: '600', textAlign: 'center' },
});
