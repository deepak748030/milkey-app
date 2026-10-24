require('dotenv').config();
// Reuse outbound TCP sockets globally (Cloudinary, push, WhatsApp, Razorpay, etc.)
// — saves a TLS handshake per outbound call.
const http = require('http');
const https = require('https');
http.globalAgent.keepAlive = true;
http.globalAgent.maxSockets = 128;
https.globalAgent.keepAlive = true;
https.globalAgent.maxSockets = 128;
// Cache DNS lookups so repeat outbound calls skip the resolver round-trip.
try { require('dns').setDefaultResultOrder('ipv4first'); } catch (_) { }

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
const faqRoutes = require('./routes/faqs');
const videoRoutes = require('./routes/videoTutorials');
const categoryRoutes = require('./routes/categories');
const deviceRoutes = require('./routes/devices');
const adRoutes = require('./routes/ads');
const adminAdPopupsRoutes = require('./routes/adminAdPopups');
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
const userSubscriptionRoutes = require('./routes/user-subscriptions');
const notificationRoutes = require('./routes/notifications');
const withdrawalRoutes = require('./routes/withdrawals');
const zapupiRoutes = require('./routes/zapupi');
const razorpayRoutes = require('./routes/razorpay');
const printSettingsRoutes = require('./routes/print-settings');
const milkRateSettingsRoutes = require('./routes/milk-rate-settings');

const cache = require('./lib/cache');

// Mongoose tuning — safe, query results identical.
mongoose.set('strictQuery', true);
if (process.env.NODE_ENV === 'production') {
    // Don't auto-build indexes on every boot in prod (huge cold-start win).
    mongoose.set('autoIndex', false);
}

const app = express();

// Trust the Vercel / proxy layer so req.ip / rate limit work correctly.
app.set('trust proxy', 1);
app.disable('x-powered-by');
// Strong ETags so conditional GETs (304) work for unchanged JSON.
app.set('etag', 'strong');

// Security middleware - keep helmet but don't block CORS
app.use(helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false
}));

// CORS configuration - allow all by default (no env required)
const corsOptions = {
    origin: function (origin, callback) { callback(null, true); },
    credentials: false,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Compression for better performance (skip already-compressed payloads)
app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

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

// Global HTTP response cache (per-Authorization, auto-invalidating).
// Safe no-op when Upstash Redis env vars aren't set.
app.use(cache.httpCache({ ttl: 30 }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/ad-popups', adminAdPopupsRoutes);
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
app.use('/api/user-subscriptions', userSubscriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/zapupi', zapupiRoutes);
app.use('/api/razorpay', razorpayRoutes);
app.use('/api/print-settings', printSettingsRoutes);
app.use('/api/milk-rate-settings', milkRateSettingsRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/devices', deviceRoutes);

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
            maxPoolSize: 50,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            // Faster writes with the same durability guarantees for our use case
            retryWrites: true,
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
