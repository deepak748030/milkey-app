import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Modal,
    Dimensions,
    ActivityIndicator,
    Image,
    Linking,
    Alert,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, RefreshCw, ExternalLink, QrCode, Copy, AlertCircle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { zapupiApi } from '@/lib/milkeyApi';

const { height } = Dimensions.get('window');

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
    const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const checkCountRef = useRef(0);

    const styles = createStyles(colors, isDark, insets);

    useEffect(() => {
        if (visible && amount > 0 && orderId) {
            createPaymentOrder();
        }

        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
        };
    }, [visible, amount, orderId]);

    const createPaymentOrder = async () => {
        setIsCreating(true);
        setError(null);
        setPaymentData(null);
        checkCountRef.current = 0;

        try {
            const response = await zapupiApi.createOrder({
                amount,
                orderId,
                customerMobile,
                remark,
            });

            if (response.success && response.response) {
                setPaymentData(response.response);
                // Start auto-checking payment status
                startPaymentStatusCheck(response.response.orderId);
            } else {
                setError(response.message || 'Failed to create payment order');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const startPaymentStatusCheck = (orderIdToCheck: string) => {
        if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
        }

        checkIntervalRef.current = setInterval(async () => {
            checkCountRef.current += 1;

            // Stop checking after 5 minutes (150 checks at 2 second intervals)
            if (checkCountRef.current > 150) {
                if (checkIntervalRef.current) {
                    clearInterval(checkIntervalRef.current);
                }
                return;
            }

            try {
                const response = await zapupiApi.checkStatus(orderIdToCheck);

                if (response.success && response.response) {
                    const status = response.response.status;

                    if (status === 'Success' || status === 'success') {
                        if (checkIntervalRef.current) {
                            clearInterval(checkIntervalRef.current);
                        }
                        setTransactionData(response.response);
                        setShowSuccess(true);
                    }
                }
            } catch (err) {
                // Silently continue checking
            }
        }, 2000);
    };

    const checkPaymentStatus = async () => {
        if (!paymentData?.orderId) return;

        setIsChecking(true);
        try {
            const response = await zapupiApi.checkStatus(paymentData.orderId);

            if (response.success && response.response) {
                const status = response.response.status;

                if (status === 'Success' || status === 'success') {
                    if (checkIntervalRef.current) {
                        clearInterval(checkIntervalRef.current);
                    }
                    setTransactionData(response.response);
                    setShowSuccess(true);
                } else if (status === 'Failed' || status === 'failed') {
                    Alert.alert('Payment Failed', 'The payment was not successful. Please try again.');
                } else {
                    Alert.alert('Payment Pending', 'Payment is still being processed. Please wait or complete the payment.');
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

    const copyUpiData = async () => {
        if (paymentData?.paymentData) {
            await Clipboard.setStringAsync(paymentData.paymentData);
            Alert.alert('Copied', 'UPI data copied to clipboard');
        }
    };

    const handleSuccessClose = () => {
        setShowSuccess(false);
        if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
        }
        onSuccess(transactionData);
    };

    const handleClose = () => {
        if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
        }
        setPaymentData(null);
        setError(null);
        setShowSuccess(false);
        setTransactionData(null);
        onClose();
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
                        <Pressable onPress={handleClose} style={styles.closeBtn}>
                            <X size={20} color={colors.foreground} />
                        </Pressable>
                    </View>

                    {showSuccess ? (
                        <View style={styles.successContainer}>
                            <View style={styles.successIcon}>
                                <Check size={40} color={colors.white} />
                            </View>
                            <Text style={styles.successTitle}>Payment Successful!</Text>
                            <Text style={styles.successSubtitle}>
                                Transaction ID: {transactionData?.txnId || 'N/A'}
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
                                <View style={styles.qrPlaceholder}>
                                    <QrCode size={100} color={colors.primary} />
                                    <Text style={styles.qrHint}>Scan QR or use link below</Text>
                                </View>
                            </View>

                            <View style={styles.actionsContainer}>
                                <Pressable style={styles.actionBtn} onPress={openPaymentUrl}>
                                    <ExternalLink size={20} color={colors.primary} />
                                    <Text style={styles.actionBtnText}>Open Payment Page</Text>
                                </Pressable>

                                {paymentData.paymentData && (
                                    <Pressable style={styles.actionBtnSecondary} onPress={copyUpiData}>
                                        <Copy size={18} color={colors.mutedForeground} />
                                        <Text style={styles.actionBtnSecondaryText}>Copy UPI Intent</Text>
                                    </Pressable>
                                )}
                            </View>

                            <View style={styles.statusSection}>
                                <Text style={styles.statusText}>
                                    Waiting for payment confirmation...
                                </Text>
                                <Pressable
                                    style={[styles.checkBtn, isChecking && styles.checkBtnDisabled]}
                                    onPress={checkPaymentStatus}
                                    disabled={isChecking}
                                >
                                    {isChecking ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <>
                                            <RefreshCw size={16} color={colors.white} />
                                            <Text style={styles.checkBtnText}>Check Status</Text>
                                        </>
                                    )}
                                </Pressable>
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
            minHeight: height * 0.6,
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
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.foreground,
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
        qrPlaceholder: {
            width: 180,
            height: 180,
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
            marginTop: 8,
            textAlign: 'center',
        },
        actionsContainer: {
            gap: 10,
            marginBottom: 20,
        },
        actionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)',
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.primary,
        },
        actionBtnText: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.primary,
        },
        actionBtnSecondary: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: colors.secondary,
            paddingVertical: 12,
            borderRadius: 10,
        },
        actionBtnSecondaryText: {
            fontSize: 13,
            color: colors.mutedForeground,
        },
        statusSection: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.background,
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
        },
        statusText: {
            fontSize: 12,
            color: colors.mutedForeground,
            flex: 1,
        },
        checkBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.primary,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 8,
        },
        checkBtnDisabled: {
            opacity: 0.6,
        },
        checkBtnText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.white,
        },
        orderIdText: {
            fontSize: 11,
            color: colors.mutedForeground,
            textAlign: 'center',
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
