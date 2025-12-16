import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '@/lib/colors';
import { getFavorites, toggleFavorite, Event } from '@/lib/mockData';
import TopBar from '@/components/TopBar';
import EventCard from '@/components/EventCard';
import { EmptyState } from '@/components/EmptyState';
import { eventsApi, MinimalServerEvent } from '@/lib/api';

// Helper to map MinimalServerEvent to Event format for listing screens
const mapMinimalEventToEvent = (serverEvent: MinimalServerEvent): Event => ({
  id: serverEvent._id,
  title: serverEvent.title,
  image: serverEvent.image,
  images: [serverEvent.image],
  location: serverEvent.location,
  fullLocation: serverEvent.location,
  category: '',
  price: serverEvent.price,
  mrp: serverEvent.mrp || serverEvent.price,
  rating: serverEvent.rating,
  reviews: serverEvent.reviews,
  badge: serverEvent.badge,
  description: '',
  date: '',
  time: '',
  services: [],
  vendor: {
    id: '',
    name: '',
    avatar: '',
    phone: '',
    email: '',
    experience: '',
  },
});

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteEvents, setFavoriteEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavoriteEvents = async (favoriteIds: string[]) => {
    if (favoriteIds.length === 0) {
      setFavoriteEvents([]);
      return;
    }

    try {
      // Fetch all events with minimal fields and filter by favorite IDs
      const result = await eventsApi.getAll({ limit: 100, fields: 'minimal' });
      // API returns { success, data: [...events], pagination }
      const eventsData = (result as any).data || (result as any).response || [];

      if (result.success && Array.isArray(eventsData)) {
        const mappedEvents = eventsData.map(mapMinimalEventToEvent);
        const filtered = mappedEvents.filter((e: Event) => favoriteIds.includes(e.id));
        setFavoriteEvents(filtered);
      } else {
        setFavoriteEvents([]);
      }
    } catch (error) {
      console.error('Error loading favorite events:', error);
      setFavoriteEvents([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      (async () => {
        try {
          setLoading(true);
          const favs = await getFavorites();
          if (!isActive) return;
          setFavorites(favs);
          await loadFavoriteEvents(favs);
        } catch (error) {
          if (!isActive) return;
          setFavorites([]);
          setFavoriteEvents([]);
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

  const handleToggleFavorite = async (eventId: string) => {
    try {
      setLoading(true);
      await toggleFavorite(eventId);
      const favs = await getFavorites();
      setFavorites(favs);
      await loadFavoriteEvents(favs);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopBar />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : favoriteEvents.length === 0 ? (
            <EmptyState
              title="No favorites yet"
              subtitle="Start adding events to your favorites to see them here"
            />
          ) : (
            <View style={styles.eventsGrid}>
              {favoriteEvents.map((event) => (
                <View key={event.id} style={styles.eventCardContainer}>
                  <EventCard
                    event={event}
                    isFavorite={true}
                    onToggleFavorite={() => handleToggleFavorite(event.id)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingVertical: 0,
    paddingHorizontal: 8,
    paddingBottom: 90,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  eventsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  eventCardContainer: {
    width: '48%',
  },
});
