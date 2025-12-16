import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Smartphone, Wallet } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { Event } from '@/lib/mockData';
import { SuccessModal } from '@/components/SuccessModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventsApi, bookingsApi, ServerEvent, getToken } from '@/lib/api';

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

export default function PaymentScreen() {
  const { eventId, selectedDate, price } = useLocalSearchParams();
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);

  const insets = useSafeAreaInsets();

  const bookingDate = selectedDate ? new Date(selectedDate as string) : new Date();
  const bookingPrice = parseInt(price as string) || 0;

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const result = await eventsApi.getById(eventId as string);
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

    loadEvent();
  }, [eventId]);

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

  const handlePayment = async () => {
    if (paymentMethod === 'upi' && !upiId) {
      return;
    }

    setIsProcessing(true);

    try {
      // Check if user is authenticated
      const token = await getToken();
      console.log('Payment - Token check:', token ? 'Token exists' : 'No token');

      if (!token) {
        setIsProcessing(false);
        Alert.alert('Login Required', 'Please login to make a booking.', [
          { text: 'Login', onPress: () => router.push('/auth') },
          { text: 'Cancel', style: 'cancel' }
        ]);
        return;
      }

      // Create booking via API
      console.log('Payment - Creating booking with token');
      const result = await bookingsApi.create({
        eventId: event.id,
        eventDate: bookingDate.toISOString(),
        guests: 1,
        paymentMethod: paymentMethod,
        notes: paymentMethod === 'upi' ? `UPI ID: ${upiId}` : 'Digital Wallet Payment',
      });

      console.log('Payment - Booking result:', result.success, result.message);

      if (result.success) {
        setIsProcessing(false);
        setShowSuccess(true);
      } else {
        setIsProcessing(false);
        Alert.alert('Error', result.message || 'Failed to create booking. Please try again.');
      }
    } catch (error) {
      setIsProcessing(false);
      console.error('Error creating booking:', error);
      Alert.alert('Error', 'Failed to create booking. Please try again.');
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    router.replace('/(tabs)/bookings');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 1 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Booking Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Prebooking Summary</Text>
            <View style={styles.summaryContent}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Service</Text>
                <Text style={styles.summaryValue}>{event.title}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Category</Text>
                <Text style={styles.summaryValue}>{event.category}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Vendor</Text>
                <Text style={styles.summaryValue}>{event.vendor.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Location</Text>
                <Text style={styles.summaryValue}>{event.location}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Date</Text>
                <Text style={styles.summaryValue}>{bookingDate.toLocaleDateString('en-IN')}</Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.servicesSection}>
                <Text style={styles.servicesLabel}>Services Included</Text>
                {event.services.slice(0, 3).map((service, index) => (
                  <Text key={index} style={styles.serviceItem}>✓ {service}</Text>
                ))}
              </View>

              <View style={styles.separator} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalAmount}>₹{bookingPrice.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Payment Methods */}
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Select Payment Method</Text>

            {/* UPI */}
            <Pressable
              style={[
                styles.paymentOption,
                paymentMethod === 'upi' && styles.selectedPaymentOption
              ]}
              onPress={() => setPaymentMethod('upi')}
            >
              <View style={styles.paymentOptionHeader}>
                <View style={styles.radioButton}>
                  {paymentMethod === 'upi' && <View style={styles.radioButtonInner} />}
                </View>
                <Smartphone size={24} color={colors.primary} />
                <View style={styles.paymentOptionText}>
                  <Text style={styles.paymentOptionTitle}>UPI</Text>
                  <Text style={styles.paymentOptionSubtitle}>Pay using UPI apps</Text>
                </View>
              </View>
              {paymentMethod === 'upi' && (
                <View style={styles.paymentForm}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter UPI ID (e.g., user@paytm)"
                    value={upiId}
                    onChangeText={setUpiId}
                    autoCapitalize="none"
                  />
                </View>
              )}
            </Pressable>

            {/* Wallet */}
            <Pressable
              style={[
                styles.paymentOption,
                paymentMethod === 'wallet' && styles.selectedPaymentOption
              ]}
              onPress={() => setPaymentMethod('wallet')}
            >
              <View style={styles.paymentOptionHeader}>
                <View style={styles.radioButton}>
                  {paymentMethod === 'wallet' && <View style={styles.radioButtonInner} />}
                </View>
                <Wallet size={24} color={colors.primary} />
                <View style={styles.paymentOptionText}>
                  <Text style={styles.paymentOptionTitle}>Digital Wallet</Text>
                  <Text style={styles.paymentOptionSubtitle}>Paytm, PhonePe, Google Pay</Text>
                </View>
              </View>
            </Pressable>
          </View>

          {/* Pay Button */}
          <Pressable
            style={[
              styles.payButton,
              (isProcessing || (paymentMethod === 'upi' && !upiId)) && styles.disabledButton
            ]}
            onPress={handlePayment}
            disabled={isProcessing || (paymentMethod === 'upi' && !upiId)}
          >
            <View style={styles.buttonContent}>
              {isProcessing && (
                <ActivityIndicator
                  size="small"
                  color={colors.primaryForeground}
                  style={styles.buttonSpinner}
                />
              )}
              <Text style={styles.payButtonText}>
                {isProcessing ? 'Processing...' : `Pay ₹${bookingPrice.toLocaleString()}`}
              </Text>
            </View>
          </Pressable>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            This is a demo prebooking payment. No actual transaction will be made.
          </Text>
        </View>
      </ScrollView>

      <SuccessModal
        isVisible={showSuccess}
        onClose={handleSuccessClose}
        title="Booking Request Sent!"
        message="Your booking request has been sent to the vendor. You will be notified once they accept or decline your request."
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
    paddingVertical: 12,
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
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
  },
  summaryContent: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  servicesSection: {
    gap: 4,
  },
  servicesLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  serviceItem: {
    fontSize: 12,
    color: colors.foreground,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  paymentSection: {
    marginBottom: 20,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 16,
  },
  paymentOption: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedPaymentOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  paymentOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  paymentOptionText: {
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  paymentOptionSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  paymentForm: {
    marginTop: 12,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: colors.background,
  },
  payButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
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
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 16,
  },
});
