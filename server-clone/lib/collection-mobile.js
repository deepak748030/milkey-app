const mongoose = require('mongoose');
const Farmer = require('../models/Farmer');
const PurchaseFarmer = require('../models/PurchaseFarmer');
const Reservation = require('../models/CollectionMobileReservation');
const { normalizeSellingMobile, sellingMobilePattern } = require('./selling-mobile');

const key = (owner, mobile) => `${String(owner)}:${mobile}`;
const conflict = () => Object.assign(new Error('This mobile number is already registered to another farmer in this dairy.'), { status: 409, code: 'COLLECTION_MOBILE_EXISTS' });
const invalid = () => Object.assign(new Error('Please enter a valid mobile number.'), { status: 400, code: 'INVALID_COLLECTION_MOBILE' });
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let collectionReady;
async function inCollectionTransaction(work) {
    if (!collectionReady) {
        collectionReady = Reservation.createCollection().catch(error => {
            if (error.code !== 48 && error.codeName !== 'NamespaceExists') {
                collectionReady = null;
                throw error;
            }
        });
    }
    await collectionReady;
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => { result = await work(session); });
        return result;
    } finally {
        await session.endSession();
    }
}

// Called in the same transaction as the farmer write. Blank numbers remain
// optional. Unchanged old numbers (including historical duplicates) can still
// be edited without silently modifying existing records.
async function changeMobile({ owner, farmerId, code, previous, next, session, isNew = false }) {
    const text = next == null ? '' : String(next).trim();
    const oldText = previous == null ? '' : String(previous).trim();
    const oldNumber = normalizeSellingMobile(oldText);
    const newNumber = normalizeSellingMobile(text);
    if (!isNew && (text === oldText || (oldNumber && newNumber && oldNumber === newNumber))) return;
    if (text && !newNumber) throw invalid();

    if (newNumber) {
        const pattern = sellingMobilePattern(newNumber);
        // A hard-deleted farmer or an out-of-band edit can leave a reservation.
        // Reclaim only after verifying the stored farmer no longer owns it;
        // delete and replacement are part of this same transaction.
        const reservation = await Reservation.findOne({ _id: key(owner, newNumber), owner }).session(session).lean();
        if (reservation) {
            const holder = await Farmer.findOne({ _id: reservation.farmer, owner, mobile: pattern }).session(session).lean();
            if (holder) throw conflict();
            await Reservation.deleteOne({ _id: key(owner, newNumber), owner, farmer: reservation.farmer }, { session });
        }
        try {
            await Reservation.create([{ _id: key(owner, newNumber), owner, farmer: farmerId }], { session });
        } catch (error) {
            if (error.code === 11000) throw conflict();
            throw error;
        }
        const legacyCode = new RegExp(`^\\s*${escapeRegExp(String(code || '').trim())}\\s*$`, 'i');
        // PurchaseFarmer contains old split-model data; same owner+code is the
        // companion of this Farmer, not a second customer. Search inactive too.
        const duplicate = await Farmer.findOne({ owner, _id: { $ne: farmerId }, mobile: pattern }).session(session).lean();
        const legacyDuplicate = await PurchaseFarmer.findOne({ owner, code: { $not: legacyCode }, mobile: pattern }).session(session).lean();
        if (duplicate || legacyDuplicate) throw conflict();
    }
    if (oldNumber) {
        await Reservation.deleteOne({ _id: key(owner, oldNumber), owner, farmer: farmerId }, { session });
    }
}

module.exports = { inCollectionTransaction, changeMobile };
