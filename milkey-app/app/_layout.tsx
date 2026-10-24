import { Stack } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { StatusBar as RNStatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { usePendingSubscriptionSync } from '@/hooks/usePendingSubscriptionSync';
import { BluetoothPrinterProvider } from '@/hooks/useBluetoothPrinter';
import { useDeviceSync } from '@/hooks/useDeviceSync';
import { useTheme } from '@/hooks/useTheme';
import { vibrate } from '@/hooks/useTabSound';

function RootLayoutContent() {
  useFrameworkReady();
  usePushNotifications();
  usePendingSubscriptionSync();
  useDeviceSync();
  const theme = useTheme() as any;
  const colors = theme?.colors ?? { background: '#ffffff', card: '#ffffff', foreground: '#000', muted: '#f5f5f5', mutedForeground: '#666', border: '#e5e7eb', primary: '#14804a' };
  const isDark = !!theme?.isDark;

  const bg = (colors as any)?.background ?? '#ffffff';
  return (
    <View style={{ flex: 1, backgroundColor: bg }} onStartShouldSetResponderCapture={() => { vibrate(); return false; }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="calculator" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="help-support" />
        <Stack.Screen name="referral" />
        <Stack.Screen name="withdraw" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="feedback" />
        <Stack.Screen name="subscriptions" />
        <Stack.Screen name="print-settings" />
        <Stack.Screen name="milk-rate-settings" />
        <Stack.Screen name="balance-report" />
        <Stack.Screen name="selling-payment-slip" />
        <Stack.Screen name="devices" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="+not-found" />
      </Stack>
      {/* Status bar matches app theme (light #FFFFFF white / dark #000000 black) */}
      <RNStatusBar backgroundColor={bg} barStyle={isDark ? 'light-content' : 'dark-content'} translucent={false} />
      <ExpoStatusBar style={isDark ? 'light' : 'dark'} backgroundColor={bg} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BluetoothPrinterProvider>
        <RootLayoutContent />
      </BluetoothPrinterProvider>
    </SafeAreaProvider>
  );
}
