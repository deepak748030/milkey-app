const express = require('express');
const router = express.Router();
const MilkCollection = require('../models/MilkCollection');
const Payment = require('../models/Payment');
const Farmer = require('../models/Farmer');
const auth = require('../middleware/auth');

// Get milk collection report
router.get('/milk-collections', auth, async (req, res) => {
    try {
        const { startDate, endDate, farmerCode, shift, groupBy = 'date' } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Start and end dates are required' });
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const matchStage = {
            owner: req.user._id,
            date: { $gte: start, $lte: end }
        };

        if (farmerCode) {
            const farmer = await Farmer.findOne({ code: farmerCode, owner: req.user._id });
            if (farmer) matchStage.farmer = farmer._id;
        }
        if (shift) matchStage.shift = shift;

        // Get raw data
        const collections = await MilkCollection.find(matchStage)
            .populate('farmer', 'code name')
            .sort({ date: -1 });

        // Calculate summary
        const summary = {
            totalQuantity: 0,
            totalAmount: 0,
            avgRate: 0,
            avgFat: 0,
            avgSnf: 0,
            morningQty: 0,
            eveningQty: 0,
            farmersCount: new Set(),
            collectionsCount: collections.length
        };

        let fatSum = 0, snfSum = 0, rateSum = 0;
        collections.forEach(c => {
            summary.totalQuantity += c.quantity;
            summary.totalAmount += c.amount;
            rateSum += c.rate;
            fatSum += c.fat || 0;
            snfSum += c.snf || 0;
            if (c.shift === 'morning') summary.morningQty += c.quantity;
            else summary.eveningQty += c.quantity;
            if (c.farmer) summary.farmersCount.add(c.farmer._id.toString());
        });

        if (collections.length > 0) {
            summary.avgRate = rateSum / collections.length;
            summary.avgFat = fatSum / collections.length;
            summary.avgSnf = snfSum / collections.length;
        }
        summary.farmersCount = summary.farmersCount.size;

        // Group data based on groupBy
        let groupedData = {};
        if (groupBy === 'farmer') {
            collections.forEach(c => {
                const key = c.farmer?.code || 'Unknown';
                if (!groupedData[key]) {
                    groupedData[key] = {
                        farmer: c.farmer,
                        quantity: 0,
                        amount: 0,
                        collections: 0,
                        morningQty: 0,
                        eveningQty: 0
                    };
                }
                groupedData[key].quantity += c.quantity;
                groupedData[key].amount += c.amount;
                groupedData[key].collections++;
                if (c.shift === 'morning') groupedData[key].morningQty += c.quantity;
                else groupedData[key].eveningQty += c.quantity;
            });
        } else {
            // Group by date
            collections.forEach(c => {
                const dateKey = new Date(c.date).toISOString().split('T')[0];
                if (!groupedData[dateKey]) {
                    groupedData[dateKey] = {
                        date: dateKey,
                        quantity: 0,
                        amount: 0,
                        collections: 0,
                        morningQty: 0,
                        eveningQty: 0
                    };
                }
                groupedData[dateKey].quantity += c.quantity;
                groupedData[dateKey].amount += c.amount;
                groupedData[dateKey].collections++;
                if (c.shift === 'morning') groupedData[dateKey].morningQty += c.quantity;
                else groupedData[dateKey].eveningQty += c.quantity;
            });
        }

        res.json({
            success: true,
            response: {
                period: { startDate: start, endDate: end },
                summary: {
                    ...summary,
                    avgRate: Math.round(summary.avgRate * 100) / 100,
                    avgFat: Math.round(summary.avgFat * 100) / 100,
                    avgSnf: Math.round(summary.avgSnf * 100) / 100,
                    totalQuantity: Math.round(summary.totalQuantity * 100) / 100,
                    totalAmount: Math.round(summary.totalAmount * 100) / 100
                },
                groupedData: Object.values(groupedData),
                details: collections.map(c => ({
                    _id: c._id,
                    date: c.date,
                    shift: c.shift,
                    farmer: c.farmer,
                    quantity: c.quantity,
                    fat: c.fat,
                    snf: c.snf,
                    rate: c.rate,
                    amount: c.amount
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get payments report
router.get('/payments', auth, async (req, res) => {
    try {
        const { startDate, endDate, farmerCode, paymentMethod } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Start and end dates are required' });
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const matchStage = {
            owner: req.user._id,
            date: { $gte: start, $lte: end }
        };

        if (farmerCode) {
            const farmer = await Farmer.findOne({ code: farmerCode, owner: req.user._id });
            if (farmer) matchStage.farmer = farmer._id;
        }
        if (paymentMethod) matchStage.paymentMethod = paymentMethod;

        const payments = await Payment.find(matchStage)
            .populate('farmer', 'code name mobile')
            .sort({ date: -1 });

        // Calculate summary
        const summary = {
            totalPayments: payments.length,
            totalAmount: 0,
            totalMilkAmount: 0,
            totalAdvanceDeduction: 0,
            farmersCount: new Set(),
            byMethod: { cash: 0, upi: 0, bank: 0, cheque: 0 }
        };

        payments.forEach(p => {
            summary.totalAmount += p.amount;
            summary.totalMilkAmount += p.totalMilkAmount || 0;
            summary.totalAdvanceDeduction += p.totalAdvanceDeduction || 0;
            if (p.farmer) summary.farmersCount.add(p.farmer._id.toString());
            if (p.paymentMethod && summary.byMethod[p.paymentMethod] !== undefined) {
                summary.byMethod[p.paymentMethod] += p.amount;
            }
        });

        summary.farmersCount = summary.farmersCount.size;

        // Group by farmer
        const groupedByFarmer = {};
        payments.forEach(p => {
            const key = p.farmer?.code || 'Unknown';
            if (!groupedByFarmer[key]) {
                groupedByFarmer[key] = {
                    farmer: p.farmer,
                    totalAmount: 0,
                    paymentsCount: 0
                };
            }
            groupedByFarmer[key].totalAmount += p.amount;
            groupedByFarmer[key].paymentsCount++;
        });

        res.json({
            success: true,
            response: {
                period: { startDate: start, endDate: end },
                summary: {
                    ...summary,
                    totalAmount: Math.round(summary.totalAmount * 100) / 100,
                    totalMilkAmount: Math.round(summary.totalMilkAmount * 100) / 100,
                    totalAdvanceDeduction: Math.round(summary.totalAdvanceDeduction * 100) / 100
                },
                groupedByFarmer: Object.values(groupedByFarmer),
                details: payments.map(p => ({
                    _id: p._id,
                    date: p.date,
                    farmer: p.farmer,
                    amount: p.amount,
                    paymentMethod: p.paymentMethod,
                    reference: p.reference,
                    totalMilkAmount: p.totalMilkAmount,
                    totalAdvanceDeduction: p.totalAdvanceDeduction
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get farmer statement
router.get('/farmer-statement/:farmerCode', auth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const { farmerCode } = req.params;

        const farmer = await Farmer.findOne({ code: farmerCode, owner: req.user._id });
        if (!farmer) {
            return res.status(404).json({ success: false, message: 'Farmer not found' });
        }

        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1)); // Start of month
        start.setHours(0, 0, 0, 0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const collections = await MilkCollection.find({
            farmer: farmer._id,
            date: { $gte: start, $lte: end }
        }).sort({ date: 1 });

        const payments = await Payment.find({
            farmer: farmer._id,
            date: { $gte: start, $lte: end }
        }).sort({ date: 1 });

        // Build statement
        const statement = [];
        let runningBalance = 0;

        // Merge and sort by date
        const allItems = [
            ...collections.map(c => ({ type: 'collection', date: c.date, data: c })),
            ...payments.map(p => ({ type: 'payment', date: p.date, data: p }))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        allItems.forEach(item => {
            if (item.type === 'collection') {
                runningBalance += item.data.amount;
                statement.push({
                    date: item.data.date,
                    type: 'collection',
                    description: `Milk ${item.data.shift} - ${item.data.quantity}L @ ₹${item.data.rate}`,
                    credit: item.data.amount,
                    debit: 0,
                    balance: runningBalance
                });
            } else {
                runningBalance -= item.data.amount;
                statement.push({
                    date: item.data.date,
                    type: 'payment',
                    description: `Payment (${item.data.paymentMethod})`,
                    credit: 0,
                    debit: item.data.amount,
                    balance: runningBalance
                });
            }
        });

        // Summary
        const totalMilk = collections.reduce((sum, c) => sum + c.quantity, 0);
        const totalMilkAmount = collections.reduce((sum, c) => sum + c.amount, 0);
        const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

        res.json({
            success: true,
            response: {
                farmer: { _id: farmer._id, code: farmer.code, name: farmer.name, mobile: farmer.mobile },
                period: { startDate: start, endDate: end },
                summary: {
                    totalMilk: Math.round(totalMilk * 100) / 100,
                    totalMilkAmount: Math.round(totalMilkAmount * 100) / 100,
                    totalPayments: Math.round(totalPayments * 100) / 100,
                    closingBalance: Math.round(runningBalance * 100) / 100,
                    collectionsCount: collections.length,
                    paymentsCount: payments.length
                },
                statement
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Dashboard summary
router.get('/dashboard', auth, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);

        // Today's collections
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        const [todayCollections, monthCollections, weekPayments, totalFarmers] = await Promise.all([
            MilkCollection.aggregate([
                { $match: { owner: req.user._id, date: { $gte: today, $lte: todayEnd } } },
                { $group: { _id: null, quantity: { $sum: '$quantity' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
            ]),
            MilkCollection.aggregate([
                { $match: { owner: req.user._id, date: { $gte: monthStart } } },
                { $group: { _id: null, quantity: { $sum: '$quantity' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
            ]),
            Payment.aggregate([
                { $match: { owner: req.user._id, date: { $gte: weekStart } } },
                { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
            ]),
            Farmer.countDocuments({ owner: req.user._id, isActive: true })
        ]);

        res.json({
            success: true,
            response: {
                today: todayCollections[0] || { quantity: 0, amount: 0, count: 0 },
                thisMonth: monthCollections[0] || { quantity: 0, amount: 0, count: 0 },
                weekPayments: weekPayments[0] || { amount: 0, count: 0 },
                totalFarmers
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Analytics - Daily/Weekly/Monthly trends
router.get('/analytics', auth, async (req, res) => {
    try {
        const { period = 'daily', days = 7 } = req.query;

        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        const startDate = new Date();
        if (period === 'weekly') {
            startDate.setDate(startDate.getDate() - (parseInt(days) * 7));
        } else if (period === 'monthly') {
            startDate.setMonth(startDate.getMonth() - parseInt(days));
        } else {
            startDate.setDate(startDate.getDate() - parseInt(days));
        }
        startDate.setHours(0, 0, 0, 0);

        // Get daily collections
        const collections = await MilkCollection.aggregate([
            {
                $match: {
                    owner: req.user._id,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$date' }
                    },
                    quantity: { $sum: '$quantity' },
                    amount: { $sum: '$amount' },
                    count: { $sum: 1 },
                    morningQty: {
                        $sum: { $cond: [{ $eq: ['$shift', 'morning'] }, '$quantity', 0] }
                    },
                    eveningQty: {
                        $sum: { $cond: [{ $eq: ['$shift', 'evening'] }, '$quantity', 0] }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Get daily payments
        const payments = await Payment.aggregate([
            {
                $match: {
                    owner: req.user._id,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$date' }
                    },
                    amount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Generate all dates in range for complete chart data
        const allDates = [];
        const current = new Date(startDate);
        while (current <= endDate) {
            allDates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }

        // Map data to dates
        const collectionsMap = {};
        collections.forEach(c => { collectionsMap[c._id] = c; });

        const paymentsMap = {};
        payments.forEach(p => { paymentsMap[p._id] = p; });

        const chartData = allDates.map(date => ({
            date,
            label: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            quantity: collectionsMap[date]?.quantity || 0,
            amount: collectionsMap[date]?.amount || 0,
            morningQty: collectionsMap[date]?.morningQty || 0,
            eveningQty: collectionsMap[date]?.eveningQty || 0,
            payments: paymentsMap[date]?.amount || 0
        }));

        // Calculate totals
        const totals = {
            totalQuantity: chartData.reduce((sum, d) => sum + d.quantity, 0),
            totalAmount: chartData.reduce((sum, d) => sum + d.amount, 0),
            totalPayments: chartData.reduce((sum, d) => sum + d.payments, 0),
            avgDailyQty: chartData.length > 0 ? chartData.reduce((sum, d) => sum + d.quantity, 0) / chartData.length : 0,
            maxQty: Math.max(...chartData.map(d => d.quantity)),
            minQty: Math.min(...chartData.filter(d => d.quantity > 0).map(d => d.quantity)) || 0
        };

        res.json({
            success: true,
            response: {
                period: { startDate, endDate },
                chartData,
                totals: {
                    ...totals,
                    totalQuantity: Math.round(totals.totalQuantity * 100) / 100,
                    totalAmount: Math.round(totals.totalAmount * 100) / 100,
                    avgDailyQty: Math.round(totals.avgDailyQty * 100) / 100
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Top farmers analytics
router.get('/top-farmers', auth, async (req, res) => {
    try {
        const { days = 30, limit = 10 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        startDate.setHours(0, 0, 0, 0);

        const topFarmers = await MilkCollection.aggregate([
            {
                $match: {
                    owner: req.user._id,
                    date: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$farmer',
                    totalQuantity: { $sum: '$quantity' },
                    totalAmount: { $sum: '$amount' },
                    collections: { $sum: 1 },
                    avgRate: { $avg: '$rate' }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'farmers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'farmerInfo'
                }
            },
            { $unwind: '$farmerInfo' }
        ]);

        res.json({
            success: true,
            response: topFarmers.map(f => ({
                farmer: {
                    _id: f._id,
                    code: f.farmerInfo.code,
                    name: f.farmerInfo.name
                },
                totalQuantity: Math.round(f.totalQuantity * 100) / 100,
                totalAmount: Math.round(f.totalAmount * 100) / 100,
                collections: f.collections,
                avgRate: Math.round(f.avgRate * 100) / 100
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
