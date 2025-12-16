import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '@/lib/colors';
import { Booking, Event } from '@/lib/mockData';
import TopBar from '@/components/TopBar';
import { TabSwitcher } from '@/components/TabSwitcher';
import { BookingCard } from '@/components/BookingCard';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { SuccessModal } from '@/components/SuccessModal';
import { router } from 'expo-router';
import { bookingsApi, ServerBooking, getToken, getStoredUser } from '@/lib/api';

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'pending', label: 'Pending' },
  { id: 'cancelled', label: 'Cancelled' },
];

// Map server booking to local format
const mapServerBookingToLocal = (serverBooking: ServerBooking): Booking => {
  const event: Event = {
    id: serverBooking.event._id,
    title: serverBooking.event.title,
    image: serverBooking.event.images?.[0] || '',
    images: serverBooking.event.images || [],
    location: serverBooking.event.location,
    fullLocation: serverBooking.event.fullLocation || serverBooking.event.location,
    category: '',
    price: serverBooking.event.price,
    mrp: serverBooking.event.price,
    rating: 0,
    reviews: 0,
    description: '',
    date: serverBooking.event.date,
    time: serverBooking.event.time,
    services: serverBooking.event.services || [],
    vendor: {
      id: serverBooking.event.vendor?._id || '',
      name: serverBooking.event.vendor?.name || '',
      avatar: serverBooking.event.vendor?.avatar || '',
      phone: '',
      email: '',
      experience: '',
    },
  };

  // Map status to display format
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
    event: event,
    date: new Date(serverBooking.eventDate).toLocaleDateString('en-IN'),
    time: serverBooking.event.time,
    tickets: serverBooking.guests,
    price: serverBooking.totalAmount,
    status: getStatus(serverBooking.status),
    bookingDate: new Date(serverBooking.bookingDate).toLocaleDateString('en-IN'),
  };
};

