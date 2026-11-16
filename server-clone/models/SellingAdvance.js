const mongoose = require('mongoose');

/**
 * Isolated advance ledger for Selling customers.
 *
 * IMPORTANT: This is a NEW collection. It never writes to Member,
 * SellingEntry, MemberPayment, Farmer, or the existing Advance collection,
 * so all pre-existing selling/collection data remains untouched.
 */
const sellingAdvanceSchema = new mongoose.Schema({
    member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [1, 'Amount must be at least 1'],
    },
    date: {
        type: Date,
        default: Date.now,
    },
    note: {
        type: String,
        trim: true,
        default: '',
    },
    // "given" increases advance pending; "adjusted" reduces it.
    type: {
        type: String,
        enum: ['given', 'adjusted'],
        default: 'given',
    },
    status: {
        type: String,
        enum: ['pending', 'partial', 'settled'],
        default: 'pending',
    },
    settledAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

sellingAdvanceSchema.index({ owner: 1, member: 1, date: -1 });
sellingAdvanceSchema.index({ owner: 1, type: 1, status: 1 });
sellingAdvanceSchema.index({ date: -1 });

module.exports = mongoose.model('SellingAdvance', sellingAdvanceSchema);
