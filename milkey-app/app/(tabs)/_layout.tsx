import React, { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, Droplets, Store, ClipboardList, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import SubTabBar from '@/components/SubTabBar';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import UpdateModal from '@/components/UpdateModal';
import { checkAppVersion } from '@/lib/milkeyApi';
import Constants from 'expo-constants';

const SUB_TAB_SCREENS = ['purchase', 'selling', 'register'] as const;
type SubTabScreen = typeof SUB_TAB_SCREENS[number];

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

function CustomTabBar(props: any) {
  const routeName = props.state.routes[props.state.index]?.name;
  const isSubTabScreen = SUB_TAB_SCREENS.includes(routeName as SubTabScreen);

  return (
    <View>
      {isSubTabScreen && (
        <SubTabBar screen={routeName as SubTabScreen} />
      )}
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [showUpdate, setShowUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState({
    forceUpdate: false,
    message: '',
    storeLink: '',
    latestVersion: '1.0.0',
  });

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
            setUpdateInfo({
              forceUpdate: isForce && v.forceUpdate,
              message: isForce ? v.forceUpdateMessage : v.updateMessage,
              storeLink: storeLink || '',
              latestVersion: v.latestVersion,
            });
            setShowUpdate(true);
          }
        }
      } catch (e) { console.log('Version check failed', e); }
    })();
  }, []);

  return (
    <>
      <UpdateModal
        visible={showUpdate}
        forceUpdate={updateInfo.forceUpdate}
        message={updateInfo.message}
        storeLink={updateInfo.storeLink}
        latestVersion={updateInfo.latestVersion}
        onSkip={() => setShowUpdate(false)}
      />
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: 65 + insets.bottom,
            paddingBottom: insets.bottom + 6,
            paddingTop: 6,
            elevation: 0,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t.tabs.home,
            tabBarIcon: ({ color, focused }) => (
              <Home
                size={focused ? 26 : 22}
                color={color}
                strokeWidth={focused ? 2.8 : 2}
                fill={focused ? color : 'transparent'}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="purchase"
          options={{
            title: t.tabs.purchase,
            tabBarIcon: ({ color, focused }) => (
              <Droplets
                size={focused ? 26 : 22}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
                fill={focused ? color : 'transparent'}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="selling"
          options={{
            title: t.tabs.selling,
            tabBarIcon: ({ color, focused }) => (
              <Store
                size={focused ? 26 : 22}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="register"
          options={{
            title: t.tabs.register,
            tabBarIcon: ({ color, focused }) => (
              <ClipboardList
                size={focused ? 26 : 22}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t.tabs.profile,
            tabBarIcon: ({ color, focused }) => (
              <User
                size={focused ? 26 : 22}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            ),
          }}
        />
      </Tabs>
    </>
  );
}