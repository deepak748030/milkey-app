const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { notifyOrderStatusUpdate } = require('../lib/pushNotifications');

// GET /api/orders - Get user's orders
router.get('/', auth, async (req, res) => {
    try {
        const { status, limit = 20, page = 1 } = req.query;

        const query = { user: req.userId };
        if (status) query.status = status;

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            response: {
                data: orders,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get orders'
        });
    }
});

// GET /api/orders/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.userId
        }).lean();

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            response: order
        });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get order'
        });
    }
});

// POST /api/orders - Create new order
router.post('/', auth, async (req, res) => {
    try {
        const { items, deliveryAddress, notes, paymentMethod } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Order items are required'
            });
        }

        // Get user's address if delivery address not provided
        let finalDeliveryAddress = deliveryAddress?.trim() || '';
        if (!finalDeliveryAddress) {
            const User = require('../models/User');
            const user = await User.findById(req.userId).select('address').lean();
            if (user?.address) {
                finalDeliveryAddress = user.address.trim();
            }
        }

        // Calculate totals
        let totalAmount = 0;
        const orderItems = items.map(item => {
            const itemTotal = item.price * item.quantity;
            totalAmount += itemTotal;
            return {
                product: item.id || item.product,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                total: itemTotal
            };
        });

        const order = await Order.create({
            user: req.userId,
            items: orderItems,
            totalAmount,
            deliveryAddress: finalDeliveryAddress,
            notes: notes?.trim() || '',
            paymentMethod: paymentMethod || 'cash'
        });

        res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            response: order
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order'
        });
    }
});

// PUT /api/orders/:id/status
router.put('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;

        const validStatuses = ['pending', 'confirmed', 'processing', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const order = await Order.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            { status },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Send push notification for status update
        notifyOrderStatusUpdate(
            order.user.toString(),
            order._id.toString(),
            status,
            order.totalAmount
        ).catch(err => console.error('Error sending order status notification:', err));

        res.json({
            success: true,
            message: 'Order status updated',
            response: order
        });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status'
        });
    }
});

// DELETE /api/orders/:id - Cancel order
router.delete('/:id', auth, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (!['pending', 'confirmed'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel order in current status'
            });
        }

        order.status = 'cancelled';
        await order.save();

        res.json({
            success: true,
            message: 'Order cancelled successfully'
        });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order'
        });
    }
});

module.exports = router;
