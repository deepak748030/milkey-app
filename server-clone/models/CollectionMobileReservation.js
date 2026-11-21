const mongoose = require('mongoose');

// A unique _id serializes same-dairy phone claims even when autoIndex is off.
// Existing farmers and historical duplicate records are never rewritten.
const schema = new mongoose.Schema({
    _id: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
}, { versionKey: false, timestamps: true });

module.exports = mongoose.model('CollectionMobileReservation', schema);
