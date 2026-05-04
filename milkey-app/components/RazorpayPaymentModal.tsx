import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Modal,
    ActivityIndicator,
    Alert,
    Platform,
    NativeModules,
} from 'react-native';
// Safe import — native module is null in Expo Go / web
let RazorpayCheckout: any = null;
try {
    RazorpayCheckout = require('react-native-razorpay').default;
    console.log('[Razorpay] Module loaded:', !!RazorpayCheckout, 'has open:', typeof RazorpayCheckout?.open);
} catch (e) {
    console.warn('[Razorpay] Failed to load native module:', e);
}
import { useTheme } from '@/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, AlertCircle, Clock, RefreshCw, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react-native';
import { razorpayApi, userSubscriptionsApi } from '@/lib/milkeyApi';

const PAYMENT_TIMEOUT = 10 * 60; // 10 minutes

const isRazorpayNativeReady = () =>
    Platform.OS !== 'web' &&
    !!RazorpayCheckout &&
    typeof RazorpayCheckout.open === 'function' &&
    !!NativeModules.RNRazorpayCheckout;

interface RazorpayPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    amount: number;
    orderId: string;
    description?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    onSuccess: (paymentData: any) => void;
    onFailure?: (error: string) => void;
    skipSubscriptionCheck?: boolean;
}

