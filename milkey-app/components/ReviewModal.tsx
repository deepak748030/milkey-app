import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { X, Star } from 'lucide-react-native';
import { colors } from '@/lib/colors';

interface ReviewModalProps {
    isVisible: boolean;
    onClose: () => void;
    onSubmit: (rating: number, review: string) => Promise<void>;
    eventTitle: string;
}

export function ReviewModal({ isVisible, onClose, onSubmit, eventTitle }: ReviewModalProps) {
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setError('');

        if (rating === 0) {
            setError('Please select a rating');
            return;
        }

        if (!review.trim()) {
            setError('Please write a review');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(rating, review.trim());
            // Reset form on success
            setRating(0);
            setReview('');
        } catch (err) {
            setError('Failed to submit review. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setRating(0);
            setReview('');
            setError('');
            onClose();
        }
    };

    const getRatingLabel = (stars: number) => {
        switch (stars) {
            case 1: return 'Poor';
            case 2: return 'Fair';
            case 3: return 'Good';
            case 4: return 'Very Good';
            case 5: return 'Excellent';
            default: return 'Tap to rate';
        }
    };

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <Pressable style={styles.backdrop} onPress={handleClose} />

                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <Text style={styles.title}>Write a Review</Text>
                            <Text style={styles.subtitle} numberOfLines={1}>{eventTitle}</Text>
                        </View>
                        <Pressable
                            style={styles.closeButton}
                            onPress={handleClose}
                            disabled={isSubmitting}
                        >
                            <X size={22} color={colors.mutedForeground} />
                        </Pressable>
                    </View>

                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Star Rating Section */}
                        <View style={styles.ratingSection}>
                            <Text style={styles.sectionLabel}>Your Rating</Text>
                            <View style={styles.starsRow}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Pressable
                                        key={star}
                                        style={styles.starButton}
                                        onPress={() => setRating(star)}
                                        disabled={isSubmitting}
                                    >
                                        <Star
                                            size={36}
                                            color={star <= rating ? colors.warning : colors.border}
                                            fill={star <= rating ? colors.warning : 'transparent'}
                                        />
                                    </Pressable>
                                ))}
                            </View>
                            <Text style={[
                                styles.ratingLabel,
                                rating > 0 && styles.ratingLabelActive
                            ]}>
                                {getRatingLabel(rating)}
                            </Text>
                        </View>

                        {/* Review Text Section */}
                        <View style={styles.reviewSection}>
                            <Text style={styles.sectionLabel}>Your Review</Text>
                            <TextInput
                                style={styles.reviewInput}
                                placeholder="Share your experience with this event..."
                                placeholderTextColor={colors.mutedForeground}
                                value={review}
                                onChangeText={setReview}
                                multiline
                                numberOfLines={5}
                                textAlignVertical="top"
                                editable={!isSubmitting}
                                maxLength={500}
                            />
                            <Text style={styles.charCount}>{review.length}/500</Text>
                        </View>

                        {/* Error Message */}
                        {error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}
                    </ScrollView>

                    {/* Submit Button */}
                    <View style={styles.footer}>
                        <Pressable
                            style={[
                                styles.submitButton,
                                (rating === 0 || !review.trim() || isSubmitting) && styles.submitButtonDisabled
                            ]}
                            onPress={handleSubmit}
                            disabled={rating === 0 || !review.trim() || isSubmitting}
                        >
                            {isSubmitting && (
                                <ActivityIndicator
                                    size="small"
                                    color={colors.primaryForeground}
                                    style={styles.spinner}
                                />
                            )}
                            <Text style={styles.submitButtonText}>
                                {isSubmitting ? 'Submitting...' : 'Submit Review'}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerContent: {
        flex: 1,
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.foreground,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: colors.mutedForeground,
    },
    closeButton: {
        padding: 8,
        backgroundColor: colors.muted,
        borderRadius: 20,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    ratingSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 12,
        alignSelf: 'flex-start',
    },
    starsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    starButton: {
        padding: 4,
    },
    ratingLabel: {
        fontSize: 14,
        color: colors.mutedForeground,
        marginTop: 4,
    },
    ratingLabelActive: {
        color: colors.warning,
        fontWeight: '600',
    },
    reviewSection: {
        marginBottom: 16,
    },
    reviewInput: {
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        backgroundColor: colors.background,
        minHeight: 120,
        color: colors.foreground,
    },
    charCount: {
        fontSize: 12,
        color: colors.mutedForeground,
        textAlign: 'right',
        marginTop: 6,
    },
    errorContainer: {
        backgroundColor: colors.destructive + '15',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorText: {
        color: colors.destructive,
        fontSize: 14,
        textAlign: 'center',
    },
    footer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    submitButton: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    spinner: {
        marginRight: 8,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.primaryForeground,
    },
});