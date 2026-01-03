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
            formData.append('remark', remark);
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

module.exports = router;
