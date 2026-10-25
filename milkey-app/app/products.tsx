import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';
import { ArrowLeft, Package } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { productsApi, Product } from '@/lib/milkeyApi';
import { useCartStore } from '@/lib/cartStore';
import { useSubscriptionStore } from '@/lib/subscriptionStore';
import { SuccessModal } from '@/components/SuccessModal';

const FALLBACK_PRODUCTS: Product[] = [
    { _id: 'fallback-1', name: 'Fresh Milk', price: 60, unit: 'liter', icon: '🥛', description: 'Pure farm fresh milk', stock: 100, isActive: true },
    { _id: 'fallback-2', name: 'Curd (Dahi)', price: 80, unit: 'kg', icon: '🍶', description: 'Fresh curd', stock: 100, isActive: true },
    { _id: 'fallback-3', name: 'Butter', price: 500, unit: 'kg', icon: '🧈', description: 'Premium butter', stock: 100, isActive: true },
    { _id: 'fallback-4', name: 'Paneer', price: 380, unit: 'kg', icon: '🧀', description: 'Fresh paneer', stock: 100, isActive: true },
];

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 22) / 2;

export default function ProductsScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { addToCart, loadCart, getItemCount } = useCartStore();
    const { status } = useSubscriptionStore();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [quantities, setQuantities] = useState<{ [key: string]: number }>({});

    // Cart success notification
    const [cartSuccessVisible, setCartSuccessVisible] = useState(false);
    const [cartSuccessMessage, setCartSuccessMessage] = useState('');

    const styles = createStyles(colors, isDark, insets);

    useEffect(() => {
        loadCart();
    }, []);

    const fetchProducts = useCallback(async () => {
        try {
            const hasSubscription = status?.hasAnySubscription || false;
            let loaded: Product[] | null = null;
            const res = await productsApi.getAll({ subscribed: hasSubscription }).catch(()=>null);
            if (res?.success && res.response?.data && res.response.data.length > 0) {
                loaded = res.response.data;
            } else {
                // try with subscribed=true to get all admin products (including subscriptionOnly)
                const res2 = await productsApi.getAll({ subscribed: true }).catch(()=>null);
                if (res2?.success && res2.response?.data && res2.response.data.length > 0) loaded = res2.response.data;
            }
            if (!loaded || loaded.length === 0) {
                const def = await productsApi.getDefault().catch(()=>null);
                if (def?.success && (def.response as any)?.data?.length) {
                    const d = (def.response as any).data;
                    loaded = d.map((p:any)=>({ _id: p.id || p._id, name: p.name, price: p.price, unit: p.unit || 'unit', icon: p.icon || '🥛', description: p.description || '', stock: p.stock ?? 100, isActive: true, image: p.image } as Product));
                }
            }
            if (!loaded || loaded.length === 0) {
                setProducts([]);
                setQuantities({});
            } else {
                setProducts(loaded);
                const initialQuantities: { [key: string]: number } = {};
                loaded.forEach(p => { initialQuantities[p._id] = 1; });
                setQuantities(initialQuantities);
            }
        } catch (error) {
            setProducts([]);
            setQuantities({});
        } finally {
            setLoading(false);
        }
    }, [status?.hasAnySubscription]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchProducts();
        setRefreshing(false);
    }, [fetchProducts]);

    const updateQuantity = (id: string, delta: number) => {
        setQuantities(prev => ({
            ...prev,
            [id]: Math.max(1, (prev[id] || 1) + delta)
        }));
    };

    const handleAddToCart = (product: Product) => {
        const quantity = quantities[product._id] || 1;
        addToCart(
            { id: product._id, name: product.name, price: product.price, icon: product.icon, image: product.image },
            quantity
        );
        const totalItems = getItemCount() + quantity;
        setCartSuccessMessage(`Added ${quantity} ${product.name} to cart (${totalItems} items in cart)`);
        setCartSuccessVisible(true);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <ArrowLeft size={22} color={colors.foreground} />
                </Pressable>
                <View style={styles.headerTitleWrap}>
                    <Package size={18} color={colors.primary} />
                    <Text style={styles.headerTitle}>{t.home.products}</Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>{t.common.loading}</Text>
                    </View>
                ) : products.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Package size={44} color={colors.mutedForeground} />
                        <Text style={styles.emptyTitle}>{t.common.noData}</Text>
                        <Text style={styles.emptyText}>No products available right now.</Text>
                    </View>
                ) : (
                    <View style={styles.productsGrid}>
                        {products.map((product) => (
                            <View key={product._id} style={styles.productCard}>
                                {product.image ? (
                                    <Image
                                        source={{ uri: product.image }}
                                        style={styles.productImage}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={styles.productIconContainer}>
                                        <Text style={styles.productIcon}>{product.icon}</Text>
                                    </View>
                                )}
                                <View style={styles.productContent}>
                                    <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                                    <Text style={styles.productPrice}>₹{product.price}</Text>

                                    <View style={styles.quantityRow}>
                                        <Pressable
                                            style={styles.quantityBtn}
                                            onPress={() => updateQuantity(product._id, -1)}
                                        >
                                            <Text style={styles.quantityBtnText}>-</Text>
                                        </Pressable>
                                        <Text style={styles.quantityText}>{quantities[product._id] || 1}</Text>
                                        <Pressable
                                            style={styles.quantityBtn}
                                            onPress={() => updateQuantity(product._id, 1)}
                                        >
                                            <Text style={styles.quantityBtnText}>+</Text>
                                        </Pressable>
                                    </View>

                                    <Pressable style={styles.addToCartBtn} onPress={() => handleAddToCart(product)}>
                                        <Text style={styles.addToCartText}>{t.home.addToCart}</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Cart Added Success Modal */}
            <SuccessModal
                isVisible={cartSuccessVisible}
                onClose={() => setCartSuccessVisible(false)}
                title="Added to Cart"
                message={cartSuccessMessage}
            />
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.card,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.muted,
    },
    headerTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.foreground,
    },
    headerSpacer: {
        width: 38,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 8,
        paddingTop: 10,
        paddingBottom: 30,
    },
    loadingContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        gap: 10,
    },
    loadingText: {
        color: colors.mutedForeground,
        fontSize: 13,
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        gap: 8,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.foreground,
        marginTop: 6,
    },
    emptyText: {
        fontSize: 12.5,
        color: colors.mutedForeground,
    },
    productsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 6,
    },
    productCard: {
        width: CARD_WIDTH,
        backgroundColor: colors.card,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 6,
        overflow: 'hidden',
    },
    productIconContainer: {
        width: '100%',
        height: 110,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    productImage: {
        width: '100%',
        height: 110,
    },
    productIcon: {
        fontSize: 36,
    },
    productContent: {
        padding: 10,
        alignItems: 'center',
    },
    productName: {
        fontSize: 12.5,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 2,
        textAlign: 'center',
        minHeight: 32,
    },
    productPrice: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: 8,
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    quantityBtn: {
        width: 26,
        height: 26,
        borderRadius: 5,
        backgroundColor: colors.muted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.foreground,
    },
    quantityText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
        minWidth: 20,
        textAlign: 'center',
    },
    addToCartBtn: {
        backgroundColor: colors.primary,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        width: '100%',
        alignItems: 'center',
    },
    addToCartText: {
        color: colors.white,
        fontSize: 11.5,
        fontWeight: '600',
    },
});
