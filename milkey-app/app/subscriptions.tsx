import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal, Dimensions } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, CreditCard, Clock, CheckCircle, XCircle, Crown, Sparkles, Gift, Calendar, Zap, Check, Star, AlertCircle, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { userSubscriptionsApi, UserSubscription, Subscription as AvailableSubscription, formatSubscriptionDuration } from '@/lib/milkeyApi';
import ZapUPIPaymentModal from '@/components/ZapUPIPaymentModal';
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
    const [activeTab, setActiveTab] = useState<'active' | 'available' | 'expired'>('active');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSubscriptions, setActiveSubscriptions] = useState<UserSubscription[]>([]);
    const [expiredSubscriptions, setExpiredSubscriptions] = useState<UserSubscription[]>([]);
    const [availableSubscriptions, setAvailableSubscriptions] = useState<AvailableSubscription[]>([]);
    const [isNewUser, setIsNewUser] = useState(false);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });
    const [successModal, setSuccessModal] = useState({ visible: false, title: '', message: '' });
    // Track multiplier per subscription (for extending duration)
    const [multipliers, setMultipliers] = useState<Record<string, number>>({});
    // ZapUPI Payment states
    const [showZapUPI, setShowZapUPI] = useState(false);
    const [pendingSubscription, setPendingSubscription] = useState<AvailableSubscription | null>(null);
    const [pendingOrderId, setPendingOrderId] = useState<string>('');

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

    const generateOrderId = () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `SUB${timestamp}${random}`;
    };

    const handlePurchase = async (subscriptionId: string) => {
        const subscription = availableSubscriptions.find(s => s._id === subscriptionId);
        if (!subscription) return;

        const multiplier = getMultiplier(subscriptionId);
        const totalPrice = subscription.amount * multiplier;

        // For paid subscriptions, show ZapUPI payment first
        if (!subscription.isFree && totalPrice > 0) {
            const orderId = generateOrderId();
            setPendingOrderId(orderId);
            setPendingSubscription(subscription);
            setShowZapUPI(true);
            return;
        }

        // For free subscriptions, proceed directly
        await completePurchase(subscriptionId, multiplier);
    };

    const handleZapUPISuccess = async (transactionData: any) => {
        setShowZapUPI(false);
        if (pendingSubscription) {
            const multiplier = getMultiplier(pendingSubscription._id);
            await completePurchase(pendingSubscription._id, multiplier, transactionData?.txnId || pendingOrderId);
        }
        setPendingSubscription(null);
        setPendingOrderId('');
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
        if (!item.subscription) return null;

        const daysRemaining = getDaysRemaining(item.endDate);
        const TypeIcon = getTypeIcon(item.subscription.subscriptionType);
        const isQueued = new Date(item.startDate) > new Date();

        return (
            <View key={item._id} style={[styles.subscriptionCard, isQueued && styles.queuedCard]}>
                <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, isQueued && styles.queuedIconContainer]}>
                        <TypeIcon size={24} color={isQueued ? colors.warning : colors.primary} />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                        <Text style={styles.subscriptionName}>
                            {item.lockedSubscriptionName || item.subscription.name}
                        </Text>
                        <View style={[styles.statusBadge, isQueued && styles.queuedBadge]}>
                            {isQueued ? (
                                <>
                                    <Clock size={12} color={colors.warning} />
                                    <Text style={[styles.statusText, { color: colors.warning }]}>Queued</Text>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={12} color={colors.success} />
                                    <Text style={styles.statusText}>Active</Text>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                {/* Locked-in price and duration info */}
                {(item.multiplier && item.multiplier > 1) || item.baseAmount ? (
                    <View style={styles.lockedInfoContainer}>
                        <Text style={styles.lockedInfoText}>
                            Paid: ₹{item.amount}
                            {item.multiplier && item.multiplier > 1 && ` (${item.multiplier}× plan)`}
                        </Text>
                    </View>
                ) : null}

                <View style={styles.cardDetails}>
                    {isQueued && (
                        <View style={styles.detailRow}>
                            <Calendar size={14} color={colors.warning} />
                            <Text style={[styles.detailText, { color: colors.warning }]}>
                                Starts: {formatDate(item.startDate)}
                            </Text>
                        </View>
                    )}
                    <View style={styles.detailRow}>
                        <Calendar size={14} color={colors.mutedForeground} />
                        <Text style={styles.detailText}>Valid till: {formatDate(item.endDate)}</Text>
                    </View>
                    {!isQueued && (
                        <View style={styles.detailRow}>
                            <Clock size={14} color={daysRemaining <= 7 ? colors.warning : colors.mutedForeground} />
                            <Text style={[styles.detailText, daysRemaining <= 7 && { color: colors.warning }]}>
                                {daysRemaining} days remaining
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.tabsContainer}>
                    <Text style={styles.tabsLabel}>Covers: </Text>
                    <Text style={styles.tabsValue}>{getTabNames(item.applicableTabs || item.subscription.applicableTabs || [])}</Text>
                </View>
            </View>
        );
    };

    const renderExpiredSubscription = (item: UserSubscription) => {
        if (!item.subscription) return null;

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
                    <Text style={styles.tabsValue}>{getTabNames(item.subscription.applicableTabs || [])}</Text>
                </View>
            </View>
        );
    };

    const renderAvailableSubscription = (item: AvailableSubscription) => {
        const TypeIcon = getTypeIcon(item.subscriptionType);
        const isPurchasing = purchasing === item._id;
        const isPurchased = item.isPurchased || false;
        const typeLabel = getTypeLabel(item);
        const multiplier = getMultiplier(item._id);
        const totalPrice = item.amount * multiplier;
        const multiplierOptions = [1, 2, 3, 6, 12];

        return (
            <View key={item._id} style={[styles.availableCard, item.isFree && styles.freeCard]}>
                {/* New User Banner */}
                {item.isFree && isNewUser && item.forNewUsers && (
                    <View style={styles.newUserBanner}>
                        <Gift size={12} color="#FFFFFF" />
                        <Text style={styles.newUserText}>Free for New Users!</Text>
                    </View>
                )}
                {/* Type Badge */}
                <View style={[
                    styles.typeBadge,
                    item.isFree ? styles.freeBadge :
                        item.subscriptionType === 'combined' ? styles.comboBadge :
                            styles.singleBadge
                ]}>
                    <TypeIcon size={14} color={item.isFree ? colors.warning : colors.primary} fill={item.isFree ? colors.warning : undefined} />
                    <Text style={[styles.typeBadgeText, item.isFree && styles.freeBadgeText]}>
                        {typeLabel}
                    </Text>
                </View>

                {/* Name */}
                <Text style={styles.availableName}>{item.name}</Text>

                {/* Price Row - Shows calculated price with multiplier */}
                <View style={styles.priceRow}>
                    <Text style={[styles.priceText, item.isFree && styles.freePriceText]}>
                        {item.isFree ? 'FREE' : `₹${totalPrice}`}
                    </Text>
                    <Text style={styles.durationText}>/ {formatDurationWithMultiplier(item, multiplier)}</Text>
                </View>

                {/* Base price info when multiplier > 1 */}
                {!item.isFree && multiplier > 1 && (
                    <Text style={styles.basePriceText}>
                        Base: ₹{item.amount} × {multiplier} = ₹{totalPrice}
                    </Text>
                )}

                {/* Quantity Selector - Only for paid subscriptions */}
                {!item.isFree && !isPurchased && (
                    <View style={styles.multiplierContainer}>
                        <Text style={styles.multiplierLabel}>Select Quantity:</Text>
                        <View style={styles.quantitySelector}>
                            <Pressable
                                style={[styles.quantityButton, multiplier <= 1 && styles.quantityButtonDisabled]}
                                onPress={() => multiplier > 1 && setMultiplier(item._id, multiplier - 1)}
                                disabled={multiplier <= 1}
                            >
                                <Text style={[styles.quantityButtonText, multiplier <= 1 && styles.quantityButtonTextDisabled]}>−</Text>
                            </Pressable>
                            <View style={styles.quantityInputContainer}>
                                <Text style={styles.quantityInputText}>{multiplier}</Text>
                            </View>
                            <Pressable
                                style={styles.quantityButton}
                                onPress={() => setMultiplier(item._id, multiplier + 1)}
                            >
                                <Text style={styles.quantityButtonText}>+</Text>
                            </Pressable>
                        </View>
                        <Text style={styles.multiplierHint}>
                            {formatDurationWithMultiplier(item, multiplier)} for ₹{totalPrice}
                        </Text>
                    </View>
                )}

                {/* Description */}
                {item.description ? (
                    <Text style={styles.descriptionText}>{item.description}</Text>
                ) : null}

                {/* Tabs Row */}
                <View style={styles.tabsRow}>
                    <Text style={styles.tabsRowLabel}>Access to: </Text>
                    <Text style={styles.tabsRowValue}>{getTabNames(item.applicableTabs || [])}</Text>
                </View>

                {/* Features */}
                <View style={styles.featuresContainer}>
                    {item.applicableTabs?.map((tab) => (
                        <View key={tab} style={styles.featureRow}>
                            <Check size={14} color={colors.primary} />
                            <Text style={styles.featureText}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)} Tab Access
                            </Text>
                        </View>
                    ))}
                    <View style={styles.featureRow}>
                        <Check size={14} color={colors.primary} />
                        <Text style={styles.featureText}>
                            {formatDurationWithMultiplier(item, multiplier)} Validity
                        </Text>
                    </View>
                </View>

                {/* Purchase Button */}
                <Pressable
                    style={[
                        styles.purchaseButton,
                        isPurchased && styles.purchasedButton,
                        item.isFree && !isPurchased && styles.freePurchaseButton
                    ]}
                    onPress={() => !isPurchased && handlePurchase(item._id)}
                    disabled={isPurchased || isPurchasing}
                >
                    {isPurchasing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={styles.purchaseButtonText}>
                            {isPurchased ? 'Already Subscribed' : item.isFree ? 'Activate Free' : `Subscribe for ₹${totalPrice}`}
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
                items = activeSubscriptions.map(renderActiveSubscription).filter(Boolean);
                emptyMessage = 'No active subscriptions';
                break;
            case 'available':
                items = availableSubscriptions.map(renderAvailableSubscription).filter(Boolean);
                emptyMessage = 'No subscriptions available';
                break;
            case 'expired':
                items = expiredSubscriptions.map(renderExpiredSubscription).filter(Boolean);
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
                <ZapUPIPaymentModal
                    visible={showZapUPI}
                    onClose={() => {
                        setShowZapUPI(false);
                        setPendingSubscription(null);
                        setPendingOrderId('');
                    }}
                    amount={pendingSubscription.amount * getMultiplier(pendingSubscription._id)}
                    orderId={pendingOrderId}
                    remark={`Subscription: ${pendingSubscription.name}`}
                    onSuccess={handleZapUPISuccess}
                />
            )}
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
        color: '#FFFFFF',
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
        color: '#FFFFFF',
    },
    listContainer: {
        gap: 16,
    },

    // Active subscription card styles
    subscriptionCard: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    queuedCard: {
        borderColor: colors.warning,
        borderWidth: 2,
    },
    expiredCard: {
        opacity: 0.7,
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
        backgroundColor: `${colors.primary}15`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    queuedIconContainer: {
        backgroundColor: `${colors.warning}15`,
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
    queuedBadge: {},
    expiredBadge: {},
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.success,
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

    // Available subscription card styles (matching modal UI)
    availableCard: {
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
    newUserBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.success,
        paddingVertical: 6,
        marginTop: -16,
        marginHorizontal: -16,
        marginBottom: 12,
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        gap: 6,
    },
    newUserText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    availableName: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
        marginBottom: 6,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        marginBottom: 10,
    },
    priceText: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.primary,
    },
    freePriceText: {
        color: colors.warning,
    },
    durationText: {
        fontSize: 14,
        color: colors.mutedForeground,
    },
    descriptionText: {
        fontSize: 13,
        color: colors.mutedForeground,
        marginBottom: 12,
        lineHeight: 18,
    },
    basePriceText: {
        fontSize: 12,
        color: colors.mutedForeground,
        marginBottom: 8,
    },
    // Quantity selector styles
    multiplierContainer: {
        marginBottom: 12,
        padding: 12,
        backgroundColor: colors.secondary,
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
    lockedInfoContainer: {
        backgroundColor: `${colors.primary}10`,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        marginBottom: 10,
    },
    lockedInfoText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '500',
    },
    tabsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    tabsRowLabel: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    tabsRowValue: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.foreground,
    },
    featuresContainer: {
        gap: 6,
        marginBottom: 14,
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
    freePurchaseButton: {
        backgroundColor: colors.success,
    },
    purchaseButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
