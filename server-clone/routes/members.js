const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const SellingEntry = require('../models/SellingEntry');
const MemberPayment = require('../models/MemberPayment');
const auth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');

// GET /api/members/balance-report - Get all members with balance calculated from unpaid entries
router.get('/balance-report', auth, async (req, res) => {
    try {
        // Get all active members for the user
        const members = await Member.find({ owner: req.userId, isActive: true })
            .sort({ name: 1 })
            .lean();

        // Get all unpaid selling entries grouped by member
        const unpaidEntriesAggregation = await SellingEntry.aggregate([
            {
                $match: {
                    owner: req.userId,
                    isPaid: false
                }
            },
            {
                $group: {
                    _id: '$member',
                    unpaidAmount: { $sum: '$amount' },
                    unpaidQuantity: { $sum: { $add: ['$morningQuantity', '$eveningQuantity'] } },
                    unpaidEntriesCount: { $sum: 1 }
                }
            }
        ]);

        // Create a map for quick lookup
        const unpaidByMember = new Map(
            unpaidEntriesAggregation.map(item => [String(item._id), item])
        );

        // Get last payment date for each member
        const lastPaymentsAggregation = await MemberPayment.aggregate([
            {
                $match: {
                    owner: req.userId
                }
            },
            {
                $sort: { date: -1 }
            },
            {
                $group: {
                    _id: '$member',
                    lastPaymentDate: { $first: '$date' },
                    lastPeriodEnd: { $first: '$periodEnd' }
                }
            }
        ]);

        // Create a map for last payments
        const lastPaymentByMember = new Map(
            lastPaymentsAggregation.map(item => [String(item._id), item])
        );

        // Build the report data for each member
        const reportData = members.map(member => {
            const memberIdStr = String(member._id);
            const unpaidData = unpaidByMember.get(memberIdStr) || {
                unpaidAmount: 0,
                unpaidQuantity: 0,
                unpaidEntriesCount: 0
            };
            const lastPayment = lastPaymentByMember.get(memberIdStr);

            // Current balance from member record (already includes previous settlements)
            const currentBalance = Number(member.sellingPaymentBalance || 0);

            // Total balance = current balance (from past) + unpaid entries amount
            // Note: sellingPaymentBalance already includes settled entries, so we add only truly unpaid amounts
            const totalBalance = currentBalance + unpaidData.unpaidAmount;

            return {
                _id: member._id,
                name: member.name,
                mobile: member.mobile,
                ratePerLiter: member.ratePerLiter,
                // Balance values
                currentBalance, // From member record (balance after last payment)
                unpaidAmount: unpaidData.unpaidAmount, // Sum of unpaid entries
                totalBalance, // Total payable = currentBalance + unpaidAmount
                unpaidEntriesCount: unpaidData.unpaidEntriesCount,
                unpaidQuantity: unpaidData.unpaidQuantity,
                // Date info
                date: new Date().toISOString().split('T')[0], // Today's date
                lastPaymentDate: lastPayment?.lastPaymentDate || null,
                lastPeriodEnd: lastPayment?.lastPeriodEnd || null
            };
        });

        // Calculate summary totals
        const totalPositiveBalance = reportData
            .filter(m => m.totalBalance > 0)
            .reduce((sum, m) => sum + m.totalBalance, 0);

        const totalNegativeBalance = reportData
            .filter(m => m.totalBalance < 0)
            .reduce((sum, m) => sum + Math.abs(m.totalBalance), 0);

        const netBalance = reportData.reduce((sum, m) => sum + m.totalBalance, 0);
        const totalUnpaidAmount = reportData.reduce((sum, m) => sum + m.unpaidAmount, 0);
        const totalUnpaidQuantity = reportData.reduce((sum, m) => sum + m.unpaidQuantity, 0);

        res.json({
            success: true,
            response: {
                data: reportData,
                summary: {
                    totalMembers: members.length,
                    totalReceivable: totalPositiveBalance, // Members who owe money
                    totalPayable: totalNegativeBalance, // Members who have credit
                    netBalance,
                    totalUnpaidAmount,
                    totalUnpaidQuantity
                }
            }
        });
    } catch (error) {
        console.error('Get balance report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get balance report'
        });
    }
});

