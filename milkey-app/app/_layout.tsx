import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { usePendingSubscriptionSync } from '@/hooks/usePendingSubscriptionSync';
import { useTheme } from '@/hooks/useTheme';

export default function RootLayout() {
  useFrameworkReady();
  usePushNotifications();
  usePendingSubscriptionSync();
  const { isDark } = useTheme();

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
          <Stack.Screen name="withdraw" />
          <Stack.Screen name="cart" />
          <Stack.Screen name="feedback" />
          <Stack.Screen name="subscriptions" />
          <Stack.Screen name="print-settings" />
          <Stack.Screen name="balance-report" />
          <Stack.Screen name="selling-payment-slip" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </>
    </SafeAreaProvider>
  );
}
