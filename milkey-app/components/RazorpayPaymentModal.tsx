import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Modal,
    Dimensions,
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { useTheme } from '@/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, AlertCircle, Clock, RefreshCw, ShieldAlert } from 'lucide-react-native';
import { razorpayApi, userSubscriptionsApi } from '@/lib/milkeyApi';

const { height } = Dimensions.get('window');
const PAYMENT_TIMEOUT = 10 * 60; // 10 minutes in seconds

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
    skipSubscriptionCheck?: boolean; // Skip subscription check for product orders
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
    const [showSuccess, setShowSuccess] = useState(false);
    const [paymentResult, setPaymentResult] = useState<any>(null);
    const [timeRemaining, setTimeRemaining] = useState(PAYMENT_TIMEOUT);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const webViewRef = useRef<WebView>(null);
    const [webviewError, setWebviewError] = useState<string | null>(null);
    const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
    const [checkingSubscription, setCheckingSubscription] = useState(true);

    const styles = createStyles(colors, isDark, insets);

    // Check for active subscription when modal opens (only for subscription purchases)
    useEffect(() => {
        if (visible) {
            if (skipSubscriptionCheck) {
                // Skip subscription check for product orders
                setCheckingSubscription(false);
                setHasActiveSubscription(false);
            } else {
                checkActiveSubscription();
            }
        } else {
            setHasActiveSubscription(false);
            setCheckingSubscription(true);
        }
    }, [visible, skipSubscriptionCheck]);

    const checkActiveSubscription = async () => {
        setCheckingSubscription(true);
        try {
            const response = await userSubscriptionsApi.getStatus();
            if (response.success && response.response) {
                const { hasPurchase, hasSelling, hasRegister } = response.response;
                // If user has ANY active subscription, block new purchase
                if (hasPurchase || hasSelling || hasRegister) {
                    setHasActiveSubscription(true);
                } else {
                    setHasActiveSubscription(false);
                }
            } else {
                setHasActiveSubscription(false);
            }
        } catch (err) {
            setHasActiveSubscription(false);
        } finally {
            setCheckingSubscription(false);
        }
    };

    useEffect(() => {
        // Only create order if no active subscription (or skipped) and amount/orderId are valid
        if (visible && amount > 0 && orderId && !hasActiveSubscription && !checkingSubscription) {
            setTimeRemaining(PAYMENT_TIMEOUT);
            createRazorpayOrder();
            startCountdownTimer();
        }

        return () => {
            clearTimer();
        };
    }, [visible, amount, orderId, hasActiveSubscription, checkingSubscription]);

    const clearTimer = () => {
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
                    clearTimer();
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

    const createRazorpayOrder = async () => {
        setIsCreating(true);
        setError(null);
        setOrderData(null);

        try {
            const response = await razorpayApi.createOrder({
                amount,
                orderId,
                description,
                customerName,
                customerEmail,
                customerPhone,
            });

            if (response.success && response.response) {
                setOrderData(response.response);
            } else {
                setError(response.message || 'Failed to create payment order');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleWebViewMessage = async (event: WebViewMessageEvent) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);

            if (data.event === 'payment.success') {
                clearTimer();

                // Verify payment on server
                const verifyResponse = await razorpayApi.verifyPayment({
                    razorpay_order_id: data.razorpay_order_id,
                    razorpay_payment_id: data.razorpay_payment_id,
                    razorpay_signature: data.razorpay_signature,
                    orderId: orderId,
                });

                if (verifyResponse.success) {
                    const result = {
                        paymentId: data.razorpay_payment_id,
                        orderId: data.razorpay_order_id,
                        signature: data.razorpay_signature,
                    };
                    // Auto-close and call success callback immediately
                    setOrderData(null);
                    setError(null);
                    setShowSuccess(false);
                    setPaymentResult(null);
                    setTimeRemaining(PAYMENT_TIMEOUT);
                    onSuccess(result);
                } else {
                    Alert.alert('Payment Verification Failed', verifyResponse.message || 'Please contact support.');
                    onFailure?.(verifyResponse.message || 'Verification failed');
                }
            } else if (data.event === 'payment.failed') {
                clearTimer();
                Alert.alert('Payment Failed', data.error?.description || 'Payment was not successful.');
                onFailure?.(data.error?.description || 'Payment failed');
            } else if (data.event === 'payment.dismissed') {
                // User dismissed the payment modal
                // Don't close, let them retry
            }
        } catch (err) {
            // Silent fail for message parsing
        }
    };

    // Handle UPI intent URLs for opening payment apps
    const handleIntentUrl = (request: ShouldStartLoadRequest): boolean => {
        const { url } = request;

        // List of all known UPI and payment app schemes
        const paymentSchemes = [
            'upi://',
            'gpay://',
            'phonepe://',
            'paytm://',
            'paytmmp://', // PayTM Merchant Payment
            'intent://',
            'tez://',
            'bhim://',
            'amazonpay://',
            'cred://',
            'mobikwik://',
            'freecharge://',
            'whatsapp://', // WhatsApp Pay
        ];

        // Check if URL starts with any payment scheme
        const isPaymentUrl = paymentSchemes.some(scheme => url.startsWith(scheme));

        if (isPaymentUrl) {
            Linking.openURL(url).catch(() => {
                Alert.alert(
                    'Payment App Not Found',
                    'Could not open the payment app. Please try another UPI option or enter UPI ID manually.',
                    [{ text: 'OK' }]
                );
            });
            return false; // Prevent WebView from loading the URL
        }

        // Allow other URLs to load in WebView
        return true;
    };

    // Handle WebView errors
    const handleWebViewError = (syntheticEvent: any) => {
        const { nativeEvent } = syntheticEvent;
        console.error('WebView error:', nativeEvent);
        setWebviewError('Payment page failed to load. Please check your internet connection and try again.');
    };

    const handleWebViewHttpError = (syntheticEvent: any) => {
        const { nativeEvent } = syntheticEvent;
        console.error('WebView HTTP error:', nativeEvent);
        if (nativeEvent.statusCode >= 400) {
            setWebviewError('Payment service is temporarily unavailable. Please try again later.');
        }
    };

    const retryWebView = () => {
        setWebviewError(null);
        createRazorpayOrder();
    };

    const handleSuccessClose = () => {
        setShowSuccess(false);
        clearTimer();
        onSuccess(paymentResult);
    };

    const handleClose = () => {
        clearTimer();
        setOrderData(null);
        setError(null);
        setShowSuccess(false);
        setPaymentResult(null);
        setTimeRemaining(PAYMENT_TIMEOUT);
        onClose();
    };

    const getTimerColor = () => {
        if (timeRemaining <= 60) return '#EF4444';
        if (timeRemaining <= 120) return '#F59E0B';
        return colors.primary;
    };

    // Razorpay Checkout HTML - UPI Only (no card, no EMI)
    const getCheckoutHTML = () => {
        if (!orderData) return '';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
    <base href="https://checkout.razorpay.com/">
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: ${isDark ? '#1a1a1a' : '#ffffff'};
            color: ${isDark ? '#ffffff' : '#000000'};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .loading {
            text-align: center;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid ${isDark ? '#333' : '#e0e0e0'};
            border-top-color: ${colors.primary};
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .message {
            margin-top: 16px;
            font-size: 14px;
            color: ${isDark ? '#aaa' : '#666'};
        }
        .amount {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 20px;
            color: ${colors.primary};
        }
        .pay-btn {
            background: ${colors.primary};
            color: white;
            border: none;
            padding: 14px 40px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 20px;
            -webkit-appearance: none;
            appearance: none;
        }
        .pay-btn:active {
            opacity: 0.8;
        }
        .pay-btn:disabled {
            opacity: 0.6;
        }
        .upi-note {
            margin-top: 16px;
            font-size: 12px;
            color: ${isDark ? '#888' : '#888'};
            text-align: center;
        }
        .error-msg {
            color: #EF4444;
            font-size: 14px;
            text-align: center;
            margin-top: 16px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="amount">₹${amount}</div>
    <div class="loading" id="loadingDiv">
        <div class="spinner"></div>
        <p class="message">Opening Razorpay...</p>
    </div>
    <button class="pay-btn" id="payBtn" style="display: none;">Pay ₹${amount}</button>
    <p class="upi-note" id="upiNote" style="display: none;">Pay using UPI apps like GPay, PhonePe, Paytm</p>
    
    <script>
        var options = {
            "key": "${orderData.keyId}",
            "amount": "${orderData.amount}",
            "currency": "INR",
            "name": "Milkey",
            "description": "${description}",
            "order_id": "${orderData.razorpayOrderId}",
            "prefill": {
                "name": "${customerName}",
                "email": "${customerEmail}",
                "contact": "${customerPhone}"
            },
            "config": {
                "display": {
                    "blocks": {
                        "upi": {
                            "name": "Pay using UPI",
                            "instruments": [
                                {
                                    "method": "upi",
                                    "flows": ["collect", "intent", "qr"]
                                }
                            ]
                        }
                    },
                    "sequence": ["block.upi"],
                    "preferences": {
                        "show_default_blocks": false
                    }
                }
            },
            "theme": {
                "color": "${colors.primary}"
            },
            "handler": function(response) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    event: 'payment.success',
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature
                }));
            },
            "modal": {
                "ondismiss": function() {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        event: 'payment.dismissed'
                    }));
                }
            }
        };
        
        var rzp = new Razorpay(options);
        
        rzp.on('payment.failed', function(response) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                event: 'payment.failed',
                error: response.error
            }));
        });
        
        // Auto-open Razorpay checkout
        setTimeout(function() {
            rzp.open();
            document.querySelector('.loading').style.display = 'none';
            document.getElementById('payBtn').style.display = 'block';
            document.getElementById('upiNote').style.display = 'block';
        }, 500);
        
        // Manual pay button as fallback
        document.getElementById('payBtn').onclick = function() {
            rzp.open();
        };
    </script>
