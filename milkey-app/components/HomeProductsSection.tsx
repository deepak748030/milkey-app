import React, { useCallback, useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Package, ChevronRight, ShoppingCart, Star } from 'lucide-react-native';
import { productsApi, Product } from '@/lib/milkeyApi';
import { useSubscriptionStore } from '@/lib/subscriptionStore';
import { useCartStore } from '@/lib/cartStore';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 16) / 2;

export default memo(function HomeProductsSection() {
  const { colors, isDark } = useTheme();
  const { status } = useSubscriptionStore();
  const { addToCart, getItemCount } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const hasSub = status?.hasAnySubscription || false;
      let loaded: Product[] | null = null;
      const res = await productsApi.getAll({ subscribed: hasSub }).catch(() => null);
      if (res?.success && res.response?.data && res.response.data.length > 0) {
        loaded = res.response.data.slice(0, 6);
        await AsyncStorage.setItem('milkey_products_cache', JSON.stringify(res.response.data));
        await AsyncStorage.setItem('milkey_products_store', JSON.stringify(res.response.data));
      } else {
        const res2 = await productsApi.getAll({ subscribed: true }).catch(()=>null);
        if (res2?.success && res2.response?.data && res2.response.data.length > 0) {
          loaded = res2.response.data.slice(0,6);
        } else {
          const def = await productsApi.getDefault().catch(()=>null);
          if (def?.success && (def.response as any)?.data?.length) {
            const d = (def.response as any).data;
            loaded = d.map((p:any)=>({ _id: p.id || p._id, name: p.name, price: p.price, unit: p.unit || 'unit', icon: p.icon || '🥛', description: p.description || '', stock: p.stock ?? 100, isActive: true, image: p.image } as Product)).slice(0,6);
          }
        }
        if (!loaded) {
          const cached = await AsyncStorage.getItem('milkey_products_cache');
          if (cached) loaded = JSON.parse(cached).slice(0, 6);
        }
        if (!loaded || loaded.length===0) {
          loaded = null;
        }
      }
      if (loaded) setProducts(loaded); else setProducts([]);
    } catch {}
    setLoading(false);
  }, [status?.hasAnySubscription]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleAdd = (p: Product) => {
    addToCart({ id: p._id, name: p.name, price: p.price, icon: p.icon, image: p.image }, 1);
    setAddedId(p._id);
    setTimeout(() => setAddedId(null), 1200);
  };

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Package size={14} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Our Products</Text>
            <Text style={styles.headerSub}>Fresh • Stored • Ready to order</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/products')} style={styles.viewAllBtn}>
          <Text style={styles.viewAllText}>View All</Text>
          <ChevronRight size={12} color={colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyBox}>
          <Package size={24} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No products available</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {products.map((p) => (
            <Pressable key={p._id} style={styles.card} onPress={() => router.push('/products')}>
              <View style={styles.accent} />
              {p.image ? (
                <Image source={{ uri: p.image }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.iconBox}>
                  <Text style={styles.iconText}>{p.icon || '🥛'}</Text>
                </View>
              )}
              <View style={styles.cardContent}>
                <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.desc} numberOfLines={1}>{p.description || p.unit || 'Premium quality'}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>₹{p.price}</Text>
                  <Text style={styles.unit}>/{p.unit || 'L'}</Text>
                  {p.stock !== undefined && p.stock > 0 && (
                    <View style={styles.stockBadge}>
                      <Star size={8} color={colors.primary} />
                      <Text style={styles.stockText}>In stock</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => handleAdd(p)}
                  style={[styles.cartBtn, addedId === p._id && styles.cartBtnAdded]}
                >
                  <ShoppingCart size={11} color={addedId === p._id ? '#fff' : colors.primary} />
                  <Text style={[styles.cartBtnText, addedId === p._id && { color: '#fff' }]}>
                    {addedId === p._id ? 'Added!' : 'Add'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.footerRow}>
        <View style={styles.dot} />
        <Text style={styles.footerText}>{products.length} products stored • Tap to view details</Text>
      </View>
    </View>
  );
});

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  wrap: { marginTop: 10, paddingHorizontal: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 13, fontWeight: '800', color: colors.foreground },
  headerSub: { fontSize: 10, color: colors.mutedForeground, fontWeight: '500' },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  viewAllText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  loadingText: { fontSize: 11, color: colors.mutedForeground, fontWeight: '500' },
  emptyBox: { alignItems: 'center', paddingVertical: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, gap: 4 },
  emptyText: { fontSize: 11, color: colors.mutedForeground, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  card: { width: CARD_WIDTH, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: colors.primary },
  image: { width: '100%', height: 86 },
  iconBox: { width: '100%', height: 86, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 28 },
  cardContent: { padding: 7, gap: 2 },
  name: { fontSize: 11, fontWeight: '700', color: colors.foreground },
  desc: { fontSize: 9, color: colors.mutedForeground, fontWeight: '500' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  price: { fontSize: 12, fontWeight: '800', color: colors.primary },
  unit: { fontSize: 9, color: colors.mutedForeground, fontWeight: '600' },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: `${colors.primary}12`, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, marginLeft: 'auto' },
  stockText: { fontSize: 8, fontWeight: '700', color: colors.primary },
  cartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4, paddingVertical: 5, borderRadius: 7, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
  cartBtnAdded: { backgroundColor: colors.primary, borderColor: colors.primary },
  cartBtnText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  footerText: { fontSize: 9, color: colors.mutedForeground, fontWeight: '500' },
});
