const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        trim: true,
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    avatar: {
        type: String,
        default: ''
    },
    address: {
        type: String,
        default: '',
        maxlength: [500, 'Address cannot exceed 500 characters']
    },
    role: {
        type: String,
        enum: ['owner', 'staff', 'farmer'],
        default: 'owner'
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    referralEarnings: {
        type: Number,
        default: 0
    },
    totalReferralEarnings: {
        type: Number,
        default: 0
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    otp: {
        code: String,
        expiresAt: Date
    },
    expoPushToken: {
        type: String,
        default: ''
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true
});

// Generate unique referral code before saving
userSchema.pre('save', async function (next) {
    if (!this.referralCode) {
        const code = 'MLK' + this.phone.slice(-4) + Math.random().toString(36).substring(2, 6).toUpperCase();
        this.referralCode = code;
    }
    next();
});



module.exports = mongoose.model('User', userSchema);
