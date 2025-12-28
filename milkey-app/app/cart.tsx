import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag, ShoppingCart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '@/lib/cartStore';
import PaymentBottomSheet from '@/components/PaymentBottomSheet';
import ConfirmBottomSheet from '@/components/ConfirmBottomSheet';

const { width } = Dimensions.get('window');

export default function CartScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { items, updateQuantity, removeFromCart, clearCart, getTotal, getItemCount, loadCart } = useCartStore();

    const [showPayment, setShowPayment] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const [itemToRemove, setItemToRemove] = useState<{ id: string; name: string } | null>(null);

    const styles = createStyles(colors, isDark, insets);

    useEffect(() => {
        loadCart();
    }, []);

    const handleCheckout = () => {
        if (items.length === 0) return;
        setShowPayment(true);
    };

    const handleRemove = (id: string, name: string) => {
        setItemToRemove({ id, name });
        setShowRemoveConfirm(true);
    };

    const confirmRemove = () => {
        if (itemToRemove) {
            removeFromCart(itemToRemove.id);
        }
        setShowRemoveConfirm(false);
        setItemToRemove(null);
    };

    const handlePaymentSuccess = () => {
        setShowPayment(false);
        clearCart();
        router.back();
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>My Cart</Text>
                <View style={styles.cartBadgeContainer}>
                    <ShoppingCart size={20} color={colors.foreground} />
                    {getItemCount() > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{getItemCount()}</Text>
                        </View>
                    )}
                </View>
            </View>

            {items.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <ShoppingBag size={60} color={colors.mutedForeground} />
                    <Text style={styles.emptyTitle}>Your cart is empty</Text>
                    <Text style={styles.emptySubtitle}>Add some products to get started</Text>
                    <Pressable onPress={() => router.back()} style={styles.shopBtn}>
                        <Text style={styles.shopBtnText}>Start Shopping</Text>
                    </Pressable>
                </View>
            ) : (
                <>
                    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                        {items.map((item) => (
                            <View key={item.id} style={styles.cartItem}>
                                <View style={styles.itemIcon}>
                                    <Text style={styles.itemEmoji}>{item.icon}</Text>
                                </View>
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    <Text style={styles.itemPrice}>₹{item.price} each</Text>
                                </View>
                                <View style={styles.quantityControls}>
                                    <Pressable
                                        onPress={() => updateQuantity(item.id, item.quantity - 1)}
                                        style={styles.quantityBtn}
                                    >
                                        <Minus size={14} color={colors.foreground} />
                                    </Pressable>
                                    <Text style={styles.quantityText}>{item.quantity}</Text>
                                    <Pressable
                                        onPress={() => updateQuantity(item.id, item.quantity + 1)}
                                        style={styles.quantityBtn}
                                    >
                                        <Plus size={14} color={colors.foreground} />
                                    </Pressable>
                                </View>
                                <View style={styles.itemTotal}>
                                    <Text style={styles.itemTotalText}>₹{item.price * item.quantity}</Text>
                                    <Pressable onPress={() => handleRemove(item.id, item.name)}>
                                        <Trash2 size={16} color={colors.destructive} />
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total ({getItemCount()} items)</Text>
                            <Text style={styles.totalValue}>₹{getTotal()}</Text>
                        </View>
                        <Pressable onPress={handleCheckout} style={styles.checkoutBtn}>
                            <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
                        </Pressable>
                    </View>
                </>
            )}

            <PaymentBottomSheet
                visible={showPayment}
                onClose={() => setShowPayment(false)}
                total={getTotal()}
                onSuccess={handlePaymentSuccess}
            />

            <ConfirmBottomSheet
                visible={showRemoveConfirm}
                onClose={() => {
                    setShowRemoveConfirm(false);
                    setItemToRemove(null);
                }}
                onConfirm={confirmRemove}
                title="Remove Item"
                message={`Remove ${itemToRemove?.name || 'this item'} from cart?`}
                confirmText="Remove"
                destructive
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
        paddingTop: insets.top + 8,
        paddingHorizontal: 12,
        paddingBottom: 10,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
    },
    cartBadgeContainer: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: colors.primary,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: colors.white,
        fontSize: 10,
        fontWeight: '700',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 12,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 13,
        color: colors.mutedForeground,
        marginTop: 4,
    },
    shopBtn: {
        marginTop: 20,
        backgroundColor: colors.primary,
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    shopBtnText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
    },
    cartItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    itemIcon: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    itemEmoji: {
        fontSize: 22,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
    },
    itemPrice: {
        fontSize: 11,
        color: colors.mutedForeground,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginRight: 10,
    },
    quantityBtn: {
        width: 26,
        height: 26,
        borderRadius: 6,
        backgroundColor: colors.muted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
        minWidth: 18,
        textAlign: 'center',
    },
    itemTotal: {
        alignItems: 'flex-end',
        gap: 4,
    },
    itemTotalText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primary,
    },
    footer: {
        backgroundColor: colors.card,
        padding: 12,
        paddingBottom: insets.bottom + 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    totalLabel: {
        fontSize: 14,
        color: colors.mutedForeground,
    },
    totalValue: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.foreground,
    },
    checkoutBtn: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        padding: 14,
        alignItems: 'center',
    },
    checkoutBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.white,
    },
});