export default function RazorpayPaymentModal({
    visible,
    onClose,
    amount,
    orderId,
    description = 'Subscription Payment',
    customerName = '',
    customerEmail = '',
    customerPhone = '',
    onSuccess,
    onFailure,
    skipSubscriptionCheck = false,
}: RazorpayPaymentModalProps) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [isCreating, setIsCreating] = useState(false);
    const [orderData, setOrderData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(PAYMENT_TIMEOUT);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
    const [checkingSubscription, setCheckingSubscription] = useState(true);
    const checkoutOpenedRef = useRef(false);

    const styles = createStyles(colors, isDark, insets);

    useEffect(() => {
        if (visible) {
            if (skipSubscriptionCheck) {
                setCheckingSubscription(false);
                setHasActiveSubscription(false);
            } else {
                checkActiveSubscription();
            }
        } else {
            setHasActiveSubscription(false);
            setCheckingSubscription(true);
            checkoutOpenedRef.current = false;
        }
    }, [visible, skipSubscriptionCheck]);

    const checkActiveSubscription = async () => {
        setCheckingSubscription(true);
        try {
            const response = await userSubscriptionsApi.getStatus();
            if (response.success && response.response) {
                const { hasPurchase, hasSelling, hasRegister } = response.response;
                setHasActiveSubscription(!!(hasPurchase || hasSelling || hasRegister));
            } else {
                setHasActiveSubscription(false);
            }
        } catch {
            setHasActiveSubscription(false);
        } finally {
            setCheckingSubscription(false);
        }
    };

    useEffect(() => {
        if (visible && amount > 0 && orderId && !hasActiveSubscription && !checkingSubscription) {
            setTimeRemaining(PAYMENT_TIMEOUT);
            createRazorpayOrder();
            startCountdownTimer();
        }
        return () => clearTimer();
    }, [visible, amount, orderId, hasActiveSubscription, checkingSubscription]);

    const clearTimer = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    };

    const startCountdownTimer = () => {
        clearTimer();
        timerIntervalRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    clearTimer();
                    Alert.alert('Payment Timeout', 'Payment time expired. Please try again.', [
                        { text: 'OK', onPress: handleClose },
                    ]);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const createRazorpayOrder = async () => {
        setIsCreating(true);
        setError(null);
        setOrderData(null);
        try {
            const response = await razorpayApi.createOrder({
                amount, orderId, description, customerName, customerEmail, customerPhone,
            });
            if (response.success && response.response) {
                setOrderData(response.response);
            } else {
                setError(response.message || 'Failed to create payment order');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const openRazorpayCheckout = async () => {
        if (!orderData || checkoutOpenedRef.current) return;

        if (!isRazorpayNativeReady()) {
            console.error('[Razorpay] Native module not available', {
                platform: Platform.OS,
                hasCheckout: !!RazorpayCheckout,
                openType: typeof RazorpayCheckout?.open,
                hasNativeModule: !!NativeModules.RNRazorpayCheckout,
                nativeModuleKeys: Object.keys(NativeModules).filter((key) => key.toLowerCase().includes('razorpay')),
            });
            Alert.alert(
                'Payment Unavailable',
                'Razorpay SDK is not linked in this app build. Please install a fresh development/production build after this update.',
            );
            return;
        }

        checkoutOpenedRef.current = true;
        console.log('[Razorpay] Opening checkout with order:', orderData.razorpayOrderId);

        const options = {
            description,
            currency: 'INR',
            key: orderData.keyId,
            amount: orderData.amount,
            name: 'Milkey',
            order_id: orderData.razorpayOrderId,
            prefill: {
                email: customerEmail || '',
                contact: customerPhone || '',
                name: customerName || '',
            },
            theme: { color: colors.primary },
        };

        try {
            const data: any = await RazorpayCheckout.open(options);
            // Verify payment server-side
            setVerifying(true);
            const verifyResponse = await razorpayApi.verifyPayment({
                razorpay_order_id: data.razorpay_order_id,
                razorpay_payment_id: data.razorpay_payment_id,
                razorpay_signature: data.razorpay_signature,
                orderId,
            });
            setVerifying(false);
            clearTimer();

            if (verifyResponse.success) {
                const result = {
                    paymentId: data.razorpay_payment_id,
                    orderId: data.razorpay_order_id,
                    signature: data.razorpay_signature,
                };
                resetState();
                onSuccess(result);
            } else {
                Alert.alert('Payment Verification Failed', verifyResponse.message || 'Please contact support.');
                onFailure?.(verifyResponse.message || 'Verification failed');
            }
        } catch (err: any) {
            setVerifying(false);
            checkoutOpenedRef.current = false;
            const code = err?.code;
            const desc = err?.description || err?.message || 'Payment was cancelled';
            // code 0 / 2 typically = user cancelled
            if (code === 0 || code === 2) {
                // Stay on modal so user can retry
                return;
            }
            Alert.alert('Payment Failed', desc);
            onFailure?.(desc);
        }
    };

    const resetState = () => {
        setOrderData(null);
        setError(null);
        setTimeRemaining(PAYMENT_TIMEOUT);
        checkoutOpenedRef.current = false;
    };

    const handleClose = () => {
        clearTimer();
        resetState();
        onClose();
    };

    const getTimerColor = () => {
        if (timeRemaining <= 60) return '#EF4444';
        if (timeRemaining <= 120) return '#F59E0B';
        return colors.primary;
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={handleClose} />
                <View style={styles.sheet}>
                    <View style={styles.handle} />

                    <View style={styles.header}>
                        <Text style={styles.title}>Secure Payment</Text>
                        <View style={styles.headerRight}>
                            {orderData && !verifying && (
                                <View style={[styles.timerBadge, { backgroundColor: getTimerColor() + '20' }]}>
                                    <Clock size={14} color={getTimerColor()} />
                                    <Text style={[styles.timerText, { color: getTimerColor() }]}>
                                        {formatTime(timeRemaining)}
                                    </Text>
                                </View>
                            )}
                            <Pressable onPress={handleClose} style={styles.closeBtn}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                    </View>

                    {checkingSubscription ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Checking subscription...</Text>
                        </View>
                    ) : hasActiveSubscription ? (
                        <View style={styles.errorContainer}>
                            <ShieldAlert size={48} color="#F59E0B" />
                            <Text style={styles.errorTitle}>Active Subscription Found</Text>
                            <Text style={styles.errorText}>
                                You already have an active subscription. Please wait for it to expire before purchasing a new one.
                            </Text>
                            <Pressable style={styles.retryBtn} onPress={handleClose}>
                                <Text style={styles.retryBtnText}>Close</Text>
                            </Pressable>
                        </View>
                    ) : isCreating ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Creating payment order...</Text>
                        </View>
                    ) : verifying ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Verifying payment...</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.errorContainer}>
                            <AlertCircle size={48} color="#EF4444" />
                            <Text style={styles.errorTitle}>Payment Error</Text>
                            <Text style={styles.errorText}>{error}</Text>
                            <Pressable style={styles.retryBtn} onPress={createRazorpayOrder}>
                                <RefreshCw size={18} color="#fff" />
                                <Text style={styles.retryBtnText}>Retry</Text>
                            </Pressable>
                        </View>
                    ) : orderData ? (
                        <View style={styles.summaryContainer}>
                            <View style={styles.amountCard}>
                                <Text style={styles.amountLabel}>Amount Payable</Text>
                                <Text style={styles.amountValue}>₹{amount}</Text>
                                <Text style={styles.descText}>{description}</Text>
                            </View>

                            <View style={styles.infoRow}>
                                <ShieldCheck size={18} color={colors.primary} />
                                <Text style={styles.infoText}>Secure Razorpay Checkout</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Smartphone size={18} color={colors.primary} />
                                <Text style={styles.infoText}>UPI, Cards, Netbanking & Wallets</Text>
                            </View>

                            <Pressable style={styles.payBtn} onPress={openRazorpayCheckout}>
                                <Text style={styles.payBtnText}>Pay ₹{amount}</Text>
                            </Pressable>

                            <Text style={styles.poweredBy}>Powered by Razorpay</Text>
                        </View>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: any, isDark: boolean, insets: any) =>
    StyleSheet.create({
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        backdrop: { ...StyleSheet.absoluteFillObject },
        sheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: insets.bottom + 16,
            maxHeight: '85%',
        },
        handle: {
            width: 40, height: 4, backgroundColor: colors.border,
            borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4,
        },
        header: {
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 20, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: colors.border,
        },
        title: { fontSize: 18, fontWeight: '700', color: colors.foreground },
        headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        timerBadge: {
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
        },
        timerText: { fontSize: 12, fontWeight: '700' },
        closeBtn: { padding: 6, borderRadius: 999, backgroundColor: colors.muted },
        loadingContainer: { padding: 40, alignItems: 'center', gap: 12 },
        loadingText: { color: colors.mutedForeground, fontSize: 14 },
        errorContainer: { padding: 32, alignItems: 'center', gap: 12 },
        errorTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginTop: 8 },
        errorText: { color: colors.mutedForeground, fontSize: 14, textAlign: 'center', lineHeight: 20 },
        retryBtn: {
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12,
            borderRadius: 10, marginTop: 12,
        },
        retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
        summaryContainer: { padding: 20, gap: 14 },
        amountCard: {
            backgroundColor: colors.muted, borderRadius: 14, padding: 20, alignItems: 'center',
            borderWidth: 1, borderColor: colors.border,
        },
        amountLabel: { fontSize: 13, color: colors.mutedForeground, fontWeight: '500' },
        amountValue: { fontSize: 36, fontWeight: '800', color: colors.primary, marginTop: 4 },
        descText: { fontSize: 13, color: colors.mutedForeground, marginTop: 6, textAlign: 'center' },
        infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
        infoText: { fontSize: 13, color: colors.foreground, fontWeight: '500' },
        payBtn: {
            backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 12,
            alignItems: 'center', marginTop: 8,
        },
        payBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
        poweredBy: { textAlign: 'center', fontSize: 11, color: colors.mutedForeground, marginTop: 4 },
    });
