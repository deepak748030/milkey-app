// app/event/[id].tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Dimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Calendar, Clock, Star, MessageCircle, Edit3 } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { getFavorites, toggleFavorite, Event } from '@/lib/mockData';
import { ImageCarousel } from '@/components/ImageCarousel';
import { ReviewModal } from '@/components/ReviewModal';
import { eventsApi, reviewsApi, ServerEvent, ServerReview, ReviewStats } from '@/lib/api';

const { width: screenWidth } = Dimensions.get('window');

// Helper to map ServerEvent to Event format
const mapServerEventToEvent = (serverEvent: ServerEvent): Event => ({
  id: serverEvent._id,
  title: serverEvent.title,
  image: serverEvent.image,
  images: serverEvent.images,
  location: serverEvent.location,
  fullLocation: serverEvent.fullLocation,
  category: serverEvent.category,
  price: serverEvent.price,
  mrp: serverEvent.mrp,
  rating: serverEvent.rating,
  reviews: serverEvent.reviews,
  badge: serverEvent.badge,
  description: serverEvent.description,
  date: serverEvent.date,
  time: serverEvent.time,
  services: serverEvent.services,
  vendor: {
    id: serverEvent.vendor._id,
    name: serverEvent.vendor.name,
    avatar: serverEvent.vendor.avatar,
    phone: serverEvent.vendor.phone || '',
    email: serverEvent.vendor.email || '',
    experience: serverEvent.vendor.experience || `${serverEvent.vendor.experienceYears || 0}+ years experience`,
  },
});

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('details');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [reviews, setReviews] = useState<ServerReview[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ avgRating: 0, totalReviews: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [canReview, setCanReview] = useState(true);
  const [existingReview, setExistingReview] = useState<{ _id: string; rating: number; comment: string } | null>(null);
  const [canReviewLoading, setCanReviewLoading] = useState(false);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const result = await eventsApi.getById(id as string);
        const eventData = (result as any).data || (result as any).response;

        if (result.success && eventData && eventData._id) {
          setEvent(mapServerEventToEvent(eventData));
        }
      } catch (error) {
        console.error('Error loading event:', error);
      } finally {
        setEventLoading(false);
      }
    };

    const loadFavorites = async () => {
      try {
        const favs = await getFavorites();
        setFavorites(favs);
      } catch (error) {
        setFavorites([]);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
    loadFavorites();
  }, [id]);

  // Load reviews only when reviews tab is clicked
  const loadReviews = async () => {
    if (reviewsLoaded) return; // Don't reload if already loaded

    setReviewsLoading(true);
    try {
      const result = await reviewsApi.getEventReviews(id as string, { limit: 20 });
      const reviewData = (result as any).data || [];
      const stats = (result as any).stats || { avgRating: 0, totalReviews: 0 };

      if (result.success) {
        setReviews(reviewData);
        setReviewStats(stats);
        setReviewsLoaded(true);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  };

  // Check if user can review when reviews tab is clicked
  const checkCanReview = async () => {
    setCanReviewLoading(true);
    try {
      const result = await reviewsApi.canReview(id as string);
      console.log('canReview API result:', result);
      if (result.success) {
        // Response structure: { success: true, canReview: boolean, existingReview?: {...} }
        const canReviewValue = (result as any).canReview;
        const existingReviewData = (result as any).existingReview;

        setCanReview(canReviewValue !== false);
        if (existingReviewData) {
          setExistingReview(existingReviewData);
        }
      } else {
        // If API fails (e.g., not logged in), still allow attempting to write review
        // The create API will handle auth properly
        setCanReview(true);
      }
    } catch (error) {
      console.error('Error checking can review:', error);
      // On error, default to allowing review attempts
      setCanReview(true);
    } finally {
      setCanReviewLoading(false);
    }
  };

  // Handle tab change - load reviews only when reviews tab is clicked
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'reviews') {
      loadReviews();
      checkCanReview();
    }
  };

  const formatReviewDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (eventLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Event not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleToggleFavorite = async () => {
    try {
      await toggleFavorite(event.id);
      const updatedFavorites = await getFavorites();
      setFavorites(updatedFavorites);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleBookNow = () => {
    setIsBooking(true);
    setTimeout(() => {
      router.push(`/booking/${event.id}`);
      setIsBooking(false);
    }, 500);
  };

  const handleChatVendor = () => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: event.vendor.id,
        vendorName: event.vendor.name,
        vendorAvatar: event.vendor.avatar
      }
    });
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    try {
      console.log('Submitting review from event details:', { eventId: id, rating, comment });

      const result = await reviewsApi.create({
        eventId: id as string,
        rating,
        comment,
      });

      console.log('Review API response:', result);

      if (result.success) {
        // Close modal
        setShowReviewModal(false);
        // Mark as already reviewed
        setCanReview(false);
        setExistingReview({ _id: '', rating, comment });
        // Reload reviews to show the new one
        setReviewsLoaded(false);
        await loadReviews();
        // Reload event to get updated rating
        const eventResult = await eventsApi.getById(id as string);
        const eventData = (eventResult as any).data || (eventResult as any).response;
        if (eventResult.success && eventData && eventData._id) {
          setEvent(mapServerEventToEvent(eventData));
        }
      } else {
        const errorMsg = (result as any).message || 'Failed to submit review';
        console.error('Review submission failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      throw error;
    }
  };

  const averageRating = reviewStats.totalReviews > 0 ? reviewStats.avgRating : event.rating;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Scrollable Content */}
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        <ImageCarousel
          images={event.images}
          badge={event.badge}
          showBackButton={true}
          showFavoriteButton={true}
          isFavorite={favorites.includes(event.id)}
          onBackPress={() => router.back()}
          onFavoritePress={handleToggleFavorite}
          height={220}
        />
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{event.title}</Text>
            {event.mrp && event.mrp > event.price && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>
                  {Math.round(((event.mrp - event.price) / event.mrp) * 100)}% OFF
                </Text>
              </View>
            )}
          </View>

          {/* Info Rows */}
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <MapPin size={20} color={colors.primary} />
              <View>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{event.fullLocation}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Calendar size={20} color={colors.primary} />
              <View>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{event.date}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Clock size={20} color={colors.primary} />
              <View>
                <Text style={styles.infoLabel}>Time</Text>
                <Text style={styles.infoValue}>{event.time}</Text>
              </View>
            </View>
          </View>

          {/* Vendor Card */}
          <View style={styles.vendorCard}>
            <View style={styles.vendorHeader}>
              <Star size={18} color={colors.warning} fill={colors.warning} />
              <Text style={styles.vendorTitle}>Vendor Information</Text>
            </View>
            <View style={styles.vendorContent}>
              <View style={styles.vendorInfo}>
                <Image source={{ uri: event.vendor.avatar }} style={styles.vendorAvatar} />
                <View style={styles.vendorDetails}>
                  <Text style={styles.vendorName}>{event.vendor.name}</Text>
                  <Text style={styles.vendorExperience}>{event.vendor.experience}</Text>
                </View>
              </View>
              <Pressable style={styles.chatButton} onPress={handleChatVendor}>
                <MessageCircle size={20} color={colors.primary} />
              </Pressable>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <View style={styles.tabsList}>
              <Pressable
                style={[styles.tab, activeTab === 'details' && styles.activeTab]}
                onPress={() => handleTabChange('details')}
              >
                <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
                  Details
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'reviews' && styles.activeTab]}
                onPress={() => handleTabChange('reviews')}
              >
                <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>
                  Reviews
                </Text>
              </Pressable>
            </View>

            {/* Tab Content */}
            <View style={styles.tabContent}>
              {activeTab === 'details' ? (
                <View style={styles.detailsContent}>
                  <View style={styles.aboutSection}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <Text style={styles.description}>{event.description}</Text>
                  </View>
                  <View style={styles.servicesSection}>
                    <Text style={styles.sectionTitle}>Services Included</Text>
                    {event.services.map((service, index) => (
                      <Text key={index} style={styles.serviceItem}>✓ {service}</Text>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.reviewsContent}>
                  <View style={styles.reviewsHeader}>
                    <View style={styles.ratingSummary}>
                      <Star size={24} color={colors.warning} fill={colors.warning} />
                      <Text style={styles.ratingNumber}>{averageRating.toFixed(1)}</Text>
                      <Text style={styles.reviewsCount}>({reviewStats.totalReviews} reviews)</Text>
                    </View>

                    {/* Write Review Button */}
                    {canReviewLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : canReview ? (
                      <Pressable
                        style={styles.writeReviewButton}
                        onPress={() => setShowReviewModal(true)}
                      >
                        <Edit3 size={16} color={colors.primaryForeground} />
                        <Text style={styles.writeReviewButtonText}>Write Review</Text>
                      </Pressable>
                    ) : existingReview ? (
                      <View style={styles.alreadyReviewedBadge}>
                        <Text style={styles.alreadyReviewedText}>Already Reviewed</Text>
                      </View>
                    ) : null}
                  </View>

                  {reviewsLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
                  ) : reviews.length === 0 ? (
                    <Text style={styles.noReviewsText}>No reviews yet. Be the first to review!</Text>
                  ) : (
                    reviews.map((review) => (
                      <View key={review._id} style={styles.reviewItem}>
                        <View style={styles.reviewHeader}>
                          <Image
                            source={{ uri: review.user?.avatar || 'https://ui-avatars.com/api/?name=User' }}
                            style={styles.reviewerAvatar}
                          />
                          <View style={styles.reviewerInfo}>
                            <Text style={styles.reviewerName}>{review.user?.name || 'Anonymous'}</Text>
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
                            <Text style={styles.reviewDate}>{formatReviewDate(review.createdAt)}</Text>
                          </View>
                        </View>
                        <Text style={styles.reviewComment}>{review.comment}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.priceSection}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{event.price.toLocaleString()}</Text>
            {event.mrp > event.price && (
              <Text style={styles.mrpPrice}>₹{event.mrp.toLocaleString()}</Text>
            )}
          </View>
          {event.mrp > event.price && (
            <Text style={styles.discountText}>
              {Math.round(((event.mrp - event.price) / event.mrp) * 100)}% off
            </Text>
          )}
        </View>
        <Pressable
          style={[styles.bookButton, isBooking && styles.bookButtonDisabled]}
          onPress={handleBookNow}
          disabled={isBooking}
        >
          <View style={styles.bookButtonContent}>
            {isBooking && (
              <ActivityIndicator
                size="small"
                color={colors.primaryForeground}
                style={styles.bookButtonSpinner}
              />
            )}
            <Text style={styles.bookButtonText}>
              {isBooking ? 'Loading...' : 'Prebook Now'}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Review Modal */}
      <ReviewModal
        isVisible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSubmit={handleSubmitReview}
        eventTitle={event.title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    flex: 1,
  },
  content: {
    padding: 12,
    paddingBottom: 110,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
    flex: 1,
  },
  discountBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.white,
  },
  infoContainer: {
    gap: 6, // Changed from 12
    marginBottom: 12, // Changed from 20
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10, // Changed from 12
  },
  infoLabel: {
    fontSize: 13, // Changed from 14
    fontWeight: '600',
    color: colors.foreground,
  },
  infoValue: {
    fontSize: 13, // Changed from 14
    color: colors.mutedForeground,
  },
  vendorCard: {
    backgroundColor: colors.card,
    borderRadius: 12, // Changed from 8
    padding: 12, // Changed from 16
    marginBottom: 12, // Changed from 20
    borderWidth: 1,
    borderColor: colors.border,
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8, // Changed from 12
  },
  vendorTitle: {
    fontSize: 15, // Changed from 16
    fontWeight: '600',
    color: colors.foreground,
  },
  vendorContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10, // Changed from 12
    flex: 1,
  },
  vendorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  vendorDetails: {
    flex: 1,
  },
  vendorName: {
    fontSize: 15, // Changed from 14
    fontWeight: 'bold', // Changed from '600'
    color: colors.foreground,
    marginBottom: 4,
  },
  vendorExperience: {
    fontSize: 11, // Changed from 12
    color: colors.mutedForeground,
  },
  chatButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    borderRadius: 8,
  },
  tabsContainer: {
    marginBottom: 12, // Changed from 20
  },
  tabsList: {
    backgroundColor: colors.secondary,
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: colors.card,
  },
  tabText: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  activeTabText: {
    color: colors.foreground,
    fontWeight: '600',
  },
  tabContent: {
    marginTop: 16,
  },
  detailsContent: {
    gap: 16,
  },
  aboutSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  description: {
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  servicesSection: {
    gap: 6, // Changed from 8
  },
  serviceItem: {
    fontSize: 13, // Changed from 14
    color: colors.mutedForeground,
  },
  reviewsContent: {
    gap: 12, // Changed from 16
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  writeReviewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  alreadyReviewedBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  alreadyReviewedText: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  ratingNumber: {
    fontSize: 20, // Changed from 24
    fontWeight: 'bold',
    color: colors.foreground,
  },
  reviewsCount: {
    fontSize: 14, // Changed from 16
    fontWeight: '600',
    color: colors.foreground,
  },
  reviewItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12, // Changed from 16
    marginBottom: 12, // Changed from 16
  },
  reviewHeader: {
    flexDirection: 'row',
    gap: 10, // Changed from 12
    marginBottom: 6, // Changed from 8
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
    fontSize: 13, // Changed from 14
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4, // Changed from 8
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
    marginVertical: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  reviewComment: {
    fontSize: 13, // Changed from 14
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
    padding: 12, // Changed from 16
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  priceSection: {
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  mrpPrice: {
    fontSize: 14,
    color: colors.mutedForeground,
    textDecorationLine: 'line-through',
  },
  discountText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '600',
    marginTop: 2,
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  bookButtonDisabled: {
    opacity: 0.7,
  },
  bookButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonSpinner: {
    marginRight: 8,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 100,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 20,
  },
  backButtonText: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  noReviewsText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
});
