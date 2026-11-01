import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useSubTabStore, PurchaseTab, SellingTab, RegisterTab } from '@/lib/subTabStore';

type SubTabBarProps = {
    screen: 'purchase' | 'selling' | 'register';
};

const PURCHASE_TABS: PurchaseTab[] = ['Purchase', 'Report', 'Farmer'];
const SELLING_TABS: SellingTab[] = ['Entry', 'Payment', 'Reports', 'Customer'];
const REGISTER_TABS: RegisterTab[] = ['Payments', 'Advances', 'Farmer'];

export default function SubTabBar({ screen }: SubTabBarProps) {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const {
        purchaseTab, sellingTab, registerTab,
        setPurchaseTab, setSellingTab, setRegisterTab,
    } = useSubTabStore();

    const [tabRowWidth, setTabRowWidth] = useState(0);

    let tabs: string[];
    let activeTab: string;
    let setActiveTab: (tab: string) => void;
    let labels: Record<string, string>;

    if (screen === 'purchase') {
        tabs = PURCHASE_TABS;
        activeTab = purchaseTab;
        setActiveTab = (tab) => setPurchaseTab(tab as PurchaseTab);
        labels = { Purchase: 'Purchase', Report: 'Report', Farmer: 'Farmer' };
    } else if (screen === 'selling') {
        tabs = SELLING_TABS;
        activeTab = sellingTab;
        setActiveTab = (tab) => setSellingTab(tab as SellingTab);
        labels = {
            Entry: t.selling?.entry || 'Entry',
            Payment: t.selling?.payment || 'Payment',
            Reports: t.selling?.reports || 'Reports',
            Customer: t.selling?.member || t.selling?.customer || 'Customer',
        };
    } else {
        tabs = REGISTER_TABS;
        activeTab = registerTab;
        setActiveTab = (tab) => setRegisterTab(tab as RegisterTab);
        labels = {
            Payments: t.register?.payments || 'Payments',
            Advances: t.register?.advances || 'Advances',
            'Farmer': 'Farmer',
        };
    }

    const activeIndex = tabs.indexOf(activeTab);
    const activeTabIndexAnim = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;

    useEffect(() => {
        const idx = tabs.indexOf(activeTab);
        if (idx >= 0) {
            Animated.spring(activeTabIndexAnim, {
                toValue: idx,
                useNativeDriver: false,
                damping: 16,
                stiffness: 180,
            }).start();
        }
    }, [activeTab]);

    const tabCount = tabs.length;
    const tabItemWidth = tabRowWidth > 0 ? (tabRowWidth - 8) / tabCount : 0;

    const tabIndicatorTranslateX = activeTabIndexAnim.interpolate({
        inputRange: tabs.map((_, i) => i),
        outputRange: tabs.map((_, i) => i * tabItemWidth),
    });

    const styles = createStyles(colors);

    return (
        <View style={styles.container}>
            <View
                style={styles.tabRow}
                onLayout={(event) => setTabRowWidth(event.nativeEvent.layout.width)}
            >
                {tabItemWidth > 0 && (
                    <Animated.View
                        style={[
                            styles.tabActiveIndicator,
                            {
                                width: tabItemWidth,
                                transform: [{ translateX: tabIndicatorTranslateX }],
                            },
                        ]}
                    />
                )}
                {tabs.map((tab) => (
                    <Pressable
                        key={tab}
                        style={styles.tab}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                            {labels[tab] || tab}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        paddingHorizontal: 6,
        paddingBottom: 0,
        backgroundColor: colors.background,
    },
    tabRow: {
        flexDirection: 'row',
        gap: 6,
        padding: 4,
        borderRadius: 10,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        position: 'relative',
        overflow: 'hidden',
    },
    tabActiveIndicator: {
        position: 'absolute',
        left: 4,
        top: 4,
        bottom: 4,
        borderRadius: 7,
        backgroundColor: colors.primary,
    },
    tab: {
        flex: 1,
        paddingVertical: 6,
        alignItems: 'center',
        borderRadius: 7,
        zIndex: 2,
    },
    tabText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.foreground,
    },
    tabTextActive: {
        color: colors.white,
    },
});
