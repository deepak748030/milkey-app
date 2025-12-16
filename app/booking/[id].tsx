import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Calendar, MapPin, Clock } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { addBooking, Booking, Event } from '@/lib/mockData';
import { Calendar as CalendarComponent } from '@/components/Calendar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventsApi, bookingsApi, ServerEvent } from '@/lib/api';

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

export default function BookingFlowScreen() {
  const { id } = useLocalSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const loadEventAndBookedDates = async () => {
      try {
        // Load event and booked dates in parallel
        const [eventResult, bookedResult] = await Promise.all([
          eventsApi.getById(id as string),
          bookingsApi.getBookedDates(id as string)
        ]);

        const eventData = (eventResult as any).data || (eventResult as any).response;
        if (eventResult.success && eventData && eventData._id) {
          setEvent(mapServerEventToEvent(eventData));
        }

        if (bookedResult.success && (bookedResult as any).data) {
          setBookedDates((bookedResult as any).data);
        }
      } catch (error) {
        console.error('Error loading event:', error);
      } finally {
        setEventLoading(false);
      }
    };

    loadEventAndBookedDates();
  }, [id]);

  if (eventLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>Event not found</Text>
        <Pressable style={styles.goBackButton} onPress={() => router.back()}>
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleProceedToPayment = async () => {
    if (!selectedDate) {
      Alert.alert('Error', 'Please select a date for prebooking');
      return;
    }

    setIsLoading(true);

    // Simulate processing
    setTimeout(() => {
      setIsLoading(false);
      router.push({
        pathname: '/payment',
        params: {
          eventId: event.id,
          selectedDate: selectedDate.toISOString(),
          price: event.price.toString()
        }
      });
    }, 500);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 1 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Book Event</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Event Summary */}
          <View style={styles.eventCard}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <View style={styles.eventInfo}>
              <View style={styles.infoRow}>
                <MapPin size={16} color={colors.mutedForeground} />
                <Text style={styles.infoText}>{event.fullLocation}</Text>
              </View>
              <View style={styles.infoRow}>
                <Clock size={16} color={colors.mutedForeground} />
                <Text style={styles.infoText}>{event.time}</Text>
              </View>
            </View>
          </View>

          {/* Date Selection */}
          <View style={styles.dateSection}>
            <Text style={styles.sectionTitle}>Select Date for Prebooking</Text>
            <View style={styles.calendarContainer}>
              {selectedDate ? (
                <Text style={styles.selectedDateText}>
                  Selected: {selectedDate.toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              ) : (
                <Text style={styles.placeholderText}>Please select a date below</Text>
              )}
              {bookedDates.length > 0 && (
                <Text style={styles.bookedInfoText}>
                  Red dates are already booked
                </Text>
              )}
              <CalendarComponent
                onDateSelect={handleDateSelect}
                selectedDate={selectedDate}
                bookedDates={bookedDates}
              />
            </View>
          </View>

          {/* Services */}
          <View style={styles.servicesCard}>
            <Text style={styles.servicesTitle}>Service Details</Text>
            <Text style={styles.servicesDescription}>
              This prebooking includes all the services mentioned below
            </Text>
            <View style={styles.servicesList}>
              {event.services.map((service, index) => (
                <View key={index} style={styles.serviceItem}>
                  <Text style={styles.checkmark}>✓</Text>
                  <Text style={styles.serviceText}>{service}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
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
          style={[
            styles.proceedButton,
            (!selectedDate || isLoading) && styles.disabledButton
          ]}
          onPress={handleProceedToPayment}
          disabled={!selectedDate || isLoading}
        >
          <View style={styles.buttonContent}>
            {isLoading && (
              <ActivityIndicator
                size="small"
                color={colors.primaryForeground}
                style={styles.buttonSpinner}
              />
            )}
            <Text style={styles.proceedButtonText}>
              {isLoading ? 'Processing...' : 'Proceed to Payment'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.mutedForeground,
    marginBottom: 16,
  },
  goBackButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  header: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingVertical: 0,
    paddingHorizontal: 10,
    paddingBottom: 120,
  },
  eventCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 8,
  },
  eventInfo: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  dateSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
  },
  calendarContainer: {
    backgroundColor: colors.muted,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedDateText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 12,
  },
  bookedInfoText: {
    fontSize: 12,
    color: colors.destructive,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  servicesCard: {
    backgroundColor: colors.muted,
    borderRadius: 8,
    padding: 16,
  },
  servicesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
  },
  servicesDescription: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 12,
  },
  servicesList: {
    gap: 4,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkmark: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  serviceText: {
    fontSize: 14,
    color: colors.foreground,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
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
    fontSize: 20,
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
  proceedButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSpinner: {
    marginRight: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  proceedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});
