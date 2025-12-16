import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Heart, MapPin, Star } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { Event } from '@/lib/mockData';
import { getImageUrl } from '@/lib/api';
import { router } from 'expo-router';

interface EventCardProps {
  event: Event;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export default function EventCard({ event, isFavorite = false, onToggleFavorite }: EventCardProps) {
  const handlePress = () => {
    router.push(`/event/${event.id}`);
  };

  // Get full image URL from path
  const imageUri = getImageUrl(event.image);

  return (
    <Pressable
      style={styles.card}
      onPress={handlePress}
      android_ripple={{ color: colors.muted }}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.image} />

        {event.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{event.badge}</Text>
          </View>
        )}

        <Pressable
          style={styles.favoriteButton}
          onPress={onToggleFavorite}
          android_ripple={{ color: colors.primary, borderless: true }}
        >
          <Heart
            size={16}
            color={colors.primary}
            fill={isFavorite ? colors.primary : 'transparent'}
          />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.topContent}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>

          <View style={styles.locationRow}>
            <MapPin size={12} color={colors.mutedForeground} />
            <Text style={styles.location} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.ratingContainer}>
            <Star size={12} color={colors.warning} fill={colors.warning} />
            <Text style={styles.rating}>
              {event.rating} ({event.reviews})
            </Text>
          </View>

          <View style={styles.priceWrapper}>
            {event.mrp && event.mrp > event.price && (
              <Text style={styles.mrpPrice}>₹{event.mrp.toLocaleString()}</Text>
            )}
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₹{event.price.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {event.mrp && event.mrp > event.price && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>
              {Math.round(((event.mrp - event.price) / event.mrp) * 100)}% OFF
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    height: 210,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: colors.foreground,
    fontSize: 10,
    fontWeight: 'bold',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 6,
    borderRadius: 6,
  },
  content: {
    padding: 8,
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  topContent: {
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 12,
    color: colors.mutedForeground,
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  priceWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mrpPrice: {
    fontSize: 10,
    color: colors.mutedForeground,
    textDecorationLine: 'line-through',
  },
  priceContainer: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  price: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primaryForeground,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 40,
    backgroundColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.white,
  },
});
