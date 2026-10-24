const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['feedback', 'complaint', 'suggestion', 'query', 'bug_report'],
        default: 'feedback'
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true,
        maxLength: 200
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxLength: 2000
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in_review', 'resolved', 'closed'],
        default: 'pending'
    },
    adminResponse: {
        type: String,
        trim: true,
        default: ''
    },
    respondedAt: {
        type: Date
    },
    respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes
feedbackSchema.index({ user: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
