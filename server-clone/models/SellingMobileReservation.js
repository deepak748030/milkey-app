const mongoose = require('mongoose');

// The built-in unique _id index serializes a dairy/phone pair, even when
// production autoIndex is disabled. Legacy Member rows are not modified.
const schema = new mongoose.Schema({
    _id: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
}, { versionKey: false, timestamps: true });

module.exports = mongoose.model('SellingMobileReservation', schema);
