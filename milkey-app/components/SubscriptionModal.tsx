import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, ActivityIndicator, Dimensions, StatusBar, Alert } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { Crown, Check, Star, Zap, X, ShieldCheck, Clock, Wallet, ChevronRight, Sparkles, Lock } from 'lucide-react-native';
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
            case 'days': return totalValue === 1 ? '1 Day' : `${totalValue} Days`;
            case 'months': return totalValue === 1 ? '1 Month' : `${totalValue} Months`;
            case 'years': return totalValue === 1 ? '1 Year' : `${totalValue} Years`;
            default: return `${totalValue} Months`;
        }
    };

    useEffect(() => {
        if (visible) fetchSubscriptions();
    }, [visible, filterTab]);

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            const res = await userSubscriptionsApi.getAvailable();
            if (res.success && res.response) {
                let subs = res.response.subscriptions || [];
                if (filterTab) {
                    subs = subs.filter(s => s.applicableTabs?.includes(filterTab) || s.subscriptionType === 'combined');
                }
                subs = subs.filter(s => !s.isPurchased);
                setSubscriptions(subs);
                setIsNewUser(res.response.isNewUser);
            }
        } catch (error) {
            console.error('Failed to fetch subscriptions:', error);
            setSubscriptions([]);
        } finally { setLoading(false); }
    };

    const generateOrderId = () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `SUB${timestamp}${random}`;
    };

    const handlePurchase = async (subscription: Subscription) => {
        const multiplier = getMultiplier(subscription._id);
        const totalPrice = subscription.amount * multiplier;
        if (!subscription.isFree && totalPrice > 0) {
            const orderId = generateOrderId();
            try {
                const pendingResult = await userSubscriptionsApi.createPending({
                    subscriptionId: subscription._id,
                    transactionId: orderId,
                    multiplier
                });
                if (!pendingResult.success) {
                    Alert.alert('Error', pendingResult.message || 'Failed to initialize payment');
                    return;
                }
                setPendingOrderId(orderId);
                setPendingSubscription(subscription);
                setShowRazorpay(true);
            } catch (error: any) {
                console.error('Error creating pending subscription:', error);
                Alert.alert('Error', 'Failed to initialize payment. Please try again.');
            }
            return;
        }
        await completePurchase(subscription, multiplier);
    };

    const handleRazorpaySuccess = async (paymentData: any) => {
        setShowRazorpay(false);
        if (pendingSubscription) {
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
                useSubscriptionStore.getState().clearCache();
                if (pendingSubscription) {
                    setMultipliers(prev => {
                        const ns = { ...prev }; delete ns[pendingSubscription._id]; return ns;
                    });
                }
                if (onSubscribe && pendingSubscription) onSubscribe(pendingSubscription);
                Alert.alert('Subscription Activated!', 'Your subscription has been activated successfully.', [{ text: 'OK', onPress: onClose }]);
            }
        } catch (error: any) {
            console.error('Failed to activate subscription:', error);
            Alert.alert('Activation Failed', 'Payment received but activation failed. Please contact support or try reopening the app.', [{ text: 'OK' }]);
        } finally { setPurchasing(null); }
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
                useSubscriptionStore.getState().clearCache();
                setMultipliers(prev => { const ns = { ...prev }; delete ns[subscription._id]; return ns; });
                if (onSubscribe) onSubscribe(subscription);
                if (res.isQueued) {
                    Alert.alert('Subscription Queued!', res.message || 'Your subscription has been queued and will start after your current subscription ends.', [{ text: 'OK', onPress: onClose }]);
                } else {
                    Alert.alert('Subscription Activated!', 'Your subscription has been activated successfully.', [{ text: 'OK', onPress: onClose }]);
                }
            }
        } catch (error: any) {
            console.error('Failed to purchase subscription:', error);
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to purchase subscription';
            const errorCode = error?.response?.data?.errorCode;
            if (errorCode === 'ALREADY_SUBSCRIBED') Alert.alert('Already Subscribed', 'You already have this subscription active. Please wait for it to expire or choose a different plan.', [{ text: 'OK' }]);
            else if (errorCode === 'TABS_ALREADY_COVERED') Alert.alert('Tabs Already Covered', errorMessage, [{ text: 'OK' }]);
            else Alert.alert('Purchase Failed', errorMessage, [{ text: 'OK' }]);
        } finally { setPurchasing(null); }
    };

    const getTypeIcon = (sub: Subscription) => {
        if (sub.isFree) return <Star size={16} color={isDark ? '#f59e0b' : '#d97706'} fill={isDark ? '#f59e0b' : '#d97706'} />;
        if (sub.subscriptionType === 'combined') return <Crown size={16} color="#fff" />;
        return <Zap size={16} color="#fff" />;
    };

    const getTypeLabel = (sub: Subscription) => {
        if (sub.isFree) return 'FREE TRIAL';
        if (sub.subscriptionType === 'combined') return 'BEST VALUE';
        return 'POPULAR';
    };

    const getTabNames = (tabs: string[]) => {
        if (!tabs || tabs.length === 0) return '';
        return tabs.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' • ');
    };

    const styles = createStyles(colors, isDark, fullScreen);

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <View style={styles.loadingIconWrap}>
                        <Crown size={28} color={colors.primary} />
                    </View>
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
                    <Text style={styles.loadingText}>Loading plans…</Text>
                </View>
            );
        }
        if (subscriptions.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconCircle}>
                        <Lock size={36} color={colors.mutedForeground} />
                    </View>
                    <Text style={styles.emptyTitle}>Subscription Required</Text>
                    <Text style={styles.emptyText}>
                        {filterTab ? `Unlock ${filterTab.charAt(0).toUpperCase() + filterTab.slice(1)} features with an active plan.` : 'No plans available right now.'}
                    </Text>
                    <Text style={styles.emptySubtext}>Please contact support or try again later.</Text>
                </View>
            );
        }
        return (
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} nestedScrollEnabled>
                {isNewUser && subscriptions.some(s => s.isFree && s.forNewUsers) && (
                    <View style={styles.newUserBanner}>
                        <View style={styles.newUserIcon}>
                            <Sparkles size={16} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.newUserTitle}>Welcome offer unlocked!</Text>
                            <Text style={styles.newUserText}>You’re eligible for a free plan — start without paying.</Text>
                        </View>
                    </View>
                )}

                {filterTab && (
                    <View style={styles.infoBanner}>
                        <View style={styles.infoIcon}>
                            <ShieldCheck size={16} color={colors.primary} />
                        </View>
                        <Text style={styles.infoBannerText}>Unlock <Text style={styles.infoBannerHighlight}>{filterTab.charAt(0).toUpperCase() + filterTab.slice(1)}</Text> — choose a plan below</Text>
                    </View>
                )}

                {/* Plans */}
                {subscriptions.map((sub) => {
                    const multiplier = getMultiplier(sub._id);
                    const totalPrice = sub.amount * multiplier;
                    const isFree = !!sub.isFree;
                    const isCombo = sub.subscriptionType === 'combined';
                    const perMonthApprox = (() => {
                        const baseValue = sub.durationValue || 1;
                        const baseType = sub.durationType || 'months';
                        let months = baseValue;
                        if (baseType === 'days') months = baseValue / 30;
                        if (baseType === 'years') months = baseValue * 12;
                        months = months * multiplier;
                        if (months <= 0) return null;
                        return Math.round(totalPrice / months);
                    })();

                    return (
                        <View key={sub._id} style={[styles.card, isFree && styles.cardFree, isCombo && styles.cardCombo]}>
                            {/* Top accent bar */}
                            <View style={[styles.cardAccent, isFree ? styles.accentFree : isCombo ? styles.accentCombo : styles.accentSingle]} />

                            {/* Badges row */}
                            <View style={styles.badgesRow}>
                                <View style={[styles.typeBadge, isFree ? styles.badgeFree : isCombo ? styles.badgeCombo : styles.badgeSingle]}>
                                    {getTypeIcon(sub)}
                                    <Text style={[styles.typeBadgeText, isFree ? styles.typeBadgeTextFree : styles.typeBadgeTextOnDark]}>{getTypeLabel(sub)}</Text>
                                </View>
                                {!isFree && isCombo && (
                                    <View style={styles.saveBadge}>
                                        <Text style={styles.saveBadgeText}>Save 30%</Text>
                                    </View>
                                )}
                            </View>

                            <Text style={styles.planName}>{sub.name}</Text>
                            {sub.description ? <Text style={styles.planDesc} numberOfLines={2}>{sub.description}</Text> : null}

                            {/* Price block */}
                            <View style={styles.priceBlock}>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                                    <Text style={[styles.price, isFree && styles.priceFree]}>{isFree ? 'FREE' : `₹${totalPrice.toLocaleString('en-IN')}`}</Text>
                                    {!isFree && <Text style={styles.priceDuration}>/ {formatDurationWithMultiplier(sub, multiplier)}</Text>}
                                    {isFree && <Text style={styles.priceDuration}>/ {formatDurationWithMultiplier(sub, multiplier)}</Text>}
                                </View>
                                {!isFree && perMonthApprox !== null && (
                                    <Text style={styles.perMonth}>≈ ₹{perMonthApprox}/month • Billed once</Text>
                                )}
                                {!isFree && multiplier > 1 && (
                                    <Text style={styles.basePriceText}>Base ₹{sub.amount} × {multiplier} = ₹{totalPrice}</Text>
                                )}
                            </View>

                            {/* Quantity stepper */}
                            {!isFree && (
                                <View style={styles.stepperCard}>
                                    <View style={styles.stepperHeader}>
                                        <Clock size={14} color={colors.mutedForeground} />
                                        <Text style={styles.stepperLabel}>Duration</Text>
                                        <Text style={styles.stepperValue}>{formatDurationWithMultiplier(sub, multiplier)}</Text>
                                    </View>
                                    <View style={styles.stepperRow}>
                                        <Pressable onPress={() => multiplier > 1 && setMultiplier(sub._id, multiplier - 1)} disabled={multiplier <= 1} style={[styles.stepBtn, multiplier <= 1 && styles.stepBtnDisabled]}>
                                            <Text style={[styles.stepBtnText, multiplier <= 1 && styles.stepBtnTextDisabled]}>–</Text>
                                        </Pressable>
                                        <View style={styles.stepValueBox}>
                                            <Text style={styles.stepValueText}>{multiplier}×</Text>
                                            <Text style={styles.stepValueSub}>{formatDurationWithMultiplier(sub, multiplier)}</Text>
                                        </View>
                                        <Pressable onPress={() => setMultiplier(sub._id, multiplier + 1)} style={styles.stepBtn}>
                                            <Text style={styles.stepBtnText}>+</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            )}

                            {/* Tabs */}
                            <View style={styles.metaRow}>
                                <View style={styles.metaPill}>
                                    <Wallet size={12} color={colors.mutedForeground} />
                                    <Text style={styles.metaText}>{getTabNames(sub.applicableTabs)}</Text>
                                </View>
                            </View>

                            {/* Features */}
                            <View style={styles.features}>
                                {sub.applicableTabs?.map((tab) => (
                                    <View key={tab} style={styles.featureItem}>
                                        <View style={styles.checkCircle}><Check size={10} color="#fff" strokeWidth={3} /></View>
                                        <Text style={styles.featureText}>{tab.charAt(0).toUpperCase() + tab.slice(1)} access unlocked</Text>
                                    </View>
                                ))}
                                <View style={styles.featureItem}>
                                    <View style={styles.checkCircle}><Check size={10} color="#fff" strokeWidth={3} /></View>
                                    <Text style={styles.featureText}>{formatDurationWithMultiplier(sub, multiplier)} validity • Instant activation</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <View style={[styles.checkCircle, { backgroundColor: isDark ? '#334155' : '#e5e7eb' }]}><ShieldCheck size={10} color={isDark ? '#9ca3af' : '#6b7280'} /></View>
                                    <Text style={[styles.featureText, { color: colors.mutedForeground }]}>Secure payment • No hidden charges</Text>
                                </View>
                            </View>

                            <Pressable
                                style={({ pressed }) => [styles.ctaBtn, isFree ? styles.ctaFree : isCombo ? styles.ctaCombo : styles.ctaSingle, purchasing !== null && styles.ctaDisabled, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
                                onPress={() => handlePurchase(sub)}
                                disabled={purchasing !== null}
                            >
                                {purchasing === sub._id ? <ActivityIndicator size="small" color="#fff" /> : (
                                    <>
                                        <Text style={styles.ctaText}>{isFree ? 'Start Free Plan' : `Pay ₹${totalPrice.toLocaleString('en-IN')}`}</Text>
                                        <View style={styles.ctaArrow}><ChevronRight size={16} color="#fff" /></View>
                                    </>
                                )}
                            </Pressable>
                            {!isFree && <Text style={styles.ctaNote}><Lock size={10} color={colors.mutedForeground} />  100% safe & encrypted checkout</Text>}
                        </View>
                    );
                })}

                <View style={styles.trustRow}>
                    <ShieldCheck size={14} color={colors.mutedForeground} />
                    <Text style={styles.trustText}>Trusted by local dairies • Cancel anytime • Instant support</Text>
                </View>
            </ScrollView>
        );
    };

    const headerTitle = title || (filterTab ? `Unlock ${filterTab.charAt(0).toUpperCase() + filterTab.slice(1)}` : 'Choose a plan');
    const headerSubtitle = filterTab ? `Subscribe to continue using ${filterTab}` : isNewUser ? 'Start free or pick a paid plan' : 'Pick the right plan for your dairy';

    return (
        <>
            <Modal visible={visible && !showRazorpay} transparent={!fullScreen} animationType="slide" onRequestClose={onClose} statusBarTranslucent={fullScreen}>
                <StatusBar backgroundColor={fullScreen ? colors.background : 'rgba(0,0,0,0.45)'} barStyle={isDark ? 'light-content' : 'dark-content'} />
                <View style={styles.overlay}>
                    <Pressable style={styles.backdrop} onPress={onClose} />
                    <View style={styles.sheet}>
                        {/* Drag handle */}
                        {!fullScreen && <View style={styles.handle} />}

                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                <View style={styles.headerIconWrap}>
                                    <Crown size={18} color="#fff" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.headerTitle}>{headerTitle}</Text>
                                    <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
                                </View>
                            </View>
                            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                                <X size={18} color={colors.foreground} />
                            </Pressable>
                        </View>

                        {renderContent()}
                    </View>
                </View>
            </Modal>

            {pendingSubscription && (
                <RazorpayPaymentModal
                    visible={showRazorpay}
                    onClose={() => { setShowRazorpay(false); setPendingSubscription(null); setPendingOrderId(''); }}
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
    overlay: { flex: 1, backgroundColor: fullScreen ? colors.background : 'rgba(0,0,0,0.45)', justifyContent: fullScreen ? 'flex-start' : 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: {
        backgroundColor: colors.background,
        borderTopLeftRadius: fullScreen ? 0 : 22,
        borderTopRightRadius: fullScreen ? 0 : 22,
        maxHeight: fullScreen ? '100%' : height * 0.92,
        height: fullScreen ? '100%' : undefined,
        paddingBottom: 12,
        paddingTop: fullScreen ? (StatusBar.currentHeight || 16) : 0,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: -6 },
        elevation: 12,
    },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? '#334155' : '#e5e7eb', alignSelf: 'center', marginTop: 8, marginBottom: 6 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    headerIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: colors.foreground, letterSpacing: -0.2 },
    headerSubtitle: { fontSize: 12, fontWeight: '500', color: colors.mutedForeground, marginTop: 1 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },

    loadingContainer: { padding: 40, alignItems: 'center', gap: 8 },
    loadingIconWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${colors.primary}22` },
    loadingText: { fontSize: 13, color: colors.mutedForeground, fontWeight: '600', marginTop: 8 },
    emptyContainer: { padding: 32, alignItems: 'center', gap: 10 },
    emptyIconCircle: { width: 72, height: 72, borderRadius: 20, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.foreground, marginTop: 4 },
    emptyText: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18, paddingHorizontal: 10 },
    emptySubtext: { fontSize: 11, color: colors.mutedForeground, textAlign: 'center' },

    infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${colors.primary}10`, padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: `${colors.primary}18` },
    infoIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' },
    infoBannerText: { flex: 1, fontSize: 13, color: colors.foreground, fontWeight: '500' },
    infoBannerHighlight: { fontWeight: '800', color: colors.primary },

    scrollView: { flexGrow: 0, maxHeight: fullScreen ? height - 110 : height * 0.72 },
    scrollContent: { padding: 14, paddingBottom: 24, gap: 14 },

    newUserBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: isDark ? '#422006' : '#fffbeb', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#92400e' : '#fde68a' },
    newUserIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
    newUserTitle: { fontSize: 13, fontWeight: '800', color: isDark ? '#fde68a' : '#92400e' },
    newUserText: { fontSize: 12, color: isDark ? '#fde68a' : '#92400e', fontWeight: '500', opacity: 0.9 },

    card: { backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: isDark ? 0.18 : 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    cardFree: { borderColor: isDark ? '#a16207' : '#f59e0b', borderWidth: 1.5 },
    cardCombo: { borderColor: `${colors.primary}55`, borderWidth: 1.2 },
    cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
    accentFree: { backgroundColor: '#f59e0b' },
    accentCombo: { backgroundColor: colors.primary },
    accentSingle: { backgroundColor: isDark ? '#334155' : '#e2e8f0' },

    badgesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeFree: { backgroundColor: isDark ? '#422006' : '#fef3c7', borderWidth: 1, borderColor: isDark ? '#92400e' : '#fde68a' },
    badgeCombo: { backgroundColor: colors.primary },
    badgeSingle: { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderWidth: 1, borderColor: colors.border },
    typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
    typeBadgeTextFree: { color: isDark ? '#fde68a' : '#92400e' },
    typeBadgeTextOnDark: { color: '#fff' },
    saveBadge: { backgroundColor: isDark ? '#064e3b' : '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: isDark ? '#047857' : '#a7f3d0' },
    saveBadgeText: { fontSize: 10, fontWeight: '800', color: isDark ? '#6ee7b7' : '#047857' },

    planName: { fontSize: 16, fontWeight: '800', color: colors.foreground, letterSpacing: -0.2, marginTop: 2 },
    planDesc: { fontSize: 12, color: colors.mutedForeground, lineHeight: 16, marginTop: 4, fontWeight: '500' },

    priceBlock: { marginTop: 10, marginBottom: 10, backgroundColor: isDark ? '#111827' : '#f8fafc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border },
    price: { fontSize: 24, fontWeight: '900', color: colors.foreground, letterSpacing: -0.6 },
    priceFree: { color: '#f59e0b' },
    priceDuration: { fontSize: 12, color: colors.mutedForeground, fontWeight: '700' },
    perMonth: { fontSize: 11, color: colors.mutedForeground, fontWeight: '600', marginTop: 2 },
    basePriceText: { fontSize: 11, color: colors.mutedForeground, marginTop: 4, fontWeight: '500' },

    stepperCard: { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 10, marginBottom: 10 },
    stepperHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    stepperLabel: { fontSize: 12, fontWeight: '700', color: colors.foreground, flex: 1 },
    stepperValue: { fontSize: 11, fontWeight: '700', color: colors.primary, backgroundColor: `${colors.primary}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
    stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    stepBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    stepBtnDisabled: { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 },
    stepBtnText: { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 20 },
    stepBtnTextDisabled: { color: colors.mutedForeground },
    stepValueBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: 6 },
    stepValueText: { fontSize: 16, fontWeight: '900', color: colors.foreground },
    stepValueSub: { fontSize: 10, fontWeight: '600', color: colors.mutedForeground, marginTop: 1 },

    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    metaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
    metaText: { fontSize: 11, fontWeight: '700', color: colors.foreground },

    features: { gap: 8, marginBottom: 14, backgroundColor: isDark ? 'transparent' : '#ffffff', borderRadius: 10, padding: isDark ? 0 : 6, borderWidth: isDark ? 0 : 1, borderColor: isDark ? 'transparent' : '#f1f5f9' },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    featureText: { fontSize: 12, color: colors.foreground, fontWeight: '600', flex: 1 },

    ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
    ctaSingle: { backgroundColor: isDark ? '#334155' : '#0f172a' },
    ctaCombo: { backgroundColor: colors.primary },
    ctaFree: { backgroundColor: '#f59e0b' },
    ctaDisabled: { opacity: 0.7 },
    ctaText: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
    ctaArrow: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
    ctaNote: { fontSize: 10, color: colors.mutedForeground, textAlign: 'center', marginTop: 6, fontWeight: '500' },

    trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, opacity: 0.9 },
    trustText: { fontSize: 11, color: colors.mutedForeground, fontWeight: '600' },
});
