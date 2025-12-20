import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    icon: string;
}

interface CartState {
    items: CartItem[];
    addToCart: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
    updateQuantity: (id: string, quantity: number) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    getTotal: () => number;
    getItemCount: () => number;
    loadCart: () => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => ({
    items: [],

    addToCart: (item, quantity) => {
        set((state) => {
            const existingItem = state.items.find((i) => i.id === item.id);
            let newItems;

            if (existingItem) {
                newItems = state.items.map((i) =>
                    i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i
                );
            } else {
                newItems = [...state.items, { ...item, quantity }];
            }

            AsyncStorage.setItem('cart', JSON.stringify(newItems));
            return { items: newItems };
        });
    },

    updateQuantity: (id, quantity) => {
        set((state) => {
            const newItems = quantity <= 0
                ? state.items.filter((i) => i.id !== id)
                : state.items.map((i) => (i.id === id ? { ...i, quantity } : i));

            AsyncStorage.setItem('cart', JSON.stringify(newItems));
            return { items: newItems };
        });
    },

    removeFromCart: (id) => {
        set((state) => {
            const newItems = state.items.filter((i) => i.id !== id);
            AsyncStorage.setItem('cart', JSON.stringify(newItems));
            return { items: newItems };
        });
    },

    clearCart: () => {
        AsyncStorage.removeItem('cart');
        set({ items: [] });
    },

    getTotal: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
    },

    getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
    },

    loadCart: async () => {
        try {
            const cartData = await AsyncStorage.getItem('cart');
            if (cartData) {
                set({ items: JSON.parse(cartData) });
            }
        } catch (error) {
            console.error('Error loading cart:', error);
        }
    },
}));
