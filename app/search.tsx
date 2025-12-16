import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, RefreshControl, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Search, ListFilter, X, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { getFavorites, toggleFavorite, Event } from '@/lib/mockData';
import TopBar from '@/components/TopBar';
import EventCard from '@/components/EventCard';
import { categoriesApi, eventsApi, Category, MinimalServerEvent } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useLocalSearchParams } from 'expo-router';

const ITEMS_PER_PAGE = 12;

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
  mrp: serverEvent.price,
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

export default function SearchScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 100000]);
  const [minRating, setMinRating] = useState('all');
  const [priceSort, setPriceSort] = useState<'none' | 'low_to_high' | 'high_to_low'>('none');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialCategorySet, setInitialCategorySet] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const isLoadingMore = useRef(false);

  // Debounce search query to prevent excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const isInitialMount = useRef(true);
  const prevFiltersRef = useRef({ selectedCategory, selectedLocation, priceRange, debouncedSearchQuery, minRating });

  const locations = ['all', 'Mumbai', 'Bangalore', 'Delhi NCR', 'Goa', 'Pune'];
  const ratings = [
    { value: 'all', label: 'All Ratings' },
    { value: '4', label: '4+ Stars' },
    { value: '4.5', label: '4.5+ Stars' },
    { value: '4.8', label: '4.8+ Stars' },
  ];

  const loadEvents = useCallback(async (page: number = 1, append: boolean = false) => {
    if (page === 1) {
      setEventsLoading(true);
    } else {
      setLoadingMore(true);
      isLoadingMore.current = true;
    }

    try {
      const params: {
        category?: string;
        city?: string;
        minPrice?: number;
        maxPrice?: number;
        search?: string;
        minRating?: number;
        sortBy?: 'price_asc' | 'price_desc' | 'rating_desc' | 'newest';
        fields?: 'minimal' | 'full';
        page?: number;
        limit?: number;
      } = {
        fields: 'minimal',
        page,
        limit: ITEMS_PER_PAGE
      };

      // Category filter
      if (selectedCategory !== 'all') {
        const categoryName = categories.find(c => c.slug === selectedCategory)?.name || selectedCategory;
        params.category = categoryName;
      }

      // Location filter
      if (selectedLocation !== 'all') {
        params.city = selectedLocation;
      }

      // Price filter
      if (priceRange[0] > 0) {
        params.minPrice = priceRange[0];
      }
      if (priceRange[1] < 100000) {
        params.maxPrice = priceRange[1];
      }

      // Search query - use debounced value
      if (debouncedSearchQuery.trim()) {
        params.search = debouncedSearchQuery.trim();
      }

      // Rating filter - server-side
      if (minRating !== 'all') {
        params.minRating = parseFloat(minRating);
      }

      // Price sort - server-side
      if (priceSort === 'low_to_high') {
        params.sortBy = 'price_asc';
      } else if (priceSort === 'high_to_low') {
        params.sortBy = 'price_desc';
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

        // Update pagination state
        if (pagination) {
          setTotalResults(pagination.total || 0);
          setHasMore(pagination.page < pagination.pages);
        } else {
          setTotalResults(append ? events.length + mappedEvents.length : mappedEvents.length);
          setHasMore(eventsData.length === ITEMS_PER_PAGE);
        }
      } else {
        if (!append) {
          setEvents([]);
          setTotalResults(0);
        }
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading events:', error);
      if (!append) {
        setEvents([]);
        setTotalResults(0);
      }
      setHasMore(false);
    } finally {
      setEventsLoading(false);
      setLoadingMore(false);
      isLoadingMore.current = false;
    }
  }, [selectedCategory, selectedLocation, priceRange, debouncedSearchQuery, minRating, priceSort, categories]);

  const loadMoreEvents = useCallback(() => {
    if (isLoadingMore.current || !hasMore || eventsLoading) return;

    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    loadEvents(nextPage, true);
  }, [currentPage, hasMore, eventsLoading, loadEvents]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom && hasMore && !isLoadingMore.current && !eventsLoading) {
      loadMoreEvents();
    }
  }, [loadMoreEvents, hasMore, eventsLoading]);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favs = await getFavorites();
        setFavorites(favs);
      } catch (error) {
        setFavorites([]);
      }
    };

    const loadCategories = async () => {
      try {
        const result = await categoriesApi.getAll();
        const categoriesData = (result as any).data || result.response;
        if (result.success && categoriesData) {
          setCategories(categoriesData);

          // Set initial category from URL params after categories are loaded
          if (params.category && !initialCategorySet) {
            setSelectedCategory(params.category);
            setInitialCategorySet(true);
          }
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadFavorites();
    loadCategories();
  }, [params.category, initialCategorySet]);

  // Load events when filters or debounced search query changes
  useEffect(() => {
    if (!categoriesLoading) {
      // Reset pagination when filters change
      setCurrentPage(1);
      setHasMore(true);

      if (isInitialMount.current) {
        isInitialMount.current = false;
      }

      loadEvents(1, false);
    }
  }, [selectedCategory, selectedLocation, priceRange, debouncedSearchQuery, minRating, priceSort, categoriesLoading, categories]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    setHasMore(true);
    await loadEvents(1, false);
    setRefreshing(false);
  }, [loadEvents]);

  const handleToggleFavorite = async (eventId: string) => {
    try {
      await toggleFavorite(eventId);
      const updatedFavorites = await getFavorites();
      setFavorites(updatedFavorites);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedLocation('all');
    setPriceRange([0, 100000]);
    setMinRating('all');
    setPriceSort('none');
  };

  return (
    <View style={styles.container}>
      <TopBar />

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
        <View style={styles.content}>
          {/* Search Row */}
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <Search size={22} color={colors.mutedForeground} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search events, vendors..."
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery !== debouncedSearchQuery && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.searchLoading} />
              )}
            </View>
            <Pressable style={styles.filterButton} onPress={() => setShowFilters(true)}>
              <ListFilter size={20} color={colors.foreground} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Results Count */}
          <Text style={styles.resultsCount}>
            {eventsLoading ? 'Searching...' : `${totalResults > 0 ? totalResults : events.length} results found`}
          </Text>

          {/* Results Grid */}
          {eventsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : events.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No events found matching your filters</Text>
              <Pressable onPress={clearFilters}>
                <Text style={styles.clearFiltersLink}>Clear all filters</Text>
              </Pressable>
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

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.filterOverlay}>
          <View style={styles.filterModal}>
            {/* Header */}
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              <Pressable onPress={() => setShowFilters(false)}>
                <X size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView style={styles.filterContent} showsVerticalScrollIndicator={false}>
              {/* Category Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Category</Text>
                <View style={styles.filterOptions}>
                  {categoriesLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      {/* All Category - Default */}
                      <Pressable
                        style={[
                          styles.filterOption,
                          selectedCategory === 'all' && styles.selectedFilterOption
                        ]}
                        onPress={() => setSelectedCategory('all')}
                      >
                        <Text style={[
                          styles.filterOptionText,
                          selectedCategory === 'all' && styles.selectedFilterOptionText
                        ]}>
                          All
                        </Text>
                      </Pressable>
                      {/* Server Categories */}
                      {categories.map((category) => (
                        <Pressable
                          key={category._id}
                          style={[
                            styles.filterOption,
                            selectedCategory === category.slug && styles.selectedFilterOption
                          ]}
                          onPress={() => setSelectedCategory(category.slug)}
                        >
                          <Text style={[
                            styles.filterOptionText,
                            selectedCategory === category.slug && styles.selectedFilterOptionText
                          ]}>
                            {category.name}
                          </Text>
                        </Pressable>
                      ))}
                    </>
                  )}
                </View>
              </View>

              {/* Location Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Location</Text>
                <View style={styles.filterOptions}>
                  {locations.map((location) => (
                    <Pressable
                      key={location}
                      style={[
                        styles.filterOption,
                        selectedLocation === location && styles.selectedFilterOption
                      ]}
                      onPress={() => setSelectedLocation(location)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        selectedLocation === location && styles.selectedFilterOptionText
                      ]}>
                        {location === 'all' ? 'All Locations' : location}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Price Range */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>
                  Price Range: ₹{priceRange[0].toLocaleString()} - ₹{priceRange[1].toLocaleString()}
                </Text>
                <View style={styles.priceInputs}>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Min"
                    placeholderTextColor={colors.mutedForeground}
                    value={priceRange[0].toString()}
                    onChangeText={(text) => setPriceRange([parseInt(text) || 0, priceRange[1]])}
                    keyboardType="numeric"
                  />
                  <Text style={styles.priceSeparator}>to</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Max"
                    placeholderTextColor={colors.mutedForeground}
                    value={priceRange[1].toString()}
                    onChangeText={(text) => setPriceRange([priceRange[0], parseInt(text) || 100000])}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Rating Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Minimum Rating</Text>
                <View style={styles.filterOptions}>
                  {ratings.map((rating) => (
                    <Pressable
                      key={rating.value}
                      style={[
                        styles.filterOption,
                        minRating === rating.value && styles.selectedFilterOption
                      ]}
                      onPress={() => setMinRating(rating.value)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        minRating === rating.value && styles.selectedFilterOptionText
                      ]}>
                        {rating.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Sort by Price */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Sort by Price</Text>
                <View style={styles.filterOptions}>
                  <Pressable
                    style={[
                      styles.filterOption,
                      styles.sortOption,
                      priceSort === 'none' && styles.selectedFilterOption
                    ]}
                    onPress={() => setPriceSort('none')}
                  >
                    <ArrowUpDown size={14} color={priceSort === 'none' ? colors.primaryForeground : colors.foreground} />
                    <Text style={[
                      styles.filterOptionText,
                      priceSort === 'none' && styles.selectedFilterOptionText
                    ]}>
                      Default
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.filterOption,
                      styles.sortOption,
                      priceSort === 'low_to_high' && styles.selectedFilterOption
                    ]}
                    onPress={() => setPriceSort('low_to_high')}
                  >
                    <TrendingUp size={14} color={priceSort === 'low_to_high' ? colors.primaryForeground : colors.foreground} />
                    <Text style={[
                      styles.filterOptionText,
                      priceSort === 'low_to_high' && styles.selectedFilterOptionText
                    ]}>
                      Low to High
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.filterOption,
                      styles.sortOption,
                      priceSort === 'high_to_low' && styles.selectedFilterOption
                    ]}
                    onPress={() => setPriceSort('high_to_low')}
                  >
                    <TrendingDown size={14} color={priceSort === 'high_to_low' ? colors.primaryForeground : colors.foreground} />
                    <Text style={[
                      styles.filterOptionText,
                      priceSort === 'high_to_low' && styles.selectedFilterOptionText
                    ]}>
                      High to Low
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Clear Filters */}
              <Pressable style={styles.clearFiltersButton} onPress={clearFilters}>
                <X size={16} color={colors.foreground} />
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 6,
    paddingHorizontal: 8,
    paddingBottom: 90,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
  },
  searchLoading: {
    marginLeft: 8,
  },
  filterButton: {
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsCount: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 16,
  },
  eventsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  eventCardContainer: {
    width: '48%',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: colors.mutedForeground,
    marginBottom: 8,
  },
  clearFiltersLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
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
  filterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  filterContent: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedFilterOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterOptionText: {
    fontSize: 14,
    color: colors.foreground,
  },
  selectedFilterOptionText: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
  },
  priceSeparator: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
});
