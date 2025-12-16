import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Calendar, MapPin, MessageCircle, X, Clock, Users, ChevronRight } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { Booking } from '@/lib/mockData';
import { getImageUrl } from '@/lib/api';

interface BookingCardProps {
  booking: Booking;
  onPress: () => void;
  onChat?: () => void;
  onCancel?: () => void;
}

export function BookingCard({ booking, onPress, onChat, onCancel }: BookingCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return {
          color: colors.success,
          bgColor: 'rgba(34, 197, 94, 0.12)',
          label: 'Confirmed',
        };
      case 'Pending':
        return {
          color: colors.warning,
          bgColor: 'rgba(234, 179, 8, 0.12)',
          label: 'Pending',
        };
      case 'Cancelled':
        return {
          color: colors.destructive,
          bgColor: 'rgba(239, 68, 68, 0.12)',
          label: 'Cancelled',
        };
      default:
        return {
          color: colors.mutedForeground,
          bgColor: colors.muted,
          label: status,
        };
    }
  };

  const statusConfig = getStatusConfig(booking.status);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed
      ]}
      onPress={onPress}
    >
      <View style={styles.mainContent}>
        {/* Image with Status Badge */}
        <Image source={{ uri: getImageUrl(booking.event.image) }} style={styles.image} />

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>

        {/* Event Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {booking.event.title}
          </Text>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Calendar size={12} color={colors.mutedForeground} />
              <Text style={styles.infoText}>{booking.date}</Text>
            </View>
            <View style={styles.infoItem}>
              <Clock size={12} color={colors.mutedForeground} />
              <Text style={styles.infoText}>{booking.time}</Text>
            </View>
            <View style={styles.infoItem}>
              <Users size={12} color={colors.mutedForeground} />
              <Text style={styles.infoText}>{booking.tickets}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <MapPin size={12} color={colors.mutedForeground} />
            <Text style={styles.infoText} numberOfLines={1}>{booking.event.location}</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.priceSection}>
          <Text style={styles.priceValue}>₹{booking.price.toLocaleString()}</Text>
        </View>

        <View style={styles.actionsSection}>
          {booking.status === 'Confirmed' && onChat && (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.chatBtn,
                pressed && styles.actionBtnPressed
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onChat();
              }}
            >
              <MessageCircle size={14} color={colors.primary} />
            </Pressable>
          )}

          {(booking.status === 'Pending' || booking.status === 'Confirmed') && onCancel && (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.cancelBtn,
                pressed && styles.actionBtnPressed
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onCancel();
              }}
            >
              <X size={14} color={colors.destructive} />
            </Pressable>
          )}

          <View style={styles.viewDetailsBtn}>
            <Text style={styles.viewDetailsText}>Details</Text>
            <ChevronRight size={14} color={colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.9,
  },
  mainContent: {
    padding: 8,
    flexDirection: 'row',
    gap: 12,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailsContainer: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceSection: {},
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  actionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  actionBtnPressed: {
    opacity: 0.7,
  },
  chatBtn: {
    backgroundColor: `${colors.primary}15`,
  },
  cancelBtn: {
    backgroundColor: `${colors.destructive}10`,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
});
