import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
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
  // Pending 150ms auto-open timers. A quick second tap on the tab must win over the
  // scheduled open, otherwise the sheet would pop back up right after being closed.
  const collectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sellingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAutoOpen = useCallback(() => {
    if (collectionTimer.current) { clearTimeout(collectionTimer.current); collectionTimer.current = null; }
    if (sellingTimer.current) { clearTimeout(sellingTimer.current); sellingTimer.current = null; }
  }, []);
  const { purchaseTab, sellingTab, collectionTab, setPurchaseTab, setSellingTab, setCollectionTab, suppressCollectionSheet, suppressSellingSheet, setSuppressCollectionSheet, setSuppressSellingSheet } = useSubTabStore();
  const setCollectionSheetOpenFlag = useSubTabStore((st) => st.setCollectionSheetOpen);
  const setSellingSheetOpenFlag = useSubTabStore((st) => st.setSellingSheetOpen);
  // Mirror the sheet visibility into the shared store. The purchase / selling screens
  // read it to paint their own dark layer (<ScreenDim />) — a layer rendered inside the
  // screen is the only one that is really painted above the screen on Android.
  useEffect(() => { setCollectionSheetOpenFlag(showCollectionSheet); }, [showCollectionSheet, setCollectionSheetOpenFlag]);
  useEffect(() => { setSellingSheetOpenFlag(showSellingSheet); }, [showSellingSheet, setSellingSheetOpenFlag]);
  const playTabSound = useTabSound();
  const activeTabName = segments[segments.length - 1] as string || '';
  const tabBarHeight = 65 + insets.bottom;
  // TopBar = insets.top+6 paddingTop + 42 logo + 12 paddingBottom ≈ insets.top+60, use 62 to keep header 100% clear
  const headerHeight = insets.top + 62;

  useEffect(() => {
    if (activeTabName === 'purchase') {
      if (consumeSuppressCollection()) return;
      if (suppressCollectionSheet) { setSuppressCollectionSheet(false); return; }
      collectionTimer.current = setTimeout(() => { collectionTimer.current = null; setShowCollectionSheet(true); }, 150);
      return () => { if (collectionTimer.current) { clearTimeout(collectionTimer.current); collectionTimer.current = null; } };
    }
  }, [activeTabName, suppressCollectionSheet, setSuppressCollectionSheet]);
  useEffect(() => {
    if (activeTabName === 'selling') {
      if (consumeSuppressSelling()) return;
      if (suppressSellingSheet) { setSuppressSellingSheet(false); return; }
      sellingTimer.current = setTimeout(() => { sellingTimer.current = null; setShowSellingSheet(true); }, 150);
      return () => { if (sellingTimer.current) { clearTimeout(sellingTimer.current); sellingTimer.current = null; } };
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
            // Haptics come from HapticPressable (this is a Pressable), no manual vibrate.
            // Toggle: first tap opens the sheet, tapping the SAME tab again closes it.
            // Earlier it only ever called setShow...(true), so the sheet felt "permanent"
            // until you tapped outside / on a row.
            if (route.name === 'purchase' && isFocused) {
              cancelAutoOpen();
              setShowSellingSheet(false);
              setShowCollectionSheet((v) => !v);
              return;
            }
            if (route.name === 'selling' && isFocused) {
              cancelAutoOpen();
              setShowCollectionSheet(false);
              setShowSellingSheet((v) => !v);
              return;
            }
            // Leaving to another tab: drop any open sheet so it never lingers on return.
            cancelAutoOpen();
            setShowCollectionSheet(false);
            setShowSellingSheet(false);
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
  }, [colors, insets.bottom, tabBarHeight, cancelAutoOpen]);

  return (
    <View style={{ flex: 1 }}>
      <UpdateModal visible={showUpdate} forceUpdate={updateInfo.forceUpdate} message={updateInfo.message} storeLink={updateInfo.storeLink} latestVersion={updateInfo.latestVersion} onSkip={() => setShowUpdate(false)} />
      <AdPopupModal />
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
      {/* Absolute stage: floating sheets live here so <Tabs> always keeps its full
          height (a normal sibling would squeeze the tab bar up into the screen). */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, elevation: 50 }}
      >
        <CollectionBottomSheet visible={showCollectionSheet} onClose={() => setShowCollectionSheet(false)} activeTab={collectionTab as any} onSelectTab={handleCollectionSelect} bottomOffset={tabBarHeight} topOffset={headerHeight} />
        <SellingBottomSheet visible={showSellingSheet} onClose={() => setShowSellingSheet(false)} activeTab={sellingTab} onSelectTab={handleSellingSelect} bottomOffset={tabBarHeight} topOffset={headerHeight} />
      </View>
    </View>
  );
}
