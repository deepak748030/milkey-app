import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import * as Notifications from 'expo-notifications';
import { addNotificationFromPush } from '@/lib/mockData';

export default function RootLayout() {
  useFrameworkReady();

  // Initialize push notifications with deep linking support
  usePushNotifications();

  // Request notification permission on app start and listen for incoming notifications
  useEffect(() => {
    // Listen for incoming notifications and save them
    const notificationSubscription = Notifications.addNotificationReceivedListener(notification => {
      const title = notification.request.content.title || 'New Notification';
      const body = notification.request.content.body || '';
      addNotificationFromPush(title, body);
    });

    return () => {
      notificationSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="event/[id]" />
          <Stack.Screen name="booking/[id]" />
          <Stack.Screen name="booking-details/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="search" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="transactions" />
          <Stack.Screen name="payment" />
          <Stack.Screen name="help-support" />
          <Stack.Screen name="privacy-policy" />
          <Stack.Screen name="referral" />
          <Stack.Screen name="cart" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </>
    </SafeAreaProvider>
  );
}