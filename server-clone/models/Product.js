const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    unit: {
        type: String,
        enum: ['liter', 'kg', 'piece'],
        default: 'liter'
    },
    icon: {
        type: String,
        default: '🥛'
    },
    image: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    stock: {
        type: Number,
        default: 0
    },
    subscriptionOnly: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

productSchema.index({ owner: 1 });

module.exports = mongoose.model('Product', productSchema);
