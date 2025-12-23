const express = require('express');
const router = express.Router();
const Farmer = require('../models/Farmer');
const Product = require('../models/Product');
const RateChart = require('../models/RateChart');
const MilkCollection = require('../models/MilkCollection');
const Payment = require('../models/Payment');
const Advance = require('../models/Advance');

// Mock farmers data
const mockFarmers = [
    { code: 'F001', name: 'Ramesh Kumar', mobile: '9876543210', address: 'Village Kheda, Dist. Anand' },
    { code: 'F002', name: 'Suresh Patel', mobile: '9876543211', address: 'Village Borsad, Dist. Anand' },
    { code: 'F003', name: 'Mahesh Singh', mobile: '9876543212', address: 'Village Petlad, Dist. Anand' },
    { code: 'F004', name: 'Dinesh Sharma', mobile: '9876543213', address: 'Village Nadiad, Dist. Kheda' },
    { code: 'F005', name: 'Rajesh Yadav', mobile: '9876543214', address: 'Village Dakor, Dist. Kheda' },
    { code: 'F006', name: 'Mukesh Verma', mobile: '9876543215', address: 'Village Kapadvanj, Dist. Kheda' },
    { code: 'F007', name: 'Naresh Joshi', mobile: '9876543216', address: 'Village Thasra, Dist. Kheda' },
    { code: 'F008', name: 'Kamlesh Prajapati', mobile: '9876543217', address: 'Village Mahudha, Dist. Kheda' },
    { code: 'F009', name: 'Hitesh Desai', mobile: '9876543218', address: 'Village Balasinor, Dist. Mahisagar' },
    { code: 'F010', name: 'Jitesh Modi', mobile: '9876543219', address: 'Village Lunawada, Dist. Mahisagar' },
];

// Mock products data
const mockProducts = [
    { name: 'Fresh Milk', price: 60, unit: 'liter', icon: '🥛', description: 'Fresh cow milk', stock: 100, isActive: true },
    { name: 'Buffalo Milk', price: 70, unit: 'liter', icon: '🐃', description: 'Fresh buffalo milk', stock: 80, isActive: true },
    { name: 'Paneer', price: 350, unit: 'kg', icon: '🧀', description: 'Fresh homemade paneer', stock: 20, isActive: true },
    { name: 'Ghee', price: 600, unit: 'kg', icon: '🫕', description: 'Pure desi ghee', stock: 15, isActive: true },
    { name: 'Curd', price: 50, unit: 'kg', icon: '🥣', description: 'Fresh curd', stock: 50, isActive: true },
    { name: 'Buttermilk', price: 30, unit: 'liter', icon: '🥤', description: 'Fresh buttermilk', stock: 40, isActive: true },
    { name: 'Cream', price: 250, unit: 'kg', icon: '🍦', description: 'Fresh cream', stock: 10, isActive: true },
    { name: 'Khoya', price: 400, unit: 'kg', icon: '🍮', description: 'Fresh khoya/mawa', stock: 8, isActive: true },
];

// Mock rate chart
const mockRateChart = {
    name: 'Standard Rate Chart',
    milkType: 'mixed',
    calculationType: 'fat_snf',
    fixedRate: 50,
    fatRate: 7.5,
    snfRate: 6.5,
    baseFat: 3.5,
    baseSnf: 8.5,
    baseRate: 50,
    isActive: true,
};

// Generate random milk collections for past 30 days
const generateMilkCollections = (farmers) => {
    const collections = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Random number of collections per day (3-8)
        const numCollections = Math.floor(Math.random() * 6) + 3;

        for (let j = 0; j < numCollections; j++) {
            const farmer = farmers[Math.floor(Math.random() * farmers.length)];
            const shift = Math.random() > 0.5 ? 'morning' : 'evening';
            const quantity = Math.round((Math.random() * 20 + 5) * 10) / 10; // 5-25 liters
            const fat = Math.round((Math.random() * 2 + 3) * 10) / 10; // 3-5%
            const snf = Math.round((Math.random() * 1.5 + 8) * 10) / 10; // 8-9.5%
            const rate = Math.round((50 + (fat - 3.5) * 7.5 + (snf - 8.5) * 6.5) * 100) / 100;
            const amount = Math.round(quantity * rate * 100) / 100;

            collections.push({
                farmer: farmer._id,
                date: date,
                shift,
                quantity,
                fat,
                snf,
                rate,
                amount,
                isPaid: Math.random() > 0.3,
                notes: '',
            });
        }
    }

    return collections;
};

// Generate payments for farmers
const generatePayments = (farmers) => {
    const payments = [];
    const today = new Date();

    for (let i = 0; i < 15; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - Math.floor(Math.random() * 30));

        const farmer = farmers[Math.floor(Math.random() * farmers.length)];
        const amount = Math.round(Math.random() * 5000 + 1000);
        const methods = ['cash', 'upi', 'bank'];

        payments.push({
            farmer: farmer._id,
            amount,
            date,
            paymentMethod: methods[Math.floor(Math.random() * methods.length)],
            reference: `PAY${Date.now()}${i}`,
            totalMilkAmount: amount + Math.round(Math.random() * 500),
            totalAdvanceDeduction: Math.round(Math.random() * 200),
            netPayable: amount,
        });
    }

    return payments;
};

