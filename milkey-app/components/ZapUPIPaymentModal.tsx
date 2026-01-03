import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Modal,
    Dimensions,
    ActivityIndicator,
    Linking,
    Alert,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, RefreshCw, AlertCircle, Clock } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { zapupiApi } from '@/lib/milkeyApi';
import QRCode from 'react-native-qrcode-svg';

const { height } = Dimensions.get('window');
const PAYMENT_TIMEOUT = 5 * 60; // 5 minutes in seconds

interface ZapUPIPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    amount: number;
    orderId: string;
    remark?: string;
    customerMobile?: string;
    onSuccess: (transactionData: any) => void;
    onFailure?: (error: string) => void;
}

export default function ZapUPIPaymentModal({
    visible,
    onClose,
    amount,
    orderId,
    remark,
    customerMobile,
    onSuccess,
    onFailure,
}: ZapUPIPaymentModalProps) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [isCreating, setIsCreating] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [paymentData, setPaymentData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [transactionData, setTransactionData] = useState<any>(null);
    const [timeRemaining, setTimeRemaining] = useState(PAYMENT_TIMEOUT);
    const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const styles = createStyles(colors, isDark, insets);

    useEffect(() => {
        if (visible && amount > 0 && orderId) {
            setTimeRemaining(PAYMENT_TIMEOUT);
            createPaymentOrder();
            startCountdownTimer();
        }

        return () => {
            clearAllIntervals();
        };
    }, [visible, amount, orderId]);

    const clearAllIntervals = () => {
        if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
        }
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    };

    const startCountdownTimer = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }

        timerIntervalRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    // Time's up - auto close
                    clearAllIntervals();
                    Alert.alert(
                        'Payment Timeout',
                        'Payment time expired. Please try again.',
                        [{ text: 'OK', onPress: handleClose }]
                    );
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

    const createPaymentOrder = async () => {
        setIsCreating(true);
        setError(null);
        setPaymentData(null);

        try {
            const response = await zapupiApi.createOrder({
                amount,
                orderId,
                customerMobile,
                remark,
            });

            if (response.success && response.response) {
                setPaymentData(response.response);
                // Start auto-checking using autoCheckUrl
                if (response.response.autoCheckUrl) {
                    startAutoCheckPolling(response.response.autoCheckUrl, response.response.orderId);
                }
            } else {
                setError(response.message || 'Failed to create payment order');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const startAutoCheckPolling = (autoCheckUrl: string, orderIdToCheck: string) => {
        if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
        }

        checkIntervalRef.current = setInterval(async () => {
            try {
                // Use autoCheckUrl for polling
                const response = await fetch(autoCheckUrl);
                const data = await response.json();

                // Check for success status
                if (data.status &&
                    (data.status.toLowerCase().includes('success') ||
                        data.status === 'Success' ||
                        data.status === 'Completed')) {

                    clearAllIntervals();

                    // Verify payment with main API
                    const verifyResponse = await zapupiApi.checkStatus(orderIdToCheck);
                    if (verifyResponse.success && verifyResponse.response) {
                        setTransactionData(verifyResponse.response);
                    } else {
                        setTransactionData({ status: 'Success', orderId: orderIdToCheck });
                    }
                    setShowSuccess(true);
                } else if (data.status &&
                    (data.status.toLowerCase().includes('failed') ||
                        data.status === 'Failed')) {
                    clearAllIntervals();
                    Alert.alert('Payment Failed', 'The payment was not successful. Please try again.');
                }
                // Continue polling if pending
            } catch (err) {
                // Silently continue checking
            }
        }, 3000); // Check every 3 seconds
    };

    const checkPaymentStatus = async () => {
        if (!paymentData?.orderId) return;

        setIsChecking(true);
        try {
            // First check autoCheckUrl
            if (paymentData.autoCheckUrl) {
                const autoResponse = await fetch(paymentData.autoCheckUrl);
                const autoData = await autoResponse.json();

                if (autoData.status &&
                    (autoData.status.toLowerCase().includes('success') ||
                        autoData.status === 'Success' ||
                        autoData.status === 'Completed')) {

                    clearAllIntervals();
                    const verifyResponse = await zapupiApi.checkStatus(paymentData.orderId);
                    if (verifyResponse.success && verifyResponse.response) {
                        setTransactionData(verifyResponse.response);
                    } else {
                        setTransactionData({ status: 'Success', orderId: paymentData.orderId });
                    }
                    setShowSuccess(true);
                    setIsChecking(false);
                    return;
                }
            }

            // Fallback to main API check
            const response = await zapupiApi.checkStatus(paymentData.orderId);

            if (response.success && response.response) {
                const status = response.response.status;

                if (status === 'Success' || status === 'success') {
                    clearAllIntervals();
                    setTransactionData(response.response);
                    setShowSuccess(true);
                } else if (status === 'Failed' || status === 'failed') {
                    Alert.alert('Payment Failed', 'The payment was not successful. Please try again.');
                } else {
                    Alert.alert('Payment Pending', 'Payment is still being processed. Please complete the payment.');
                }
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to check payment status. Please try again.');
        } finally {
            setIsChecking(false);
        }
    };

    const openPaymentUrl = async () => {
        if (paymentData?.paymentUrl) {
            try {
                await Linking.openURL(paymentData.paymentUrl);
            } catch (err) {
                Alert.alert('Error', 'Could not open payment page');
            }
        }
    };

    const getDecodedUpiUrl = () => {
        if (!paymentData?.paymentData) return null;
        try {
            return decodeURIComponent(paymentData.paymentData);
        } catch {
            return paymentData.paymentData;
        }
    };

    const copyUpiData = async () => {
        if (paymentData?.paymentData) {
            await Clipboard.setStringAsync(paymentData.paymentData);
            Alert.alert('Copied', 'UPI data copied to clipboard');
        }
    };

    const handleSuccessClose = () => {
        setShowSuccess(false);
        clearAllIntervals();
        onSuccess(transactionData);
    };

    const handleClose = () => {
        clearAllIntervals();
        setPaymentData(null);
        setError(null);
        setShowSuccess(false);
        setTransactionData(null);
        setTimeRemaining(PAYMENT_TIMEOUT);
        onClose();
    };

    const getTimerColor = () => {
        if (timeRemaining <= 60) return '#EF4444'; // Red when < 1 min
        if (timeRemaining <= 120) return '#F59E0B'; // Orange when < 2 min
        return colors.primary;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={handleClose} />
                <View style={styles.sheet}>
                    <View style={styles.handle} />

                    <View style={styles.header}>
                        <Text style={styles.title}>UPI Payment</Text>
                        <View style={styles.headerRight}>
                            {paymentData && !showSuccess && (
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

                    {showSuccess ? (
                        <View style={styles.successContainer}>
                            <View style={styles.successIcon}>
                                <Check size={40} color={colors.white} />
                            </View>
                            <Text style={styles.successTitle}>Payment Successful!</Text>
                            <Text style={styles.successSubtitle}>
                                Transaction ID: {transactionData?.txnId || transactionData?.orderId || 'N/A'}
                            </Text>
                            <Text style={styles.successAmount}>₹{amount}</Text>
                            <Pressable style={styles.doneBtn} onPress={handleSuccessClose}>
                                <Text style={styles.doneBtnText}>Done</Text>
                            </Pressable>
                        </View>
                    ) : isCreating ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Creating payment order...</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.errorContainer}>
                            <AlertCircle size={48} color="#EF4444" />
                            <Text style={styles.errorTitle}>Payment Error</Text>
                            <Text style={styles.errorText}>{error}</Text>
                            <Pressable style={styles.retryBtn} onPress={createPaymentOrder}>
                                <RefreshCw size={18} color={colors.white} />
                                <Text style={styles.retryBtnText}>Retry</Text>
                            </Pressable>
                        </View>
                    ) : paymentData ? (
                        <>
                            <View style={styles.amountSection}>
                                <Text style={styles.amountLabel}>Amount to Pay</Text>
                                <Text style={styles.amountValue}>₹{amount}</Text>
                            </View>

                            <View style={styles.qrSection}>
                                {paymentData.paymentData ? (
                                    <View style={styles.qrContainer}>
                                        <QRCode
                                            value={getDecodedUpiUrl() || paymentData.paymentData}
                                            size={220}
                                            color={isDark ? '#FFFFFF' : '#000000'}
                                            backgroundColor={isDark ? colors.card : '#FFFFFF'}
                                        />
                                        <Text style={styles.qrHint}>Scan with any UPI app to pay</Text>
                                    </View>
                                ) : (
                                    <View style={styles.qrPlaceholder}>
                                        <ActivityIndicator size="large" color={colors.primary} />
                                        <Text style={styles.qrHint}>Loading QR Code...</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.pollingIndicator}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.pollingText}>Auto-detecting payment...</Text>
                            </View>

                            <View style={styles.warningBox}>
                                <AlertCircle size={16} color="#F59E0B" />
                                <Text style={styles.warningText}>
                                    Do not close this screen until payment is complete, otherwise subscription will not be activated
                                </Text>
                            </View>

                            <Text style={styles.orderIdText}>Order ID: {paymentData.orderId}</Text>
                        </>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: any, isDark: boolean, insets: any) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        sheet: {
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 16,
            minHeight: height * 0.55,
        },
        handle: {
            width: 40,
            height: 4,
            backgroundColor: colors.muted,
            borderRadius: 2,
            alignSelf: 'center',
            marginTop: 10,
            marginBottom: 12,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        headerRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.foreground,
        },
        timerBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 20,
        },
        timerText: {
            fontSize: 14,
            fontWeight: '700',
        },
        closeBtn: {
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: colors.muted,
            alignItems: 'center',
            justifyContent: 'center',
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
        errorContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 40,
        },
        errorTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.foreground,
            marginTop: 12,
        },
        errorText: {
            fontSize: 14,
            color: colors.mutedForeground,
            textAlign: 'center',
            marginTop: 8,
            marginBottom: 20,
        },
        retryBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 10,
        },
        retryBtnText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.white,
        },
        amountSection: {
            backgroundColor: colors.secondary,
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: 20,
        },
        amountLabel: {
            fontSize: 14,
            color: colors.mutedForeground,
        },
        amountValue: {
            fontSize: 32,
            fontWeight: '700',
            color: colors.primary,
            marginTop: 4,
        },
        qrSection: {
            alignItems: 'center',
            marginBottom: 20,
        },
        qrContainer: {
            padding: 20,
            backgroundColor: isDark ? colors.card : '#FFFFFF',
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
        },
        qrPlaceholder: {
            width: 200,
            height: 200,
            backgroundColor: colors.background,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.border,
            borderStyle: 'dashed',
        },
        qrHint: {
            fontSize: 12,
            color: colors.mutedForeground,
            marginTop: 12,
            textAlign: 'center',
        },
        pollingIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: colors.background,
            padding: 14,
            borderRadius: 12,
            marginBottom: 16,
        },
        pollingText: {
            fontSize: 14,
            color: colors.mutedForeground,
            fontWeight: '500',
        },
        orderIdText: {
            fontSize: 11,
            color: colors.mutedForeground,
            textAlign: 'center',
        },
        warningBox: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#F59E0B20',
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: '#F59E0B40',
        },
        warningText: {
            flex: 1,
            fontSize: 12,
            color: '#F59E0B',
            fontWeight: '500',
            lineHeight: 16,
        },
        successContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 40,
        },
        successIcon: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
        },
        successTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.foreground,
            marginBottom: 4,
        },
        successSubtitle: {
            fontSize: 13,
            color: colors.mutedForeground,
            marginBottom: 8,
        },
        successAmount: {
            fontSize: 28,
            fontWeight: '700',
            color: colors.primary,
            marginBottom: 24,
        },
        doneBtn: {
            backgroundColor: colors.primary,
            paddingHorizontal: 40,
            paddingVertical: 14,
            borderRadius: 12,
        },
        doneBtnText: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.white,
        },
    });
