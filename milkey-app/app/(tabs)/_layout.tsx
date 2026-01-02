import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function RootLayout() {
  useFrameworkReady();

  // Initialize push notifications with deep linking support
  usePushNotifications();

  return (
    <SafeAreaProvider>
      <>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="help-support" />
          <Stack.Screen name="referral" />
          <Stack.Screen name="cart" />
          <Stack.Screen name="feedback" />
          <Stack.Screen name="subscriptions" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </>
    </SafeAreaProvider>
  );
}
