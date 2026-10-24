import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingCart, Bell, Sun, Moon, Bluetooth, BluetoothOff, AlertCircle, User } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useCartStore } from '@/lib/cartStore';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import PrinterScanSheet from '@/components/PrinterScanSheet';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { printSettingsApi, PrintSettings } from '@/lib/milkeyApi';

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

  useEffect(() => {
    if (showPrinterSheet && !isScanning) {
      const t = setTimeout(() => startScan(), 500);
      return () => clearTimeout(t);
    }
  }, [showPrinterSheet]);

  const { user } = useAuth();
  const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
  useEffect(() => {
    printSettingsApi.get().then(res => {
      if (res.success && res.response) setPrintSettings(res.response);
    }).catch(() => {});
  }, []);

  const itemCount = getItemCount();
  const dairyName = (printSettings?.dairyName || user?.name || 'Dairy').trim() || 'Dairy';
  // header background same as profile card green (colors.primary)
  const headerBg = colors.primary;

  return (
    <>
      <StatusBar backgroundColor={headerBg} barStyle="light-content" translucent={false} />
      <View
        style={[
          styles.headerWrap,
          {
            paddingTop: insets.top + 6,
            backgroundColor: headerBg,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            marginBottom: 0,
            borderBottomWidth: 0,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.leftSection}>
            <View style={styles.avatarRing}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <User size={20} color="#fff" />
              )}
            </View>
            <Pressable onPress={() => setShowPrinterSheet(true)} style={styles.titleCol}>
              <Text style={styles.appName} numberOfLines={1}>{dairyName}</Text>
              <View style={styles.printerStatus}>
                {isPrinting ? (
                  <>
                    <Bluetooth size={9} color="#86EFAC" strokeWidth={2.5} />
                    <Text style={[styles.statusText, { color: '#86EFAC' }]} numberOfLines={1}>
                      Printing...
                    </Text>
                  </>
                ) : isConnected ? (
                  <>
                    <Bluetooth size={9} color="#86EFAC" strokeWidth={2.5} />
                    <Text style={[styles.statusText, { color: '#BBF7D0' }]} numberOfLines={1}>
                      Connected
                    </Text>
                  </>
                ) : error ? (
                  <>
                    <AlertCircle size={9} color="#FCA5A5" strokeWidth={2.5} />
                    <Text style={[styles.statusText, { color: '#FECACA' }]} numberOfLines={1}>
                      Printer error
                    </Text>
                  </>
                ) : (
                  <>
                    <BluetoothOff size={9} color="#FECACA" strokeWidth={2.5} />
                    <Text style={[styles.statusText, { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>
                      Tap to connect printer
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          </View>

          <View style={styles.rightSection}>
            <Pressable
              onPress={toggleTheme}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconPressed]}
            >
              {isDark ? (
                <Sun size={18} color="#fff" strokeWidth={2.2} />
              ) : (
                <Moon size={18} color="#fff" strokeWidth={2.2} />
              )}
            </Pressable>

            <Pressable
              onPress={() => router.push('/notifications')}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconPressed]}
            >
              <Bell size={18} color="#fff" strokeWidth={2} />
              {/* subtle dot if needed — keep clean for now */}
            </Pressable>

            <Pressable
              onPress={() => router.push('/cart')}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconPressed]}
            >
              <ShoppingCart size={18} color="#fff" strokeWidth={2} />
              {itemCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{itemCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
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
  headerWrap: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bottomAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  titleCol: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 165,
    paddingRight: 6,
  },
  appName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.15,
    lineHeight: 15,
    maxWidth: 160,
  },
  appSub: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
    marginTop: 1,
    letterSpacing: 0.3,
  },
  printerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    maxWidth: 170,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '600',
    flexShrink: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    position: 'relative',
  },
  iconBtnStatic: {
    borderWidth: 0,
  },
  iconPressed: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#0F3D1A',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
});