const BOOKINGS_PER_PAGE = 10;

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState('all');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });
  const [refreshing, setRefreshing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadBookings = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Check if user is authenticated
      const token = await getToken();
      console.log('Bookings - Token check:', token ? 'Token exists' : 'No token');

      if (!token) {
        console.log('Bookings - No token, skipping API call');
        setBookings([]);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const result = await bookingsApi.getMyBookings({ page, limit: BOOKINGS_PER_PAGE });
      console.log('Bookings API result:', result.success, result.message);

      if (result.success) {
        const bookingsData = (result as any).data || [];
        const pagination = (result as any).pagination;
        const mappedBookings = bookingsData.map(mapServerBookingToLocal);

        if (append) {
          setBookings(prev => [...prev, ...mappedBookings]);
        } else {
          setBookings(mappedBookings);
        }

        if (pagination) {
          setCurrentPage(pagination.page);
          setTotalPages(pagination.pages);
          setHasMore(pagination.page < pagination.pages);
        } else {
          setHasMore(false);
        }
      } else {
        console.log('Bookings API error:', result.message);
        if (!append) setBookings([]);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      if (!append) setBookings([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadBookings(currentPage + 1, true);
    }
  }, [loadingMore, hasMore, currentPage, loadBookings]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      (async () => {
        try {
          setLoading(true);

          const token = await getToken();
          console.log('Bookings Focus - Token check:', token ? 'Token exists' : 'No token');

          if (!token) {
            console.log('Bookings Focus - No token, skipping API call');
            if (isActive) {
              setBookings([]);
              setLoading(false);
            }
            return;
          }

          const result = await bookingsApi.getMyBookings({ page: 1, limit: BOOKINGS_PER_PAGE });

          if (!isActive) return;

          if (result.success) {
            const bookingsData = (result as any).data || [];
            const pagination = (result as any).pagination;
            const mappedBookings = bookingsData.map(mapServerBookingToLocal);
            setBookings(mappedBookings);

            if (pagination) {
              setCurrentPage(pagination.page);
              setTotalPages(pagination.pages);
              setHasMore(pagination.page < pagination.pages);
            }
          } else {
            console.log('Bookings Focus API error:', result.message);
            setBookings([]);
          }
        } catch (err) {
          if (!isActive) return;
          console.error('Bookings Focus error:', err);
          setBookings([]);
        } finally {
          if (!isActive) return;
          setLoading(false);
        }
      })();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await loadBookings(1, false);
    setRefreshing(false);
  }, [loadBookings]);

  const filteredBookings = activeTab === 'all'
    ? bookings
    : bookings.filter(booking => booking.status.toLowerCase() === activeTab.toLowerCase());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmed': return colors.success;
      case 'Pending': return colors.warning;
      case 'Cancelled': return colors.destructive;
      default: return colors.mutedForeground;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Confirmed': return '✓';
      case 'Pending': return '⏱';
      case 'Cancelled': return '✕';
      default: return '';
    }
  };

  const handleBookingPress = (bookingId: string) => {
    router.push(`/booking-details/${bookingId}`);
  };

  const handleChatPress = (eventId: string) => {
    router.push(`/chat/${eventId}`);
  };

  const handleCancelPress = (booking: Booking) => {
    setBookingToCancel(booking);
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (bookingToCancel && !cancelLoading) {
      setCancelLoading(true);
      setShowCancelModal(false);
      try {
        const result = await bookingsApi.cancel(bookingToCancel.id, 'Cancelled by user');

        if (result.success) {
          // Reload bookings to reflect the change
          await loadBookings();
          setSuccessMessage({ title: 'Success', message: 'Booking cancelled successfully' });
          setShowSuccessModal(true);
        } else {
          setSuccessMessage({ title: 'Error', message: result.message || 'Failed to cancel booking' });
          setShowSuccessModal(true);
        }
      } catch (error) {
        console.error('Error cancelling booking:', error);
        setSuccessMessage({ title: 'Error', message: 'Failed to cancel booking' });
        setShowSuccessModal(true);
      } finally {
        setCancelLoading(false);
        setBookingToCancel(null);
      }
    }
  };

  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    setBookingToCancel(null);
  };

  const renderEmptyState = () => (
    <EmptyState
      title={activeTab === 'all' ? 'No bookings yet' : `No ${activeTab} bookings`}
      actionLabel={activeTab === 'all' ? 'Browse Events' : undefined}
      onAction={activeTab === 'all' ? () => router.push('/(tabs)') : undefined}
    />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <TopBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.content}>

          {/* Tabs */}
          <TabSwitcher
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Bookings List */}
          {filteredBookings.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.bookingsList}>
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onPress={() => handleBookingPress(booking.id)}
                  onChat={booking.status === 'Confirmed' ? () => handleChatPress(booking.eventId) : undefined}
                  onCancel={(booking.status === 'Pending' || booking.status === 'Confirmed') && !cancelLoading ? () => handleCancelPress(booking) : undefined}
                />
              ))}

              {/* Load More Button */}
              {hasMore && activeTab === 'all' && (
                <Pressable
                  style={styles.loadMoreButton}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.loadMoreText}>Load More</Text>
                  )}
                </Pressable>
              )}

              {/* Page Info */}
              {totalPages > 1 && activeTab === 'all' && (
                <Text style={styles.pageInfo}>
                  Page {currentPage} of {totalPages}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Confirmation Modal for Cancellation */}
      <ConfirmationModal
        isVisible={showCancelModal}
        onClose={handleCloseCancelModal}
        onConfirm={handleConfirmCancel}
        title="Cancel Booking?"
        message={`Are you sure you want to cancel your booking for "${bookingToCancel?.event.title}"? This action cannot be undone.`}
        confirmText="Yes, Cancel Booking"
        cancelText="No, Keep Booking"
      />

      {/* Success/Error Modal */}
      <SuccessModal
        isVisible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successMessage.title}
        message={successMessage.message}
        autoClose={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    paddingBottom: 90,
  },
  bookingsList: {
    gap: 3,
    marginTop: -15,
  },
  loadMoreButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
    minHeight: 44,
  },
  loadMoreText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  pageInfo: {
    textAlign: 'center',
    color: colors.mutedForeground,
    fontSize: 12,
    marginBottom: 16,
  },
});