</body>
</html>
        `;
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
                            {orderData && !showSuccess && (
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
                            <Text style={styles.loadingText}>Checking subscription status...</Text>
                        </View>
                    ) : hasActiveSubscription ? (
                        <View style={styles.errorContainer}>
                            <ShieldAlert size={64} color={colors.primary} />
                            <Text style={styles.errorTitle}>Already Subscribed</Text>
                            <Text style={styles.errorText}>
                                You already have an active subscription. You cannot purchase another subscription until your current one expires.
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
                    ) : error ? (
                        <View style={styles.errorContainer}>
                            <AlertCircle size={48} color="#EF4444" />
                            <Text style={styles.errorTitle}>Payment Error</Text>
                            <Text style={styles.errorText}>{error}</Text>
                            <Pressable style={styles.retryBtn} onPress={createRazorpayOrder}>
                                <Text style={styles.retryBtnText}>Retry</Text>
                            </Pressable>
                        </View>
                    ) : webviewError ? (
                        <View style={styles.errorContainer}>
                            <AlertCircle size={48} color="#EF4444" />
                            <Text style={styles.errorTitle}>Connection Error</Text>
                            <Text style={styles.errorText}>{webviewError}</Text>
                            <Pressable style={styles.retryBtn} onPress={retryWebView}>
                                <RefreshCw size={16} color={colors.white} style={{ marginRight: 6 }} />
                                <Text style={styles.retryBtnText}>Retry</Text>
                            </Pressable>
                        </View>
                    ) : orderData ? (
                        <View style={styles.webviewContainer}>
                            <WebView
                                ref={webViewRef}
                                source={{ html: getCheckoutHTML() }}
                                onMessage={handleWebViewMessage}
                                style={styles.webview}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                startInLoadingState={true}

                                // Production fixes for Android/iOS
                                thirdPartyCookiesEnabled={true}
                                sharedCookiesEnabled={true}
                                mixedContentMode="always"
                                allowsInlineMediaPlayback={true}
                                originWhitelist={['*']}
                                allowUniversalAccessFromFileURLs={true}
                                allowFileAccessFromFileURLs={true}

                                // Handle UPI deep links
                                onShouldStartLoadWithRequest={handleIntentUrl}

                                // Error handling
                                onError={handleWebViewError}
                                onHttpError={handleWebViewHttpError}

                                // Additional settings
                                cacheEnabled={true}
                                incognito={false}

                                renderLoading={() => (
                                    <View style={styles.webviewLoading}>
                                        <ActivityIndicator size="large" color={colors.primary} />
                                    </View>
                                )}
                            />
                        </View>
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
            minHeight: height * 0.7,
            maxHeight: height * 0.9,
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
            paddingHorizontal: 20,
        },
        retryBtn: {
            marginTop: 20,
            paddingHorizontal: 24,
            paddingVertical: 12,
            backgroundColor: colors.primary,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
        },
        retryBtnText: {
            color: colors.white,
            fontWeight: '600',
        },
        webviewContainer: {
            flex: 1,
            minHeight: height * 0.5,
        },
        webview: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        webviewLoading: {
            ...StyleSheet.absoluteFillObject,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.card,
        },
        successContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 40,
        },
        successIcon: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#22C55E',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
        },
        successTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.foreground,
            marginBottom: 8,
        },
        successSubtitle: {
            fontSize: 14,
            color: colors.mutedForeground,
            marginBottom: 12,
        },
        successAmount: {
            fontSize: 28,
            fontWeight: '700',
            color: '#22C55E',
            marginBottom: 24,
        },
        doneBtn: {
            paddingHorizontal: 40,
            paddingVertical: 14,
            backgroundColor: colors.primary,
            borderRadius: 10,
        },
        doneBtnText: {
            color: colors.white,
            fontSize: 16,
            fontWeight: '600',
        },
    });
