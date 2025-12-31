require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const farmerRoutes = require('./routes/farmers');
const purchaseFarmerRoutes = require('./routes/purchase-farmers');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const advanceRoutes = require('./routes/advances');
const referralRoutes = require('./routes/referrals');
const milkCollectionRoutes = require('./routes/milk-collections');
const paymentRoutes = require('./routes/payments');
const rateChartRoutes = require('./routes/rate-charts');
const reportRoutes = require('./routes/reports');
const feedbackRoutes = require('./routes/feedback');
const seedRoutes = require('./routes/seed');
const memberRoutes = require('./routes/members');
const sellingEntryRoutes = require('./routes/selling-entries');
const customFormRoutes = require('./routes/custom-forms');
const memberPaymentRoutes = require('./routes/member-payments');
const subscriptionRoutes = require('./routes/subscriptions');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression for better performance
app.use(compression());

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' }
});
// app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Milkey API is running',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/purchase-farmers', purchaseFarmerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/advances', advanceRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/milk-collections', milkCollectionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/rate-charts', rateChartRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/custom-forms', customFormRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/selling-entries', sellingEntryRoutes);
app.use('/api/member-payments', memberPaymentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// MongoDB connection with optimized settings
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        process.exit(1);
    }
};

// Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Milkey Server running on port ${PORT}`);
        console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

module.exports = app;
