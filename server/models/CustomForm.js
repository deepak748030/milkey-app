const mongoose = require('mongoose');

const customFormSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    formName: {
        type: String,
        required: [true, 'Form name is required'],
        trim: true,
        maxlength: [100, 'Form name cannot exceed 100 characters']
    },
    fields: [{
        label: {
            type: String,
            required: true,
            trim: true
        },
        value: {
            type: String,
            trim: true,
            default: ''
        }
    }],
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'approved', 'rejected'],
        default: 'pending'
    },
    adminNotes: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

// Index for faster queries
customFormSchema.index({ user: 1, createdAt: -1 });
customFormSchema.index({ status: 1 });

module.exports = mongoose.model('CustomForm', customFormSchema);
