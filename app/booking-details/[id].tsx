import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Dimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Calendar, Star, MessageCircle, Edit3, CheckCircle } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { Booking, Review } from '@/lib/mockData';
import { bookingsApi, reviewsApi, ServerBooking } from '@/lib/api';
import { SuccessModal } from '@/components/SuccessModal';
import { ReviewModal } from '@/components/ReviewModal';
import { ImageCarousel } from '@/components/ImageCarousel';

const { width: screenWidth } = Dimensions.get('window');

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Review state
  const [canReview, setCanReview] = useState(true);
  const [canReviewLoading, setCanReviewLoading] = useState(false);
  const [existingReview, setExistingReview] = useState<{ _id: string; rating: number; comment: string } | null>(null);

  const [loading, setLoading] = useState(true);

  // Map server booking to local format
  const mapServerBookingToLocal = (serverBooking: ServerBooking): Booking => {
    const getStatus = (status: string): "Confirmed" | "Pending" | "Cancelled" => {
      switch (status) {
        case 'confirmed':
        case 'completed':
          return 'Confirmed';
        case 'cancelled':
          return 'Cancelled';
        default:
          return 'Pending';
      }
    };

    return {
      id: serverBooking._id,
      eventId: serverBooking.event._id,
      event: {
        id: serverBooking.event._id,
        title: serverBooking.event.title,
        image: serverBooking.event.images?.[0] || '',
        images: serverBooking.event.images || [],
        location: serverBooking.event.location,
        fullLocation: serverBooking.event.fullLocation || serverBooking.event.location,
        category: '',
        price: serverBooking.event.price,
        mrp: serverBooking.event.price,
        rating: (serverBooking.event as any).rating || 0,
        reviews: (serverBooking.event as any).reviews || 0,
        description: '',
        date: serverBooking.event.date,
        time: serverBooking.event.time,
        services: serverBooking.event.services || [],
        vendor: {
          id: serverBooking.event.vendor?._id || '',
          name: serverBooking.event.vendor?.name || 'Vendor',
          avatar: serverBooking.event.vendor?.avatar || 'https://api.dicebear.com/7.x/avataaars/png?seed=vendor',
          phone: serverBooking.event.vendor?.phone || '',
          email: serverBooking.event.vendor?.email || '',
          experience: serverBooking.event.vendor?.experienceYears
            ? `${serverBooking.event.vendor.experienceYears} years experience`
            : 'Experienced Professional',
        },
      },
      date: new Date(serverBooking.eventDate).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: serverBooking.event.time,
      tickets: serverBooking.guests,
      price: serverBooking.totalAmount,
      status: getStatus(serverBooking.status),
      bookingDate: new Date(serverBooking.bookingDate).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
    };
  };

  useEffect(() => {
    const loadBookingDetails = async () => {
      try {
        setLoading(true);
        const result = await bookingsApi.getById(id as string);

        if (result.success && (result as any).data) {
          const serverBooking = (result as any).data as ServerBooking;
          const mappedBooking = mapServerBookingToLocal(serverBooking);
          setBooking(mappedBooking);
        } else {
          console.error('Failed to load booking:', result.message);
          setBooking(null);
        }
      } catch (error) {
        console.error('Error loading booking details:', error);
        setBooking(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadBookingDetails();
    }
  }, [id]);

  // Check if user can review this event
  const checkCanReview = async (eventId: string) => {
    setCanReviewLoading(true);
    try {
      const result = await reviewsApi.canReview(eventId);
      if (result.success) {
        const data = (result as any).data || result;
        setCanReview(data.canReview !== false);
        if (data.existingReview) {
          setExistingReview(data.existingReview);
        }
      }
    } catch (error) {
      console.error('Error checking can review:', error);
    } finally {
      setCanReviewLoading(false);
    }
  };

  // Load reviews for the event
  const loadReviews = async (eventId: string) => {
    try {
      const result = await reviewsApi.getEventReviews(eventId);
      if (result.success) {
        const data = (result as any).data || (result as any).response?.data || [];
        const mappedReviews: Review[] = data.map((r: any) => ({
          id: r._id,
          eventId: r.event,
          userName: r.user?.name || 'Anonymous',
          userAvatar: r.user?.avatar || 'https://api.dicebear.com/7.x/avataaars/png?seed=user',
          rating: r.rating,
          comment: r.comment,
          date: new Date(r.createdAt).toLocaleDateString('en-IN'),
        }));
        setReviews(mappedReviews);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

  // Check can review and load reviews when booking loads
  useEffect(() => {
    if (booking?.eventId) {
      checkCanReview(booking.eventId);
      loadReviews(booking.eventId);
    }
  }, [booking?.eventId]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>Booking Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>Booking Details</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Booking not found</Text>
        </View>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmed': return colors.success;
      case 'Pending': return colors.warning;
      case 'Cancelled': return colors.destructive;
      default: return colors.mutedForeground;
    }
  };

  const handleSubmitReview = async (rating: number, reviewText: string) => {
    try {
      console.log('Submitting review:', { eventId: booking!.eventId, bookingId: booking!.id, rating, comment: reviewText });

      const result = await reviewsApi.create({
        eventId: booking!.eventId,
        bookingId: booking!.id,
        rating,
        comment: reviewText,
      });

      console.log('Review API response:', result);

      if (result.success) {
        // Update local state
        const newReview: Review = {
          id: Date.now().toString(),
          eventId: booking!.eventId,
          userName: 'You',
          userAvatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=user',
          rating: rating,
          comment: reviewText,
          date: new Date().toLocaleDateString('en-IN'),
        };

        setReviews([newReview, ...reviews]);
        setShowReviewModal(false);
        setCanReview(false);
        setExistingReview({ _id: '', rating, comment: reviewText });
        setModalTitle('Success');
        setModalMessage('Your review has been submitted successfully!');
        setShowSuccessModal(true);
      } else {
        const errorMsg = (result as any).message || 'Failed to submit review';
        console.error('Review submission failed:', errorMsg);
        setModalTitle('Error');
        setModalMessage(errorMsg);
        setShowSuccessModal(true);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('Error submitting review:', error);
      throw error;
    }
  };

  const handleChatVendor = () => {
    setIsChatLoading(true);
    setTimeout(() => {
      setIsChatLoading(false);
      router.push(`/chat/${booking.eventId}`);
    }, 500);
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : booking.event.rating;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Booking Details</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        <ImageCarousel
          images={booking.event.images}
          showBackButton={false}
          showFavoriteButton={false}
          height={200}
        />

        <View style={styles.content}>
          {/* Title and Status */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{booking.event.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                {booking.status}
              </Text>
            </View>
          </View>

          {/* Booking Details Card */}
          <View style={styles.bookingCard}>
            <Text style={styles.cardTitle}>Booking Details</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Booking ID</Text>
                <Text style={styles.detailValue}>#{booking.id.slice(-8).toUpperCase()}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Total Price</Text>
                <Text style={[styles.detailValue, styles.priceText]}>₹{booking.price.toLocaleString()}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Booked On</Text>
                <Text style={styles.detailValue}>{booking.bookingDate}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Guests</Text>
                <Text style={styles.detailValue}>{booking.tickets} People</Text>
              </View>
            </View>
          </View>

          {/* Location Card */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <MapPin size={18} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{booking.event.fullLocation}</Text>
            </View>
          </View>

          {/* Date & Time Card */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <Calendar size={18} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Date & Time</Text>
              <Text style={styles.infoValue}>{booking.date}</Text>
              <Text style={styles.infoValue}>{booking.time}</Text>
            </View>
          </View>

          {/* Vendor Card */}
          <View style={styles.vendorCard}>
            <View style={styles.vendorHeader}>
              <Star size={18} color={colors.warning} fill={colors.warning} />
              <Text style={styles.cardTitle}>Vendor Information</Text>
            </View>
            <View style={styles.vendorContent}>
              <Image source={{ uri: booking.event.vendor.avatar }} style={styles.vendorAvatar} />
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>{booking.event.vendor.name}</Text>
                <Text style={styles.vendorExperience}>{booking.event.vendor.experience}</Text>
              </View>
            </View>
          </View>

          {/* Services Card */}
          <View style={styles.servicesCard}>
            <Text style={styles.cardTitle}>Services Included</Text>
            <View style={styles.servicesList}>
              {booking.event.services.map((service, index) => (
                <View key={index} style={styles.serviceItem}>
                  <View style={styles.checkIcon}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                  <Text style={styles.serviceText}>{service}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Reviews Section */}
          <View style={styles.reviewsSection}>
            <Text style={styles.sectionTitle}>Reviews</Text>

            {/* Rating Summary */}
            <View style={styles.ratingSummary}>
              <Star size={24} color={colors.warning} fill={colors.warning} />
              <Text style={styles.ratingNumber}>{averageRating.toFixed(1)}</Text>
              <Text style={styles.reviewsCount}>({reviews.length} reviews)</Text>
            </View>

            {/* Reviews List */}
            {reviews.length === 0 ? (
              <View style={styles.noReviewsContainer}>
                <Text style={styles.noReviewsText}>No reviews yet. Be the first to review!</Text>
              </View>
            ) : (
              reviews.map((review) => (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Image source={{ uri: review.userAvatar }} style={styles.reviewerAvatar} />
                    <View style={styles.reviewerInfo}>
                      <Text style={styles.reviewerName}>{review.userName}</Text>
                      <View style={styles.reviewRating}>
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            color={i < review.rating ? colors.warning : colors.muted}
                            fill={i < review.rating ? colors.warning : 'transparent'}
                          />
                        ))}
                      </View>
                      <Text style={styles.reviewDate}>{review.date}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Bar with Two Buttons */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {canReviewLoading ? (
          <View style={styles.reviewButton}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : canReview ? (
          <Pressable
            style={styles.reviewButton}
            onPress={() => setShowReviewModal(true)}
          >
            <Edit3 size={18} color={colors.primary} />
            <Text style={styles.reviewButtonText}>Write Review</Text>
          </Pressable>
        ) : (
          <View style={styles.reviewedButton}>
            <CheckCircle size={18} color={colors.success} />
            <Text style={styles.reviewedButtonText}>Reviewed</Text>
          </View>
        )}

        <Pressable
          style={[styles.chatButton, isChatLoading && styles.buttonDisabled]}
          onPress={handleChatVendor}
          disabled={isChatLoading}
        >
          {isChatLoading ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} style={styles.buttonSpinner} />
          ) : (
            <MessageCircle size={18} color={colors.primaryForeground} />
          )}
          <Text style={styles.chatButtonText}>
            {isChatLoading ? 'Opening...' : 'Chat'}
          </Text>
        </Pressable>
      </View>

      {/* Review Modal */}
      <ReviewModal
        isVisible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSubmit={handleSubmitReview}
        eventTitle={booking.event.title}
      />

      {/* Success Modal */}
      <SuccessModal
        isVisible={showSuccessModal}
        onClose={handleSuccessModalClose}
        title={modalTitle}
        message={modalMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  bookingCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 8,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailItem: {
    width: '45%',
  },
  detailLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  priceText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.primary,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 36,
    height: 36,
    backgroundColor: colors.primary + '20',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  vendorCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  vendorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vendorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.primary + '20',
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 4,
  },
  vendorExperience: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  servicesCard: {
    backgroundColor: colors.muted + '50',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  servicesList: {
    gap: 6,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkIcon: {
    width: 18,
    height: 18,
    backgroundColor: colors.success + '20',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: 'bold',
  },
  serviceText: {
    fontSize: 13,
    color: colors.foreground,
  },
  reviewsSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 12,
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  ratingNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  reviewsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  noReviewsContainer: {
    backgroundColor: colors.muted + '30',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  noReviewsText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  reviewItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  reviewComment: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  reviewButton: {
    flex: 1,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  reviewButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  reviewedButton: {
    flex: 1,
    backgroundColor: colors.success + '15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  reviewedButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.success,
  },
  chatButton: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonSpinner: {
    marginRight: 4,
  },
  chatButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.mutedForeground,
  },
});