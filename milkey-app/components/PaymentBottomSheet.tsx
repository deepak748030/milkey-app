import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CreditCard, Banknote, Wallet, Check } from 'lucide-react-native';
import { ordersApi } from '@/lib/milkeyApi';
import { useCartStore } from '@/lib/cartStore';
import RazorpayOrderPaymentModal from './RazorpayOrderPaymentModal';

const { height } = Dimensions.get('window');

interface PaymentBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    total: number;
    onSuccess: () => void;
}

export default function PaymentBottomSheet({ visible, onClose, total, onSuccess }: PaymentBottomSheetProps) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { items, clearCart } = useCartStore();
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showRazorpay, setShowRazorpay] = useState(false);
    const [pendingOrderId, setPendingOrderId] = useState<string>('');

    const paymentMethods = [
        { id: 'upi', label: 'UPI Payment', icon: Wallet, description: 'Pay with UPI - GPay, PhonePe, Paytm' },
        { id: 'cash', label: 'Cash on Delivery', icon: Banknote, description: 'Pay when you receive' },
    ];

    const styles = createStyles(colors, isDark, insets);

    const generateOrderId = () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ORD${timestamp}${random}`;
    };

    const handlePayment = async () => {
        if (!selectedMethod || items.length === 0) return;

        if (selectedMethod === 'upi') {
            // Generate order ID and show Razorpay modal
            const orderId = generateOrderId();
            setPendingOrderId(orderId);
            setShowRazorpay(true);
            return;
        }

        // For cash payment, proceed directly
        setIsProcessing(true);
        setError(null);

        try {
            const orderData = {
                items: items.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                })),
                paymentMethod: selectedMethod,
            };

            const response = await ordersApi.create(orderData);

            if (response.success) {
                setShowSuccess(true);
                setTimeout(() => {
                    setShowSuccess(false);
                    setSelectedMethod(null);
                    clearCart();
                    onSuccess();
                }, 1500);
            } else {
                setError(response.message || 'Failed to place order');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRazorpaySuccess = async (paymentData: any) => {
        setShowRazorpay(false);
        setIsProcessing(true);
        setError(null);

        try {
            const orderData = {
                items: items.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                })),
                paymentMethod: 'upi',
                transactionId: paymentData?.paymentId || pendingOrderId,
            };

            const response = await ordersApi.create(orderData);

            if (response.success) {
                setShowSuccess(true);
                setTimeout(() => {
                    setShowSuccess(false);
                    setSelectedMethod(null);
                    clearCart();
                    onSuccess();
                }, 1500);
            } else {
                setError(response.message || 'Failed to place order');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRazorpayFailure = (errorMsg: string) => {
        setShowRazorpay(false);
        setError(errorMsg || 'Payment failed. Please try again.');
    };

    const handleClose = () => {
        setSelectedMethod(null);
        setShowSuccess(false);
        setIsProcessing(false);
        setError(null);
        setShowRazorpay(false);
        setPendingOrderId('');
        onClose();
    };

    return (
        <>
            <Modal
                visible={visible && !showRazorpay}
                transparent
                animationType="slide"
                onRequestClose={handleClose}
            >
                <View style={styles.overlay}>
                    <Pressable style={styles.backdrop} onPress={handleClose} />
                    <View style={styles.sheet}>
                        <View style={styles.handle} />

                        <View style={styles.header}>
                            <Text style={styles.title}>Payment Method</Text>
                            <Pressable onPress={handleClose} style={styles.closeBtn}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        {showSuccess ? (
                            <View style={styles.successContainer}>
                                <View style={styles.successIcon}>
                                    <Check size={40} color={colors.white} />
                                </View>
                                <Text style={styles.successTitle}>Order Placed!</Text>
                                <Text style={styles.successSubtitle}>Your order has been placed successfully</Text>
                            </View>
                        ) : (
                            <>
                                <View style={styles.totalSection}>
                                    <Text style={styles.totalLabel}>Total Amount</Text>
                                    <Text style={styles.totalValue}>₹{total}</Text>
                                </View>

                                <View style={styles.methodsContainer}>
                                    {paymentMethods.map((method) => {
                                        const Icon = method.icon;
                                        const isSelected = selectedMethod === method.id;

                                        return (
                                            <Pressable
                                                key={method.id}
                                                style={[
                                                    styles.methodCard,
                                                    isSelected && styles.methodCardSelected,
                                                ]}
                                                onPress={() => setSelectedMethod(method.id)}
                                            >
                                                <View style={[
                                                    styles.methodIcon,
                                                    isSelected && styles.methodIconSelected,
                                                ]}>
                                                    <Icon size={22} color={isSelected ? colors.white : colors.primary} />
                                                </View>
                                                <View style={styles.methodInfo}>
                                                    <Text style={[
                                                        styles.methodLabel,
                                                        isSelected && styles.methodLabelSelected,
                                                    ]}>
                                                        {method.label}
                                                    </Text>
                                                    <Text style={styles.methodDesc}>{method.description}</Text>
                                                </View>
                                                <View style={[
                                                    styles.radioOuter,
                                                    isSelected && styles.radioOuterSelected,
                                                ]}>
                                                    {isSelected && <View style={styles.radioInner} />}
                                                </View>
                                            </Pressable>
                                        );
                                    })}
                                </View>

                                {error && (
                                    <View style={styles.errorContainer}>
                                        <Text style={styles.errorText}>{error}</Text>
                                    </View>
                                )}

                                <Pressable
                                    style={[
                                        styles.payBtn,
                                        (!selectedMethod || isProcessing) && styles.payBtnDisabled,
                                    ]}
                                    onPress={handlePayment}
                                    disabled={!selectedMethod || isProcessing}
                                >
                                    {isProcessing ? (
                                        <ActivityIndicator color={colors.white} />
                                    ) : (
                                        <Text style={styles.payBtnText}>
                                            {selectedMethod === 'upi' ? `Pay ₹${total} via UPI` : `Pay ₹${total}`}
                                        </Text>
                                    )}
                                </Pressable>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            <RazorpayOrderPaymentModal
                visible={showRazorpay}
                onClose={() => setShowRazorpay(false)}
                amount={total}
                orderId={pendingOrderId}
                description="Product Order"
                onSuccess={handleRazorpaySuccess}
                onFailure={handleRazorpayFailure}
            />
        </>
    );
}

const createStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
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
        minHeight: height * 0.45,
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
    totalSection: {
        backgroundColor: colors.secondary,
        padding: 14,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    totalLabel: {
        fontSize: 14,
        color: colors.mutedForeground,
    },
    totalValue: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.foreground,
    },
    methodsContainer: {
        gap: 10,
        marginBottom: 20,
    },
    methodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 12,
        borderWidth: 2,
        borderColor: colors.border,
    },
    methodCardSelected: {
        borderColor: colors.primary,
        backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)',
    },
    methodIcon: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    methodIconSelected: {
        backgroundColor: colors.primary,
    },
    methodInfo: {
        flex: 1,
    },
    methodLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    methodLabelSelected: {
        color: colors.primary,
    },
    methodDesc: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginTop: 2,
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: {
        borderColor: colors.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },
    payBtn: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    payBtnDisabled: {
        opacity: 0.5,
    },
    payBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.white,
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
        fontSize: 14,
        color: colors.mutedForeground,
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    errorText: {
        color: '#EF4444',
        fontSize: 13,
        textAlign: 'center',
    },
});
