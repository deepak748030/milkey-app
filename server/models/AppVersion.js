const mongoose = require('mongoose');

const appVersionSchema = new mongoose.Schema({
    latestVersion: {
        type: String,
        required: true,
        trim: true,
        default: '1.0.0'
    },
    minVersion: {
        type: String,
        required: true,
        trim: true,
        default: '1.0.0'
    },
    playStoreLink: {
        type: String,
        trim: true,
        default: ''
    },
    appStoreLink: {
        type: String,
        trim: true,
        default: ''
    },
    forceUpdate: {
        type: Boolean,
        default: false
    },
    updateMessage: {
        type: String,
        trim: true,
        default: 'A new version is available. Please update for the best experience.'
    },
    forceUpdateMessage: {
        type: String,
        trim: true,
        default: 'This version is no longer supported. Please update to continue using the app.'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AppVersion', appVersionSchema);
