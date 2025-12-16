import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, NativeSyntheticEvent, NativeScrollEvent, Platform, TextInput } from 'react-native';
import { Search, ListFilter } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { getFavorites, toggleFavorite, Event } from '@/lib/mockData';
import TopBar from '@/components/TopBar';
import BannerCarousel from '@/components/BannerCarousel';
import EventCard from '@/components/EventCard';
import { CategoryPill } from '@/components/CategoryPill';
import { router } from 'expo-router';
import { fetchLocationOnce } from '@/lib/locationStore';
import { categoriesApi, eventsApi, Category, MinimalServerEvent, appRatingApi, getToken } from '@/lib/api';
import AppRatingModal from '@/components/AppRatingModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ITEMS_PER_PAGE = 10;

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

const RATING_SESSION_KEY = 'app_rating_session_skipped';

export default function HomeScreen() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const isLoadingMore = useRef(false);

  // App rating modal state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const hasCheckedRating = useRef(false);

  const loadEvents = async (category?: string, page: number = 1, append: boolean = false) => {
    if (page === 1) {
      setEventsLoading(true);
    } else {
      setLoadingMore(true);
      isLoadingMore.current = true;
    }

    try {
      const params: { category?: string; limit?: number; page?: number; fields?: 'minimal' | 'full' } = {
        limit: ITEMS_PER_PAGE,
        page,
        fields: 'minimal'
      };
      if (category && category !== 'all') {
        params.category = category;
      }

      const result = await eventsApi.getAll(params);
      const eventsData = (result as any).data || (result as any).response || [];
      const pagination = (result as any).pagination;

      if (result.success && Array.isArray(eventsData)) {
        const mappedEvents = eventsData.map(mapMinimalEventToEvent);

        if (append) {
          setEvents(prev => [...prev, ...mappedEvents]);
        } else {
          setEvents(mappedEvents);
        }

        // Check if there are more pages
        if (pagination) {
          setHasMore(pagination.page < pagination.pages);
        } else {
          setHasMore(eventsData.length === ITEMS_PER_PAGE);
        }
      } else {
        if (!append) setEvents([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading events:', error);
      if (!append) setEvents([]);
      setHasMore(false);
    } finally {
      setEventsLoading(false);
      setLoadingMore(false);
      isLoadingMore.current = false;
    }
  };

  const loadMoreEvents = useCallback(() => {
    if (isLoadingMore.current || !hasMore || eventsLoading) return;

    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);

    const categoryName = selectedCategory === 'all'
      ? undefined
      : categories.find(c => c.slug === selectedCategory)?.name || selectedCategory;

    loadEvents(categoryName, nextPage, true);
  }, [currentPage, hasMore, eventsLoading, selectedCategory, categories]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom && hasMore && !isLoadingMore.current && !eventsLoading) {
      loadMoreEvents();
    }
  }, [loadMoreEvents, hasMore, eventsLoading]);

  // Check if user should see rating modal
  const checkAppRating = useCallback(async () => {
    if (hasCheckedRating.current) return;
    hasCheckedRating.current = true;

    try {
      // Check if user is logged in
      const token = await getToken();
      if (!token) return;

      // Check if skipped this session
      const sessionSkipped = await AsyncStorage.getItem(RATING_SESSION_KEY);
      if (sessionSkipped === 'true') return;

      // Check if user already rated
      const result = await appRatingApi.checkRating();
      if (result.success && result.response) {
        if (!result.response.hasRated) {
          // Show rating modal after a short delay
          setTimeout(() => {
            setShowRatingModal(true);
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error checking app rating:', error);
    }
  }, []);

  const handleSubmitRating = async (rating: number, feedback: string) => {
    const result = await appRatingApi.submitRating({
      rating,
      feedback,
      platform: Platform.OS,
      appVersion: '1.0.0',
    });
    if (!result.success) {
      throw new Error(result.message);
    }
  };

  const handleSkipRating = async () => {
    // Mark as skipped for this session
    await AsyncStorage.setItem(RATING_SESSION_KEY, 'true');
    setShowRatingModal(false);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const favs = await getFavorites();
        setFavorites(favs);
      } catch (error) {
        setFavorites([]);
      } finally {
        setLoading(false);
      }
    };

    const loadCategories = async () => {
      try {
        const result = await categoriesApi.getAll();
        const categoriesData = (result as any).data || result.response;
        if (result.success && categoriesData) {
          setCategories(categoriesData);
        } else {
          setCategories([]);
        }
      } catch (error) {
        console.error('Error loading categories:', error);
        setCategories([]);
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadData();
    loadCategories();
    loadEvents();
    fetchLocationOnce();

    // Check app rating after initial load
    checkAppRating();
  }, [checkAppRating]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    setHasMore(true);
    try {
      const [favs, categoriesResult] = await Promise.all([
        getFavorites(),
        categoriesApi.getAll()
      ]);
      setFavorites(favs);
      const categoriesData = (categoriesResult as any).data || categoriesResult.response;
      if (categoriesResult.success && categoriesData) {
        setCategories(categoriesData);
      }
      const categoryName = selectedCategory === 'all'
        ? undefined
        : categories.find(c => c.slug === selectedCategory)?.name || selectedCategory;
      await loadEvents(categoryName, 1, false);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, [selectedCategory, categories]);

  // Reload events when category changes
  useEffect(() => {
    setCurrentPage(1);
    setHasMore(true);
    const categoryName = selectedCategory === 'all'
      ? undefined
      : categories.find(c => c.slug === selectedCategory)?.name || selectedCategory;
    loadEvents(categoryName, 1, false);
  }, [selectedCategory, categories]);

  const handleToggleFavorite = async (eventId: string) => {
    try {
      await toggleFavorite(eventId);
      const updatedFavorites = await getFavorites();
      setFavorites(updatedFavorites);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleSearchPress = () => {
    router.push('/search');
  };

  const handleSeeAllPress = () => {
    router.push('/search');
  };

  return (
    <View style={styles.container}>
      <TopBar />

      {/* App Rating Modal */}
      <AppRatingModal
        visible={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onSubmit={handleSubmitRating}
        onSkip={handleSkipRating}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <BannerCarousel />

        <View style={styles.content}>
          {/* Search Row */}
          <View style={styles.searchRow}>
            <Pressable style={styles.searchContainer} onPress={handleSearchPress}>
              <Search size={22} color={colors.mutedForeground} style={styles.searchIcon} />
              <Text style={styles.searchPlaceholder}>Search events, vendors...</Text>
            </Pressable>
            <Pressable style={styles.filterButton} onPress={handleSearchPress}>
              <ListFilter size={20} color={colors.foreground} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Category Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
            contentContainerStyle={styles.categoriesContent}
          >
            {categoriesLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                {/* All Category - Default */}
                <CategoryPill
                  key="all"
                  name="All"
                  isActive={selectedCategory === 'all'}
                  onPress={() => setSelectedCategory('all')}
                />
                {/* Server Categories */}
                {categories.map((category) => (
                  <CategoryPill
                    key={category._id}
                    name={category.name}
                    isActive={selectedCategory === category.slug}
                    onPress={() => setSelectedCategory(category.slug)}
                  />
                ))}
              </>
            )}
          </ScrollView>

          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Events</Text>
            <Pressable onPress={handleSeeAllPress}>
              <Text style={styles.seeAllText}>See All</Text>
            </Pressable>
          </View>

          {/* Events Grid */}
          {eventsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : events.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No events found</Text>
            </View>
          ) : (
            <>
              <View style={styles.eventsGrid}>
                {events.map((event) => (
                  <View key={event.id} style={styles.eventCardContainer}>
                    <EventCard
                      event={event}
                      isFavorite={favorites.includes(event.id)}
                      onToggleFavorite={() => handleToggleFavorite(event.id)}
                    />
                  </View>
                ))}
              </View>

              {/* Load More Indicator */}
              {loadingMore && (
                <View style={styles.loadMoreContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadMoreText}>Loading more...</Text>
                </View>
              )}

              {!hasMore && events.length > 0 && (
                <View style={styles.endContainer}>
                  <Text style={styles.endText}>No more events</Text>
                </View>
              )}
            </>
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
    paddingHorizontal: 8,
    paddingVertical: 16,
    paddingBottom: 90,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesContainer: {
    marginBottom: 16,
    marginTop: 16,
  },
  categoriesContent: {
    paddingRight: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  eventsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  eventCardContainer: {
    width: '48%',
    height: 210,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  endContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },

  endText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
});
