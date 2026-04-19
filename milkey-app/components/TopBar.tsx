import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingCart, Bell, Sun, Moon, Bluetooth, BluetoothOff, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useCartStore } from '@/lib/cartStore';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import PrinterScanSheet from '@/components/PrinterScanSheet';
import { router } from 'expo-router';

export default function TopBar() {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { getItemCount, loadCart } = useCartStore();
  const [showPrinterSheet, setShowPrinterSheet] = useState(false);

  const {
    isScanning,
    isConnected,
    connectedDevice,
    availableDevices,
    error,
    isBluetoothEnabled,
    isPrinting,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
    printText,
    openBluetoothSettings,
  } = useBluetoothPrinter();

  useEffect(() => {
    loadCart();
  }, []);

  // When the user opens the printer sheet, auto-trigger a paired-device scan
  // so they immediately see their already-paired printer without tapping Scan.
  // Guard against double-scan if a scan is already in flight from app-init.
  useEffect(() => {
    if (showPrinterSheet && !isScanning) {
      const t = setTimeout(() => startScan(), 150);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPrinterSheet]);

  const itemCount = getItemCount();

  return (
    <>
      <View style={[
        styles.container,
        {
          paddingTop: insets.top + 4,
          backgroundColor: colors.background,
          borderBottomWidth: 2,
          borderBottomColor: colors.primary,
        }
      ]}>
        <View style={styles.leftSection}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Pressable onPress={() => setShowPrinterSheet(true)}>
            <Text style={[styles.appName, { color: colors.foreground }]}>Milkey</Text>
            <View style={styles.printerStatus}>
              {isPrinting ? (
                <>
                  <Bluetooth size={10} color={colors.primary} strokeWidth={2.5} />
                  <Text style={[styles.statusText, { color: colors.primary }]} numberOfLines={1}>
                    Printing...
                  </Text>
                </>
              ) : isConnected ? (
                <>
                  <Bluetooth size={10} color={colors.success} strokeWidth={2.5} />
                  <Text style={[styles.statusText, { color: colors.success }]} numberOfLines={1}>
                    {connectedDevice?.name || 'Printer Connected'}
                  </Text>
                </>
              ) : error ? (
                <>
                  <AlertCircle size={10} color={colors.destructive} strokeWidth={2.5} />
                  <Text style={[styles.statusText, { color: colors.destructive }]} numberOfLines={1}>
                    Printer error — tap to view
                  </Text>
                </>
              ) : (
                <>
                  <BluetoothOff size={10} color={colors.destructive} strokeWidth={2.5} />
                  <Text style={[styles.statusText, { color: colors.destructive }]}>Tap to connect printer</Text>
                </>
              )}
            </View>
          </Pressable>
        </View>

        <View style={styles.rightSection}>
          <Pressable
            style={[styles.iconButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={toggleTheme}
          >
            {isDark ? (
              <Sun size={18} color={colors.primary} strokeWidth={2.5} />
            ) : (
              <Moon size={18} color={colors.primary} strokeWidth={2.5} />
            )}
          </Pressable>
          <Pressable
            style={[styles.iconButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => router.push('/notifications')}
          >
            <Bell size={18} color={colors.foreground} strokeWidth={2} />
          </Pressable>
          <Pressable
            style={[styles.iconButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => router.push('/cart')}
          >
            <ShoppingCart size={18} color={colors.foreground} strokeWidth={2} />
            {itemCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.white }]}>{itemCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <PrinterScanSheet
        visible={showPrinterSheet}
        onClose={() => setShowPrinterSheet(false)}
        isScanning={isScanning}
        isConnected={isConnected}
        connectedDevice={connectedDevice}
        availableDevices={availableDevices}
        error={error}
        isBluetoothEnabled={isBluetoothEnabled}
        isPrinting={isPrinting}
        onStartScan={startScan}
        onStopScan={stopScan}
        onConnect={connectToDevice}
        onDisconnect={disconnectDevice}
        onPrintText={printText}
        onOpenBluetoothSettings={openBluetoothSettings}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 6,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
  },
  printerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
    maxWidth: 180,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    flexShrink: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
