const mongoose = require('mongoose');
const Member = require('../models/Member');
const SellingMobileReservation = require('../models/SellingMobileReservation');
const { normalizeSellingMobile, sellingMobilePattern } = require('./selling-mobile');

const reservationKey = (owner, mobile) => `${String(owner)}:${mobile}`;
const phoneConflict = () => Object.assign(new Error('Phone number already registered'), { status: 409 });
const invalidPhone = () => Object.assign(new Error('Please enter a valid phone number'), { status: 400 });

async function claimMobile(owner, memberId, mobile, session) {
    const pattern = sellingMobilePattern(mobile);
    // An admin hard-delete or older out-of-band edit can leave an orphaned
    // reservation. Reclaim it only after confirming its member no longer owns
    // the number, and only within this transaction.
    const reservation = await SellingMobileReservation.findOne({ _id: reservationKey(owner, mobile), owner }).session(session).lean();
    if (reservation) {
        const holder = await Member.findOne({ _id: reservation.member, owner, mobile: pattern }).session(session).lean();
        if (holder) throw phoneConflict();
        await SellingMobileReservation.deleteOne({ _id: reservationKey(owner, mobile), owner, member: reservation.member }, { session });
    }
    try {
        await SellingMobileReservation.create([{ _id: reservationKey(owner, mobile), owner, member: memberId }], { session });
    } catch (error) {
        if (error.code === 11000) throw phoneConflict();
        throw error;
    }
    const duplicate = await Member.findOne({ owner, _id: { $ne: memberId }, mobile: pattern }).session(session).lean();
    if (duplicate) throw phoneConflict();
}

let reservationCollectionReady;
async function inSellingTransaction(work) {
    // The built-in _id index is available even when automatic indexes are off.
    if (!reservationCollectionReady) {
        reservationCollectionReady = SellingMobileReservation.createCollection().catch(error => {
            if (error.code !== 48 && error.codeName !== 'NamespaceExists') {
                reservationCollectionReady = null;
                throw error;
            }
        });
    }
    await reservationCollectionReady;
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => { result = await work(session); });
        return result;
    } finally {
        await session.endSession();
    }
}

// Existing duplicate/invalid records may be edited without changing their phone.
// A changed number is reserved, checked, and saved in the same transaction.
async function changeSellingMobile(owner, current, mobile, session) {
    const oldNumber = normalizeSellingMobile(current.mobile);
    const newNumber = normalizeSellingMobile(mobile);
    const unchanged = String(mobile).trim() === String(current.mobile).trim() ||
        (newNumber && oldNumber && newNumber === oldNumber);
    if (!unchanged) {
        if (!newNumber) throw invalidPhone();
        await claimMobile(owner, current._id, newNumber, session);
        if (oldNumber) {
            await SellingMobileReservation.deleteOne({ _id: reservationKey(owner, oldNumber), owner, member: current._id }, { session });
        }
    }
    return String(mobile).trim();
}

module.exports = { claimMobile, changeSellingMobile, inSellingTransaction, phoneConflict, invalidPhone };
