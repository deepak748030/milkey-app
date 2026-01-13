const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const UserSubscription = require('../models/UserSubscription');
const User = require('../models/User');
const Referral = require('../models/Referral');
const { notifySubscriptionPurchased, notifyCommissionEarned } = require('../lib/pushNotifications');

// Razorpay API configuration
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

/**
 * Process referral commission after subscription activation
 */
async function processReferralCommission(userId, subscriptionAmount, subscriptionName) {
    try {
        const ReferralConfig = require('../models/ReferralConfig');
        const cfg = await ReferralConfig.findOneAndUpdate(
            {},
            { $setOnInsert: { defaultCommissionRate: 5 } },
            { new: true, upsert: true }
        );
        const defaultCommissionRate = typeof cfg?.defaultCommissionRate === 'number' ? cfg.defaultCommissionRate : 5;

        const buyer = await User.findById(userId);
        if (!buyer || !buyer.referredBy) {
            return null;
        }

        const referrerId = buyer.referredBy;

        let referral = await Referral.findOne({
            referrer: referrerId,
            referred: userId
        });

        if (!referral) {
            const referrer = await User.findById(referrerId).select('referralCode').lean();
            if (referrer) {
                referral = await Referral.create({
                    referrer: referrerId,
                    referred: userId,
                    code: referrer.referralCode,
                    status: 'active',
                    commissionRate: defaultCommissionRate,
                    totalEarnings: 0
                });
            }
        }

        if (referral) {
            const commissionRate = Number.isFinite(referral.commissionRate)
                ? referral.commissionRate
                : defaultCommissionRate;

            const commissionAmount = Number(
                ((subscriptionAmount * commissionRate) / 100).toFixed(2)
            );

            if (commissionAmount > 0) {
                await Promise.all([
                    Referral.findByIdAndUpdate(referral._id, {
                        $inc: { totalEarnings: commissionAmount },
                        $set: { status: 'active', commissionRate }
                    }),
                    User.findByIdAndUpdate(referrerId, {
                        $inc: {
                            referralEarnings: commissionAmount,
                            totalReferralEarnings: commissionAmount
                        }
                    })
                ]);

                const buyerData = await User.findById(userId).select('name').lean();
                notifyCommissionEarned(
                    referrerId.toString(),
                    commissionAmount,
                    buyerData?.name || 'A user'
                ).catch(err => console.error('Error sending commission notification:', err));

                console.log(`[Razorpay] Commission of ₹${commissionAmount} credited to referrer ${referrerId}`);
                return commissionAmount;
            }
        }
    } catch (refError) {
        console.error('Error processing referral commission:', refError);
    }
    return null;
}

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

// POST /api/razorpay/verify-payment - Verify Razorpay payment signature and activate subscription
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

        // Signature verified, find and activate subscription
        const subscription = await UserSubscription.findOne({
            transactionId: orderId,
            user: userId
        }).populate('subscription');

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found for this order'
            });
        }

        // Only activate if not already completed
        if (subscription.paymentStatus !== 'completed') {
            subscription.paymentStatus = 'completed';
            subscription.isActive = true;
            subscription.razorpayPaymentId = razorpay_payment_id;
            subscription.razorpayOrderId = razorpay_order_id;
            await subscription.save();

            console.log(`[Razorpay] Subscription activated for order: ${orderId}, user: ${userId}`);

            // Send subscription purchased notification
            const subscriptionName = subscription.lockedSubscriptionName || subscription.subscription?.name || 'Subscription';
            try {
                await notifySubscriptionPurchased(
                    userId.toString(),
                    subscriptionName,
                    subscription.endDate
                );
                console.log(`[Razorpay] Notification sent for subscription: ${subscriptionName}`);
            } catch (notifyError) {
                console.error('[Razorpay] Error sending subscription notification:', notifyError);
            }

            // Process referral commission
            if (subscription.amount > 0) {
                await processReferralCommission(userId, subscription.amount, subscriptionName);
            }
        }

        return res.json({
            success: true,
            message: 'Payment verified and subscription activated successfully',
            subscription: subscription
        });
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
        const userId = req.user._id;

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
                    user: userId,
                    paymentStatus: 'pending'
                }).populate('subscription');

                if (subscription) {
                    subscription.paymentStatus = 'completed';
                    subscription.isActive = true;
                    subscription.razorpayPaymentId = capturedPayment.id;
                    subscription.razorpayOrderId = razorpayOrderId;
                    await subscription.save();

                    console.log(`[Razorpay] Subscription activated via status check for order: ${internalOrderId}`);

                    // Send subscription purchased notification
                    const subscriptionName = subscription.lockedSubscriptionName || subscription.subscription?.name || 'Subscription';
                    try {
                        await notifySubscriptionPurchased(
                            userId.toString(),
                            subscriptionName,
                            subscription.endDate
                        );
                        console.log(`[Razorpay] Notification sent for subscription: ${subscriptionName}`);
                    } catch (notifyError) {
                        console.error('[Razorpay] Error sending subscription notification:', notifyError);
                    }

                    // Process referral commission
                    if (subscription.amount > 0) {
                        await processReferralCommission(userId, subscription.amount, subscriptionName);
                    }
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
