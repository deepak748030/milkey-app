import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { BlurTargetView } from 'expo-blur';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Home, Droplets, Store, Package, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import UpdateModal from '@/components/UpdateModal';
import CollectionBottomSheet from '@/components/CollectionBottomSheet';
import SellingBottomSheet from '@/components/SellingBottomSheet';
import { AdPopupModal } from '@/components/AdPopupModal';
import { checkAppVersion } from '@/lib/milkeyApi';
import { useSubTabStore } from '@/lib/subTabStore';
import { useTabSound } from '@/hooks/useTabSound';
import { consumeSuppressCollection, consumeSuppressSelling } from '@/lib/sheetSuppress';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState({ forceUpdate: false, message: '', storeLink: '', latestVersion: '1.0.0' });
  const [showCollectionSheet, setShowCollectionSheet] = useState(false);
  const [showSellingSheet, setShowSellingSheet] = useState(false);
  // Android: expo-blur can only blur a view inside the same window, so the tab
  // screens are wrapped in a BlurTargetView and its ref is handed to the sheets.
  const blurTargetRef = useRef<View | null>(null);
  const { purchaseTab, sellingTab, collectionTab, setPurchaseTab, setSellingTab, setCollectionTab, suppressCollectionSheet, suppressSellingSheet, setSuppressCollectionSheet, setSuppressSellingSheet } = useSubTabStore();
  const playTabSound = useTabSound();
  const activeTabName = segments[segments.length - 1] as string || '';
  const tabBarHeight = 65 + insets.bottom;
  // TopBar = insets.top+6 paddingTop + 42 logo + 12 paddingBottom ≈ insets.top+60, use 62 to keep header 100% clear
  const headerHeight = insets.top + 62;

  useEffect(() => {
    if (activeTabName === 'purchase') {
      if (consumeSuppressCollection()) return;
      if (suppressCollectionSheet) { setSuppressCollectionSheet(false); return; }
      const timer = setTimeout(() => setShowCollectionSheet(true), 150);
      return () => clearTimeout(timer);
    }
  }, [activeTabName, suppressCollectionSheet, setSuppressCollectionSheet]);
  useEffect(() => {
    if (activeTabName === 'selling') {
      if (consumeSuppressSelling()) return;
      if (suppressSellingSheet) { setSuppressSellingSheet(false); return; }
      const timer = setTimeout(() => setShowSellingSheet(true), 150);
      return () => clearTimeout(timer);
    }
  }, [activeTabName, suppressSellingSheet, setSuppressSellingSheet]);
  useEffect(() => {
    (async () => {
      try {
        const res = await checkAppVersion();
        if (res.success && res.response) {
          const v = res.response;
          const isForce = compareVersions(APP_VERSION, v.minVersion) < 0;
          const isOptional = compareVersions(APP_VERSION, v.latestVersion) < 0;
          if (isForce || isOptional) {
            const storeLink = Platform.OS === 'ios' ? (v.appStoreLink || v.playStoreLink) : (v.playStoreLink || v.appStoreLink);
            setUpdateInfo({ forceUpdate: isForce && v.forceUpdate, message: isForce ? v.forceUpdateMessage : v.updateMessage, storeLink: storeLink || '', latestVersion: v.latestVersion });
            setShowUpdate(true);
          }
        }
      } catch (e) { } // version check silent
    })();
  }, []);

  const handleCollectionSelect = useCallback((tab: any) => {
    // persist sheet selection so reopen shows same active (including Payment/Advances)
    // vibrate handled globally in app/_layout, no double
    setCollectionTab(tab as any);
    if (tab === 'RateSetting') {
      router.push('/milk-rate-settings' as any);
      return;
    }
    if (tab === 'Payment' || tab === 'Payments' || tab === 'Advances') {
      const target = tab === 'Payment' ? 'Payments' : 'Advances';
      router.push({ pathname: '/(tabs)/register', params: { tab: target } } as any);
      return;
    }
    if (tab === 'Farmer') { setPurchaseTab('Farmer' as any); return; }
    setPurchaseTab(tab);
  }, [setPurchaseTab, setCollectionTab, router]);

  const handleSellingSelect = useCallback((tab: any) => { setSellingTab(tab); }, [setSellingTab]);

  // Custom circle-style tab bar — active tab gets green circle like requested (Register removed)
  const renderTabBar = useCallback((props: any) => {
    const { state, descriptors, navigation } = props;
    // Totally remove Register from bottom bar — only 5 tabs visible
    const visibleRoutes = state.routes.filter((r: any) => {
      if (r.name === 'register') return false;
      const opts = descriptors[r.key]?.options;
      return opts?.href !== null;
    });

    return (
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
          height: tabBarHeight,
          elevation: 0,
          shadowOpacity: 0,
        }}
      >
        {visibleRoutes.map((route: any, idx: number) => {
          // Find actual index in state.routes for navigation
          const stateIndex = state.routes.findIndex((r: any) => r.key === route.key);
          const isFocused = state.index === stateIndex;
          const descriptor = descriptors[route.key];
          const options = descriptor?.options || {};

          // Label
          let label: string = options.title ?? route.name;
          // Icon mapping per route name
          let IconComp: any = Home;
          if (route.name === 'index') IconComp = Home;
          else if (route.name === 'purchase') IconComp = Droplets;
          else if (route.name === 'selling') IconComp = Store;
          else if (route.name === 'inventory') IconComp = Package;
          else if (route.name === 'profile') IconComp = User;

          const onPress = () => {
            // vibrate already via global capture in app/_layout, avoid double
            if (route.name === 'purchase' && isFocused) {
              setShowCollectionSheet(true);
              return;
            }
            if (route.name === 'selling' && isFocused) {
              setShowSellingSheet(true);
              return;
            }
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}
            >
              {/* Icon circle — active gets green circle (not pill) */}
              <View
                style={{
                  backgroundColor: isFocused ? colors.primary : 'transparent',
                  width: isFocused ? 38 : 32,
                  height: isFocused ? 38 : 32,
                  borderRadius: isFocused ? 19 : 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconComp
                  size={isFocused ? 20 : 22}
                  color={isFocused ? '#fff' : colors.mutedForeground}
                  strokeWidth={isFocused ? 2.6 : 2}
                  fill={isFocused && route.name === 'index' ? '#fff' : 'transparent'}
                />
              </View>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  fontWeight: isFocused ? '700' : '500',
                  color: isFocused ? colors.primary : colors.mutedForeground,
                  marginTop: 1,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }, [colors, insets.bottom, tabBarHeight]);

  return (
    <View style={{ flex: 1 }}>
      <UpdateModal visible={showUpdate} forceUpdate={updateInfo.forceUpdate} message={updateInfo.message} storeLink={updateInfo.storeLink} latestVersion={updateInfo.latestVersion} onSkip={() => setShowUpdate(false)} />
      <AdPopupModal />
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }} collapsable={false}>
        <Tabs
          tabBar={renderTabBar}
          screenOptions={{ headerShown: false, animation: 'shift', freezeOnBlur: true }}
        >
          <Tabs.Screen name="index" options={{ title: t.tabs.home }} />
          <Tabs.Screen name="purchase" options={{ title: t.tabs.purchase }} />
          <Tabs.Screen name="selling" options={{ title: t.tabs.selling }} />
          <Tabs.Screen name="inventory" options={{ title: t.tabs.inventory || 'Inventory' }} />
          <Tabs.Screen name="profile" options={{ title: t.tabs.profile }} />
          <Tabs.Screen name="register" options={{ href: null, headerShown: false }} />
        </Tabs>
      </BlurTargetView>
      <CollectionBottomSheet visible={showCollectionSheet} onClose={() => setShowCollectionSheet(false)} activeTab={collectionTab as any} onSelectTab={handleCollectionSelect} bottomOffset={tabBarHeight} topOffset={headerHeight} blurTarget={blurTargetRef} />
      <SellingBottomSheet visible={showSellingSheet} onClose={() => setShowSellingSheet(false)} activeTab={sellingTab} onSelectTab={handleSellingSelect} bottomOffset={tabBarHeight} topOffset={headerHeight} blurTarget={blurTargetRef} />
    </View>
  );
}
