const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const UserSubscription = require('../models/UserSubscription');

// Razorpay API configuration - Test credentials
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_S3OHPwaCk0J3XX';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '7yeN4EHzKGdS4Zhibag3u1n4';
const RAZORPAY_API_URL = 'https://api.razorpay.com/v1';

// Helper function to make Razorpay API requests
const razorpayRequest = async (endpoint, method = 'GET', body = null) => {
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

    const options = {
        method,
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${RAZORPAY_API_URL}${endpoint}`, options);
    return response.json();
};

// POST /api/razorpay/create-order - Create Razorpay order
router.post('/create-order', auth, async (req, res) => {
    try {
        const { amount, orderId, description, customerName, customerEmail, customerPhone } = req.body;

        if (!amount || !orderId) {
            return res.status(400).json({
                success: false,
                message: 'Amount and order ID are required'
            });
        }

        // Create order with Razorpay
        const orderData = await razorpayRequest('/orders', 'POST', {
            amount: Math.round(amount * 100), // Convert to paise
            currency: 'INR',
            receipt: orderId,
            notes: {
                description: description || 'Subscription Payment',
                customer_name: customerName || '',
                customer_email: customerEmail || '',
                customer_phone: customerPhone || '',
                internal_order_id: orderId,
            }
        });

        if (orderData.error) {
            console.error('Razorpay order creation error:', orderData.error);
            return res.status(400).json({
                success: false,
                message: orderData.error.description || 'Failed to create payment order'
            });
        }

        res.json({
            success: true,
            response: {
                razorpayOrderId: orderData.id,
                amount: orderData.amount,
                currency: orderData.currency,
                receipt: orderData.receipt,
                keyId: RAZORPAY_KEY_ID,
                orderId: orderId,
            }
        });
    } catch (error) {
        console.error('Razorpay create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order'
        });
    }
});

// POST /api/razorpay/verify-payment - Verify Razorpay payment signature
router.post('/verify-payment', auth, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
        const userId = req.user._id;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification data is required'
            });
        }

        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            console.error('Razorpay signature verification failed');
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed - invalid signature'
            });
        }

        // Signature verified, activate subscription
        const subscription = await UserSubscription.findOne({
            transactionId: orderId,
            user: userId
        });

        if (subscription) {
            if (subscription.paymentStatus !== 'completed') {
                subscription.paymentStatus = 'completed';
                subscription.isActive = true;
                subscription.razorpayPaymentId = razorpay_payment_id;
                subscription.razorpayOrderId = razorpay_order_id;
                await subscription.save();
                console.log(`Subscription activated via Razorpay for order: ${orderId}`);
            }

            return res.json({
                success: true,
                message: 'Payment verified successfully',
                subscription: subscription
            });
        } else {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found for this order'
            });
        }
    } catch (error) {
        console.error('Razorpay verify payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment'
        });
    }
});

// POST /api/razorpay/payment-status - Check payment status by payment ID
router.post('/payment-status', auth, async (req, res) => {
    try {
        const { paymentId } = req.body;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: 'Payment ID is required'
            });
        }

        const paymentData = await razorpayRequest(`/payments/${paymentId}`);

        if (paymentData.error) {
            return res.status(404).json({
                success: false,
                message: paymentData.error.description || 'Payment not found'
            });
        }

        res.json({
            success: true,
            response: {
                paymentId: paymentData.id,
                orderId: paymentData.order_id,
                amount: paymentData.amount / 100, // Convert back to rupees
                currency: paymentData.currency,
                status: paymentData.status,
                method: paymentData.method,
                email: paymentData.email,
                contact: paymentData.contact,
                createdAt: paymentData.created_at,
            }
        });
    } catch (error) {
        console.error('Razorpay payment status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check payment status'
        });
    }
});

// POST /api/razorpay/check-order-status - Check order payment status by Razorpay order ID
router.post('/check-order-status', auth, async (req, res) => {
    try {
        const { razorpayOrderId } = req.body;

        if (!razorpayOrderId) {
            return res.status(400).json({
                success: false,
                message: 'Razorpay order ID is required'
            });
        }

        // Fetch order details from Razorpay
        const orderData = await razorpayRequest(`/orders/${razorpayOrderId}`);

        if (orderData.error) {
            return res.status(404).json({
                success: false,
                message: orderData.error.description || 'Order not found'
            });
        }

        // Check if order is paid
        if (orderData.status === 'paid') {
            // Fetch payments for this order to get payment ID
            const paymentsData = await razorpayRequest(`/orders/${razorpayOrderId}/payments`);
            const capturedPayment = paymentsData.items?.find(p => p.status === 'captured');

            // Update subscription if payment was successful
            const internalOrderId = orderData.receipt;
            if (capturedPayment && internalOrderId) {
                const subscription = await UserSubscription.findOne({
                    transactionId: internalOrderId,
                    paymentStatus: 'pending'
                });

                if (subscription) {
                    subscription.paymentStatus = 'completed';
                    subscription.isActive = true;
                    subscription.razorpayPaymentId = capturedPayment.id;
                    subscription.razorpayOrderId = razorpayOrderId;
                    await subscription.save();
                    console.log(`Subscription activated via status check for order: ${internalOrderId}`);
                }
            }

            return res.json({
                success: true,
                status: 'paid',
                paymentId: capturedPayment?.id,
                orderId: razorpayOrderId,
            });
        }

        res.json({
            success: true,
            status: orderData.status, // 'created', 'attempted', 'paid'
            orderId: razorpayOrderId,
        });
    } catch (error) {
        console.error('Razorpay check order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check order status'
        });
    }
});

// POST /api/razorpay/webhook - Webhook for Razorpay payment notifications
// NO AUTH REQUIRED - Razorpay will call this directly
router.post('/webhook', async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        // Verify webhook signature if secret is configured
        if (webhookSecret) {
            const signature = req.headers['x-razorpay-signature'];
            const body = JSON.stringify(req.body);

            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(body)
                .digest('hex');

            if (signature !== expectedSignature) {
                console.error('Razorpay webhook signature verification failed');
                return res.status(400).json({ success: false, message: 'Invalid signature' });
            }
        }

        const { event, payload } = req.body;

        console.log('Razorpay Webhook received:', event);

        if (event === 'payment.captured' || event === 'payment.authorized') {
            const payment = payload.payment.entity;
            const orderId = payment.notes?.internal_order_id || payment.order_id;

            console.log(`Payment ${event} for order: ${orderId}`);

            // Find and activate pending subscription
            const pendingSubscription = await UserSubscription.findOne({
                transactionId: orderId,
                paymentStatus: 'pending'
            });

            if (pendingSubscription) {
                pendingSubscription.paymentStatus = 'completed';
                pendingSubscription.isActive = true;
                pendingSubscription.razorpayPaymentId = payment.id;
                pendingSubscription.razorpayOrderId = payment.order_id;
                await pendingSubscription.save();

                console.log(`Subscription activated via webhook for order: ${orderId}`);
            }
        } else if (event === 'payment.failed') {
            const payment = payload.payment.entity;
            const orderId = payment.notes?.internal_order_id || payment.order_id;

            console.log(`Payment failed for order: ${orderId}`);

            const pendingSubscription = await UserSubscription.findOne({
                transactionId: orderId,
                paymentStatus: 'pending'
            });

            if (pendingSubscription) {
                pendingSubscription.paymentStatus = 'failed';
                pendingSubscription.isActive = false;
                await pendingSubscription.save();

                console.log(`Subscription marked as failed for order: ${orderId}`);
            }
        }

        // Always respond with 200 to acknowledge receipt
        res.json({ success: true, message: 'Webhook received' });
    } catch (error) {
        console.error('Razorpay webhook error:', error);
        // Still return 200 to prevent retries
        res.json({ success: true, message: 'Webhook processed' });
    }
});

// POST /api/razorpay/refund - Initiate refund
router.post('/refund', auth, async (req, res) => {
    try {
        const { paymentId, amount, reason } = req.body;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: 'Payment ID is required'
            });
        }

        const refundData = await razorpayRequest(`/payments/${paymentId}/refund`, 'POST', {
            amount: amount ? Math.round(amount * 100) : undefined, // Optional: partial refund
            notes: {
                reason: reason || 'Customer request'
            }
        });

        if (refundData.error) {
            return res.status(400).json({
                success: false,
                message: refundData.error.description || 'Refund failed'
            });
        }

        res.json({
            success: true,
            response: {
                refundId: refundData.id,
                paymentId: refundData.payment_id,
                amount: refundData.amount / 100,
                status: refundData.status,
                createdAt: refundData.created_at,
            }
        });
    } catch (error) {
        console.error('Razorpay refund error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process refund'
        });
    }
});

module.exports = router;
