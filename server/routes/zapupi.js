const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

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

            // TODO: Update your database here
            // - Mark order as paid
            // - Activate subscription
            // - Send notification to user

            // You can add your business logic here, for example:
            // await Order.findOneAndUpdate({ orderId: order_id }, { status: 'paid', transactionId: txn_id });
            // await UserSubscription.findOneAndUpdate({ orderId: order_id }, { status: 'active' });
        } else if (status === 'Failed' || status === 'failed') {
            console.log(`Payment failed for order: ${order_id}`);
            // Handle failed payment
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

module.exports = router;
