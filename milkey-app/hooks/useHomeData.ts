import { useState, useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { productsApi, reportsApi, bannersApi, Product, HomeStats, Banner } from '@/lib/milkeyApi';
import { useCartStore } from '@/lib/cartStore';
import { useSubscriptionStore } from '@/lib/subscriptionStore';

export function useHomeData() {
  const [loading, setLoading] = useState(true);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [homeStats, setHomeStats] = useState<HomeStats | null>(null);
  const bannerSkeletonOpacity = useRef(new Animated.Value(0.4)).current;
  const { status } = useSubscriptionStore();
  const { loadCart } = useCartStore();

  const fetchBanners = useCallback(async () => {
    try { setBannersLoading(true); const r = await bannersApi.getBanners(); if (r.success) setBanners((r.response as any) || []); } catch { setBanners([]); } finally { setBannersLoading(false); }
  }, []);

  const fetchProducts = useCallback(async () => {
    try { const r = await productsApi.getProducts({ limit: 6, status: 'active' }); if (r.success) setProducts((r.response as any)?.products || (r.response as any) || []); } catch { setProducts([]); }
  }, []);

  const fetchHomeStats = useCallback(async () => {
    try { const r = await reportsApi.getHomeStats(); if (r.success) setHomeStats(r.response as HomeStats); } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchBanners(), fetchProducts(), fetchHomeStats(), loadCart()]);
    setLoading(false);
  }, [fetchBanners, fetchProducts, fetchHomeStats, loadCart]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBanners(), fetchProducts(), fetchHomeStats()]);
    setRefreshing(false);
  }, [fetchBanners, fetchProducts, fetchHomeStats]);

  return { loading, bannersLoading, refreshing, banners, products, homeStats, bannerSkeletonOpacity, fetchData, onRefresh, fetchHomeStats, setBanners, setProducts, setHomeStats };
}