// GET /api/members - Get all members for current user (10-10 pagination)
router.get('/', auth, async (req, res) => {
    try {
        const { search, includeInactive, limit, page } = req.query;
        const query = { owner: req.userId };

        // Only filter active unless includeInactive is requested
        if (includeInactive !== 'true') {
            query.isActive = true;
        }

        if (search) {
            // Search by both name and mobile number
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }

        const limitNum = parseInt(limit) ? Math.min(100, Math.max(1, parseInt(limit))) : 0;
        const pageNum = Math.max(1, parseInt(page) || 1);

        let findQuery = Member.find(query).sort({ isActive: -1, name: 1 }).lean();
        if (limitNum) {
            findQuery = findQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
        }

        const [members, total] = await Promise.all([
            findQuery,
            Member.countDocuments(query)
        ]);

        res.json({
            success: true,
            response: {
                data: members,
                count: members.length,
                total,
                page: pageNum,
                pages: limitNum ? Math.ceil(total / limitNum) : 1
            }
        });
    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get members'
        });
    }
});

// GET /api/members/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const member = await Member.findOne({
            _id: req.params.id,
            owner: req.userId
        }).lean();

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        res.json({
            success: true,
            response: member
        });
    } catch (error) {
        console.error('Get member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get member'
        });
    }
});

// POST /api/members (requires selling subscription)
router.post('/', auth, requireSubscription('selling'), async (req, res) => {
    try {
        const {
            name,
            mobile,
            address,
            ratePerLiter = 50,
            dailyAutoEntry,
            defaultMorningQuantity,
            defaultEveningQuantity,
            defaultNotes
        } = req.body;

        if (!name || !mobile) {
            return res.status(400).json({
                success: false,
                message: 'Name and mobile are required'
            });
        }

        const member = await Member.create({
            name: String(name).trim(),
            mobile: String(mobile).trim(),
            address: address?.trim() || '',
            ratePerLiter: parseFloat(ratePerLiter) || 50,
            dailyAutoEntry: !!dailyAutoEntry,
            defaultMorningQuantity: Math.max(0, parseFloat(defaultMorningQuantity) || 0),
            defaultEveningQuantity: Math.max(0, parseFloat(defaultEveningQuantity) || 0),
            defaultNotes: defaultNotes?.trim() || '',
            owner: req.userId
        });

        // Non-blocking WhatsApp welcome to the new member (dedup-safe)
        try {
            const { sendMemberWelcome } = require('../lib/whatsappZyptos');
            sendMemberWelcome(member).catch(err =>
                console.error('[whatsapp] member welcome send failed:', err?.message || err)
            );
        } catch (waErr) {
            console.error('[whatsapp] member welcome hook error:', waErr?.message || waErr);
        }

        res.status(201).json({
            success: true,
            message: 'Member added successfully',
            response: member
        });
    } catch (error) {
        console.error('Create member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add member'
        });
    }
});

// PUT /api/members/:id (requires selling subscription)
router.put('/:id', auth, requireSubscription('selling'), async (req, res) => {
    try {
        const { name, mobile, address, ratePerLiter, dailyAutoEntry, defaultMorningQuantity, defaultEveningQuantity, defaultNotes } = req.body;

        const updateData = {};
        if (name) updateData.name = String(name).trim();
        if (mobile) updateData.mobile = String(mobile).trim();
        if (address !== undefined) updateData.address = address?.trim() || '';
        if (ratePerLiter !== undefined) updateData.ratePerLiter = parseFloat(ratePerLiter) || 50;
        if (dailyAutoEntry !== undefined) updateData.dailyAutoEntry = !!dailyAutoEntry;
        if (defaultMorningQuantity !== undefined) updateData.defaultMorningQuantity = Math.max(0, parseFloat(defaultMorningQuantity) || 0);
        if (defaultEveningQuantity !== undefined) updateData.defaultEveningQuantity = Math.max(0, parseFloat(defaultEveningQuantity) || 0);
        if (defaultNotes !== undefined) updateData.defaultNotes = String(defaultNotes || '').trim();

        const member = await Member.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            updateData,
            { new: true }
        );

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        res.json({
            success: true,
            message: 'Member updated successfully',
            response: member
        });
    } catch (error) {
        console.error('Update member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update member'
        });
    }
});

// DELETE /api/members/:id (requires selling subscription)
router.delete('/:id', auth, requireSubscription('selling'), async (req, res) => {
    try {
        const member = await Member.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { isActive: false },
            { new: true }
        );

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        res.json({
            success: true,
            message: 'Member deleted successfully'
        });
    } catch (error) {
        console.error('Delete member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete member'
        });
    }
});

// Restore inactive member - dairy owner can re-activate
router.put('/:id/restore', auth, requireSubscription('selling'), async (req, res) => {
    try {
        const member = await Member.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { isActive: true },
            { new: true }
        );
        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }
        res.json({ success: true, message: 'Member restored successfully', response: member });
    } catch (error) {
        console.error('Restore member error:', error);
        res.status(500).json({ success: false, message: 'Failed to restore member' });
    }
});

module.exports = router;
