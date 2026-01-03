const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const UserSubscription = require('../models/UserSubscription');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

// ZapUPI API configuration
const ZAPUPI_API_URL = 'https://api.zapupi.com/api';
const ZAPUPI_TOKEN_KEY = process.env.ZAPUPI_TOKEN_KEY;
const ZAPUPI_SECRET_KEY = process.env.ZAPUPI_SECRET_KEY;

// POST /api/zapupi/create-order - Create ZapUPI payment order
router.post('/create-order', auth, async (req, res) => {
    try {
        const { amount, orderId, customerMobile, redirectUrl, remark } = req.body;

        if (!amount || !orderId) {
            return res.status(400).json({
                success: false,
                message: 'Amount and order ID are required'
            });
        }

        if (!ZAPUPI_TOKEN_KEY || !ZAPUPI_SECRET_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Payment gateway not configured'
            });
        }

        // Create form data for x-www-form-urlencoded
        const formData = new URLSearchParams();
        formData.append('token_key', ZAPUPI_TOKEN_KEY);
        formData.append('secret_key', ZAPUPI_SECRET_KEY);
        formData.append('amount', amount.toString());
        formData.append('order_id', orderId);

        if (customerMobile) {
            formData.append('custumer_mobile', customerMobile);
        }
        if (redirectUrl) {
            formData.append('redirect_url', redirectUrl);
        }
        if (remark) {
            // Sanitize remark: remove special characters, keep only alphanumeric, spaces, and basic punctuation
            const sanitizedRemark = remark
                .replace(/[^a-zA-Z0-9\s\-_.]/g, '') // Remove special chars like colons
                .substring(0, 50) // Limit length
                .trim();
            if (sanitizedRemark) {
                formData.append('remark', sanitizedRemark);
            }
        }

        const response = await fetch(`${ZAPUPI_API_URL}/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        const data = await response.json();

        if (data.status === 'success') {
            res.json({
                success: true,
                response: {
                    paymentUrl: data.payment_url,
                    orderId: data.order_id,
                    paymentData: data.payment_data,
                    autoCheckUrl: data.auto_check_every_2_sec,
                    utrCheckUrl: data.utr_check
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: data.message || 'Failed to create payment order'
            });
        }
    } catch (error) {
        console.error('ZapUPI create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order'
        });
    }
});

// POST /api/zapupi/order-status - Check ZapUPI order status
router.post('/order-status', auth, async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        if (!ZAPUPI_TOKEN_KEY || !ZAPUPI_SECRET_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Payment gateway not configured'
            });
        }

        const formData = new URLSearchParams();
        formData.append('token_key', ZAPUPI_TOKEN_KEY);
        formData.append('secret_key', ZAPUPI_SECRET_KEY);
        formData.append('order_id', orderId);

        const response = await fetch(`${ZAPUPI_API_URL}/order-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        const data = await response.json();

        if (data.status === 'success') {
            res.json({
                success: true,
                response: {
                    orderId: data.data.order_id,
                    status: data.data.status,
                    amount: data.data.amount,
                    utr: data.data.utr,
                    txnId: data.data.txn_id,
                    customerMobile: data.data.custumer_mobile,
                    remark: data.data.remark,
                    createdAt: data.data.create_at
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: data.message || 'Order not found'
            });
        }
    } catch (error) {
        console.error('ZapUPI order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check order status'
        });
    }
});

// Helper function to parse order ID and extract subscription info
// Order ID format: SUB{userId}_{subscriptionId}_{timestamp} or similar
const parseOrderId = (orderId) => {
    try {
        // Expected format: SUB{shortUserId}{randomChars}
        // We need to store user and subscription info in a separate table or include in remark
        return { orderId };
    } catch (error) {
        return null;
    }
};

// POST /api/zapupi/webhook - Webhook for ZapUPI payment notifications
// This endpoint is called by ZapUPI when payment status changes
// NO AUTH REQUIRED - ZapUPI will call this directly
router.post('/webhook', async (req, res) => {
    try {
        console.log('ZapUPI Webhook received:', JSON.stringify(req.body));

        const {
            order_id,
            status,
            amount,
            utr,
            txn_id,
            custumer_mobile,
            remark
        } = req.body;

        if (!order_id) {
            console.log('Webhook: Missing order_id');
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // Log the payment status
        console.log(`Payment webhook: Order ${order_id} - Status: ${status} - Amount: ${amount} - UTR: ${utr}`);

        // Handle successful payment
        if (status === 'Success' || status === 'success') {
            console.log(`Payment successful for order: ${order_id}`);

            // Find pending subscription by order ID (stored in transactionId field)
            const pendingSubscription = await UserSubscription.findOne({
                transactionId: order_id,
                paymentStatus: 'pending'
            });

            if (pendingSubscription) {
                // Activate the subscription
                pendingSubscription.paymentStatus = 'completed';
                pendingSubscription.isActive = true;
                await pendingSubscription.save();

                console.log(`Subscription activated via webhook for order: ${order_id}, user: ${pendingSubscription.user}`);
            } else {
                console.log(`No pending subscription found for order: ${order_id}`);
            }
        } else if (status === 'Failed' || status === 'failed') {
            console.log(`Payment failed for order: ${order_id}`);

            // Mark subscription as failed
            const pendingSubscription = await UserSubscription.findOne({
                transactionId: order_id,
                paymentStatus: 'pending'
            });

            if (pendingSubscription) {
                pendingSubscription.paymentStatus = 'failed';
                pendingSubscription.isActive = false;
                await pendingSubscription.save();

                console.log(`Subscription marked as failed for order: ${order_id}`);
            }
        } else {
            console.log(`Payment pending for order: ${order_id} - Status: ${status}`);
        }

        // Always respond with success to acknowledge receipt
        res.json({
            success: true,
            message: 'Webhook received successfully'
        });
    } catch (error) {
        console.error('ZapUPI webhook error:', error);
        // Still return 200 to prevent retries
        res.json({
            success: true,
            message: 'Webhook processed'
        });
    }
});

// POST /api/zapupi/verify-and-activate - Verify payment and activate subscription
// Called by app after payment to ensure subscription is activated
router.post('/verify-and-activate', auth, async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.user._id;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // Check payment status with ZapUPI
        const formData = new URLSearchParams();
        formData.append('token_key', ZAPUPI_TOKEN_KEY);
        formData.append('secret_key', ZAPUPI_SECRET_KEY);
        formData.append('order_id', orderId);

        const response = await fetch(`${ZAPUPI_API_URL}/order-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        const data = await response.json();

        if (data.status === 'success' && (data.data.status === 'Success' || data.data.status === 'success')) {
            // Payment is successful, activate subscription
            const subscription = await UserSubscription.findOne({
                transactionId: orderId,
                user: userId
            });

            if (subscription) {
                if (subscription.paymentStatus !== 'completed') {
                    subscription.paymentStatus = 'completed';
                    subscription.isActive = true;
                    await subscription.save();
                    console.log(`Subscription activated via verify-and-activate for order: ${orderId}`);
                }

                return res.json({
                    success: true,
                    message: 'Subscription activated successfully',
                    subscription: subscription
                });
            } else {
                return res.status(404).json({
                    success: false,
                    message: 'Subscription not found for this order'
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'Payment not completed yet',
                status: data.data?.status || 'unknown'
            });
        }
    } catch (error) {
        console.error('Verify and activate error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment'
        });
    }
});

module.exports = router;
