const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// GET /api/products - Get all products (public - no auth required)
router.get('/', async (req, res) => {
    try {
        const products = await Product.find({ isActive: true })
            .sort({ name: 1 })
            .lean();

        res.json({
            success: true,
            response: {
                data: products,
                count: products.length
            }
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get products'
        });
    }
});

// GET /api/products/default - Get default products (for new users)
router.get('/default', async (req, res) => {
    try {
        const defaultProducts = [
            { id: '1', name: 'Fresh Milk', price: 60, icon: '🥛', unit: 'liter' },
            { id: '2', name: 'Curd (Dahi)', price: 80, icon: '🍶', unit: 'kg' },
            { id: '3', name: 'Butter', price: 500, icon: '🧈', unit: 'kg' },
            { id: '4', name: 'Paneer', price: 380, icon: '🧀', unit: 'kg' }
        ];

        res.json({
            success: true,
            response: {
                data: defaultProducts,
                count: defaultProducts.length
            }
        });
    } catch (error) {
        console.error('Get default products error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get default products'
        });
    }
});

// POST /api/products
router.post('/', auth, async (req, res) => {
    try {
        const { name, price, unit, icon, description, stock } = req.body;

        if (!name || price === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Name and price are required'
            });
        }

        const product = await Product.create({
            name: name.trim(),
            price,
            unit: unit || 'liter',
            icon: icon || '🥛',
            description: description?.trim() || '',
            stock: stock || 0,
            owner: req.userId
        });

        res.status(201).json({
            success: true,
            message: 'Product added successfully',
            response: product
        });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add product'
        });
    }
});

// PUT /api/products/:id
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, price, unit, icon, description, stock } = req.body;

        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { name, price, unit, icon, description, stock },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Product updated successfully',
            response: product
        });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product'
        });
    }
});

// DELETE /api/products/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { isActive: false },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete product'
        });
    }
});

// POST /api/products/seed - Seed default products for user
router.post('/seed', auth, async (req, res) => {
    try {
        const existingProducts = await Product.countDocuments({ owner: req.userId });

        if (existingProducts > 0) {
            return res.status(400).json({
                success: false,
                message: 'Products already exist for this user'
            });
        }

        const defaultProducts = [
            { name: 'Fresh Milk', price: 60, icon: '🥛', unit: 'liter' },
            { name: 'Curd (Dahi)', price: 80, icon: '🍶', unit: 'kg' },
            { name: 'Butter', price: 500, icon: '🧈', unit: 'kg' },
            { name: 'Paneer', price: 380, icon: '🧀', unit: 'kg' }
        ];

        const products = await Product.insertMany(
            defaultProducts.map(p => ({ ...p, owner: req.userId }))
        );

        res.status(201).json({
            success: true,
            message: 'Default products created',
            response: { data: products, count: products.length }
        });
    } catch (error) {
        console.error('Seed products error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to seed products'
        });
    }
});

module.exports = router;