// Generate advances for farmers
const generateAdvances = (farmers) => {
    const advances = [];
    const today = new Date();

    for (let i = 0; i < 10; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - Math.floor(Math.random() * 30));

        const farmer = farmers[Math.floor(Math.random() * farmers.length)];
        const amount = Math.round(Math.random() * 3000 + 500);
        const statuses = ['pending', 'settled', 'partial'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        advances.push({
            farmer: farmer._id,
            amount,
            date,
            note: ['Ghee advance', 'Cash advance', 'Festival advance', 'Emergency'][Math.floor(Math.random() * 4)],
            status,
            settledAmount: status === 'settled' ? amount : status === 'partial' ? Math.round(amount * 0.5) : 0,
        });
    }

    return advances;
};

// POST /api/seed - Seed all mock data
router.post('/', async (req, res) => {
    try {
        // Clear existing data (optional - remove if you want to keep existing data)
        const clearExisting = req.query.clear === 'true';

        if (clearExisting) {
            await Promise.all([
                Farmer.deleteMany({}),
                Product.deleteMany({}),
                RateChart.deleteMany({}),
                MilkCollection.deleteMany({}),
                Payment.deleteMany({}),
                Advance.deleteMany({}),
            ]);
        }

        // Seed farmers
        const existingFarmers = await Farmer.find({});
        let farmers;

        if (existingFarmers.length === 0) {
            farmers = await Farmer.insertMany(mockFarmers);
            console.log(`✅ Seeded ${farmers.length} farmers`);
        } else {
            farmers = existingFarmers;
            console.log(`ℹ️ ${farmers.length} farmers already exist`);
        }

        // Seed products
        const existingProducts = await Product.find({});
        if (existingProducts.length === 0) {
            const products = await Product.insertMany(mockProducts);
            console.log(`✅ Seeded ${products.length} products`);
        } else {
            console.log(`ℹ️ ${existingProducts.length} products already exist`);
        }

        // Seed rate chart
        const existingRateChart = await RateChart.findOne({ isActive: true });
        if (!existingRateChart) {
            await RateChart.create(mockRateChart);
            console.log(`✅ Seeded rate chart`);
        } else {
            console.log(`ℹ️ Rate chart already exists`);
        }

        // Seed milk collections
        const existingCollections = await MilkCollection.find({});
        if (existingCollections.length === 0 && farmers.length > 0) {
            const collections = generateMilkCollections(farmers);
            await MilkCollection.insertMany(collections);
            console.log(`✅ Seeded ${collections.length} milk collections`);
        } else {
            console.log(`ℹ️ ${existingCollections.length} milk collections already exist`);
        }

        // Seed payments
        const existingPayments = await Payment.find({});
        if (existingPayments.length === 0 && farmers.length > 0) {
            const payments = generatePayments(farmers);
            await Payment.insertMany(payments);
            console.log(`✅ Seeded ${payments.length} payments`);
        } else {
            console.log(`ℹ️ ${existingPayments.length} payments already exist`);
        }

        // Seed advances
        const existingAdvances = await Advance.find({});
        if (existingAdvances.length === 0 && farmers.length > 0) {
            const advances = generateAdvances(farmers);
            await Advance.insertMany(advances);
            console.log(`✅ Seeded ${advances.length} advances`);
        } else {
            console.log(`ℹ️ ${existingAdvances.length} advances already exist`);
        }

        // Get counts for response
        const counts = {
            farmers: await Farmer.countDocuments(),
            products: await Product.countDocuments(),
            rateCharts: await RateChart.countDocuments(),
            milkCollections: await MilkCollection.countDocuments(),
            payments: await Payment.countDocuments(),
            advances: await Advance.countDocuments(),
        };

        res.json({
            success: true,
            message: 'Mock data seeded successfully',
            response: counts,
        });

    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to seed data',
        });
    }
});

// GET /api/seed/status - Check current data counts
router.get('/status', async (req, res) => {
    try {
        const counts = {
            farmers: await Farmer.countDocuments(),
            products: await Product.countDocuments(),
            rateCharts: await RateChart.countDocuments(),
            milkCollections: await MilkCollection.countDocuments(),
            payments: await Payment.countDocuments(),
            advances: await Advance.countDocuments(),
        };

        res.json({
            success: true,
            message: 'Database status',
            response: counts,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get status',
        });
    }
});

// DELETE /api/seed/clear - Clear all data
router.delete('/clear', async (req, res) => {
    try {
        await Promise.all([
            Farmer.deleteMany({}),
            Product.deleteMany({}),
            RateChart.deleteMany({}),
            MilkCollection.deleteMany({}),
            Payment.deleteMany({}),
            Advance.deleteMany({}),
        ]);

        res.json({
            success: true,
            message: 'All data cleared successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to clear data',
        });
    }
});

module.exports = router;
