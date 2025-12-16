import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TextInput,
    ActivityIndicator,
    Image,
} from 'react-native';
import { colors } from '@/lib/colors';
import { Ionicons } from '@expo/vector-icons';

interface AppRatingModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (rating: number, feedback: string) => Promise<void>;
    onSkip: () => void;
}


export default function AppRatingModal({
    visible,
    onClose,
    onSubmit,
    onSkip,
}: AppRatingModalProps) {
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'rating' | 'feedback' | 'thanks'>('rating');

    const handleStarPress = (star: number) => {
        setRating(star);
    };

    const handleNext = () => {
        if (rating === 0) return;
        setStep('feedback');
    };

    const handleSubmit = async () => {
        if (rating === 0) return;
        setLoading(true);
        try {
            await onSubmit(rating, feedback);
            setStep('thanks');
            setTimeout(() => {
                onClose();
                // Reset state
                setRating(0);
                setFeedback('');
                setStep('rating');
            }, 2000);
        } catch (error) {
            console.error('Error submitting rating:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = () => {
        onSkip();
        setRating(0);
        setFeedback('');
        setStep('rating');
    };

    const handleBack = () => {
        setStep('rating');
    };

    const getRatingText = () => {
        switch (rating) {
            case 1:
                return 'Very Bad 😞';
            case 2:
                return 'Bad 😕';
            case 3:
                return 'Okay 😐';
            case 4:
                return 'Good 😊';
            case 5:
                return 'Excellent! 🤩';
            default:
                return 'Tap a star to rate';
        }
    };

    const renderRatingStep = () => (
        <>
            <View style={styles.iconContainer}>
                <View style={styles.appIconWrapper}>
                    <Image
                        source={require('@/assets/images/icon.png')}
                        style={styles.appIcon}
                        resizeMode="contain"
                    />
                </View>
            </View>

            <Text style={styles.title}>Enjoying Planify?</Text>
            <Text style={styles.subtitle}>
                Your feedback helps us improve the app for everyone
            </Text>

            <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                        key={star}
                        onPress={() => handleStarPress(star)}
                        style={styles.starButton}
                    >
                        <Ionicons
                            name={star <= rating ? 'star' : 'star-outline'}
                            size={40}
                            color={star <= rating ? '#FFD700' : colors.mutedForeground}
                        />
                    </Pressable>
                ))}
            </View>

            <Text style={styles.ratingText}>{getRatingText()}</Text>

            <View style={styles.buttonsContainer}>
                <Pressable style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipButtonText}>Maybe Later</Text>
                </Pressable>
                <Pressable
                    style={[styles.nextButton, rating === 0 && styles.disabledButton]}
                    onPress={handleNext}
                    disabled={rating === 0}
                >
                    <Text style={styles.nextButtonText}>Next</Text>
                </Pressable>
            </View>
        </>
    );

    const renderFeedbackStep = () => (
        <>
            <Pressable style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={24} color={colors.foreground} />
            </Pressable>

            <View style={styles.ratingBadge}>
                <Text style={styles.ratingBadgeText}>{rating}</Text>
                <Ionicons name="star" size={16} color="#FFD700" />
            </View>

            <Text style={styles.title}>Tell us more</Text>
            <Text style={styles.subtitle}>
                What can we do to make your experience better?
            </Text>

            <TextInput
                style={styles.feedbackInput}
                placeholder="Share your thoughts... (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={feedback}
                onChangeText={setFeedback}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
            />

            <Text style={styles.charCount}>{feedback.length}/500</Text>

            <View style={styles.buttonsContainer}>
                <Pressable style={styles.skipButton} onPress={handleSubmit}>
                    <Text style={styles.skipButtonText}>Skip</Text>
                </Pressable>
                <Pressable
                    style={[styles.submitButton, loading && styles.disabledButton]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit</Text>
                    )}
                </Pressable>
            </View>
        </>
    );

    const renderThanksStep = () => (
        <View style={styles.thanksContainer}>
            <View style={styles.checkIconContainer}>
                <Ionicons name="checkmark-circle" size={80} color={colors.success} />
            </View>
            <Text style={styles.thanksTitle}>Thank You!</Text>
            <Text style={styles.thanksSubtitle}>
                Your feedback means a lot to us
            </Text>
        </View>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {step === 'rating' && renderRatingStep()}
                    {step === 'feedback' && renderFeedbackStep()}
                    {step === 'thanks' && renderThanksStep()}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 16,
    },
    appIconWrapper: {
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',

    },
    appIcon: {
        width: 150,
        height: 150,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.foreground,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
    },
    starButton: {
        padding: 4,
    },
    ratingText: {
        fontSize: 16,
        color: colors.foreground,
        fontWeight: '600',
        marginBottom: 24,
    },
    buttonsContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    skipButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.muted,
        alignItems: 'center',
    },
    skipButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.mutedForeground,
    },
    nextButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    nextButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.white,
    },
    submitButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.white,
    },
    disabledButton: {
        opacity: 0.5,
    },
    backButton: {
        position: 'absolute',
        top: 16,
        left: 16,
        padding: 4,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.muted,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
    },
    ratingBadgeText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.foreground,
    },
    feedbackInput: {
        width: '100%',
        height: 120,
        backgroundColor: colors.muted,
        borderRadius: 12,
        padding: 16,
        fontSize: 14,
        color: colors.foreground,
        marginBottom: 8,
    },
    charCount: {
        alignSelf: 'flex-end',
        fontSize: 12,
        color: colors.mutedForeground,
        marginBottom: 20,
    },
    thanksContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    checkIconContainer: {
        marginBottom: 16,
    },
    thanksTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.foreground,
        marginBottom: 8,
    },
    thanksSubtitle: {
        fontSize: 14,
        color: colors.mutedForeground,
        textAlign: 'center',
    },
});
