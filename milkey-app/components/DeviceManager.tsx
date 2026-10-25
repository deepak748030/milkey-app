import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, RefreshControl, Modal } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { Smartphone, LogOut, ShieldCheck, ShieldAlert, Monitor, Clock, Info, RefreshCcw, Phone } from 'lucide-react-native';
import { devicesApi, DeviceInfo } from '@/lib/milkeyApi';
import { getStableDeviceId, getDeviceMeta, registerCurrentDevice, relativeTime } from '@/lib/device';
import { useAuth } from '@/hooks/useAuth';

function PlatformIcon({ platform, active, colors }: { platform: string; active: boolean; colors: any }) {
  const p = (platform || '').toLowerCase();
  const col = active ? colors.primary : colors.mutedForeground;
  if (p === 'ios') return <Smartphone size={18} color={col} />;
  if (p === 'android') return <Smartphone size={18} color={col} />;
  if (p === 'web') return <Monitor size={18} color={col} />;
  return <Smartphone size={18} color={col} />;
}

export default function DeviceManager() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [list, setList] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [currentId, setCurrentId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<DeviceInfo | null>(null);

  const fetchDevices = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setErrorMsg(null);
    try {
      const cid = await getStableDeviceId();
      setCurrentId(cid);
      const res = await devicesApi.list(cid);
      if (res.success && res.response) {
        // API returns DeviceInfo[] directly as response
        const arr = Array.isArray(res.response) ? res.response : [];
        setList(arr as any);
      } else {
        // If backend doesn't have endpoint (Vercel old deploy), show friendly message
        if (res.message && /not found/i.test(res.message)) {
          setErrorMsg('Device service not yet deployed on this server. Update server-clone deployment to enable it.');
        } else {
          setErrorMsg(res.message || 'Failed to load devices');
        }
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const doRegister = useCallback(async () => {
    setRegistering(true);
    try {
      await registerCurrentDevice();
      await fetchDevices(false);
    } finally { setRegistering(false); }
  }, [fetchDevices]);

  useEffect(() => { fetchDevices(true); }, [fetchDevices]);

  const logoutDevice = (d: DeviceInfo) => {
    const isCurrent = d.deviceId === currentId || d.isCurrent;
    Alert.alert(
      isCurrent ? 'Logout this device?' : 'Logout device?',
      isCurrent ? 'You will be logged out on this device and need to login again.' : `${d.deviceName || d.deviceId} will be logged out remotely.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout', style: 'destructive', onPress: async () => {
            const r = await devicesApi.logoutDevice(d._id);
            if (!r.success) Alert.alert('Failed', r.message || 'Could not logout device');
            fetchDevices(false);
          }
        }
      ]
    );
  };

  const logoutOthers = () => {
    const othersActive = list.filter(d => d.isActive && d.deviceId !== currentId && !d.isCurrent);
    if (othersActive.length === 0) {
      Alert.alert('No other active devices', 'Only this device is currently active.');
      return;
    }
    Alert.alert('Logout other devices?', `Log out ${othersActive.length} other active device(s)? They will need to login again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout others', style: 'destructive', onPress: async () => {
          const r = await devicesApi.logoutOthers(currentId);
          if (!r.success) Alert.alert('Failed', r.message || 'Error');
          fetchDevices(false);
        }
      }
    ]);
  };

  const s = createStyles(colors);
  const activeCount = list.filter(d => d.isActive).length;

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[s.muted, { marginTop: 10 }]}>Loading devices…</Text>
      </View>
    );
  }

  return (
    <View style={[s.wrap, { backgroundColor: colors.background }]}>
      {/* Header info card */}
      <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.infoHeader}>
          <View style={[s.shieldBox, { backgroundColor: colors.primary + '14' }]}>
            <ShieldCheck size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: colors.foreground }]}>Sessions & Devices</Text>
            <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
              {activeCount} active · Max 3 active (oldest auto logs out) · Tap card for details
            </Text>
          </View>
          <Pressable onPress={logoutOthers} style={[s.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <LogOut size={14} color={colors.foreground} />
            <Text style={[s.secondaryText, { color: colors.foreground }]}>Logout others</Text>
          </Pressable>
        </View>
        {errorMsg ? (
          <View style={[s.errorBox, { backgroundColor: colors.destructive + '10', borderColor: colors.destructive + '30' }]}>
            <ShieldAlert size={14} color={colors.destructive} />
            <Text style={[s.errorText, { color: colors.destructive }]}>{errorMsg}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDevices(false); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {list.map((d) => {
          const isCurrent = d.deviceId === currentId || (d as any).isCurrent;
          const active = !!d.isActive;
          return (
            <Pressable key={d._id} onPress={() => setDetail(d)} style={[s.card, { backgroundColor: colors.card, borderColor: isCurrent ? colors.primary + '40' : colors.border }, !active && { opacity: 0.88 }]}>
              <View style={[s.iconBox, { backgroundColor: active ? colors.primary + '14' : colors.muted }]}>
                <PlatformIcon platform={d.platform} active={active} colors={colors} />
              </View>

              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={[s.name, { color: colors.foreground }]} numberOfLines={1}>
                    {user?.name || d.deviceName || d.modelName || 'Company'}
                  </Text>
                  {isCurrent && <View style={[s.badge, { backgroundColor: colors.primary }]}><Text style={s.badgeText}>This device</Text></View>}
                  {!active && <View style={[s.badge, { backgroundColor: colors.mutedForeground }]}><Text style={s.badgeText}>Logged out</Text></View>}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 1 }}>
                  <View style={s.metaRow}>
                    <Clock size={11} color={colors.mutedForeground} />
                    <Text style={[s.metaSmall, { color: active ? colors.primary : colors.mutedForeground }]}>
                      {active ? 'Active ' : 'Last '}· {relativeTime(d.lastActive)}
                    </Text>
                  </View>
                  {user?.phone ? (
                    <View style={s.metaRow}>
                      <Phone size={11} color={colors.mutedForeground} />
                      <Text style={[s.metaSmall, { color: colors.mutedForeground }]} numberOfLines={1}>{user.phone}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <Pressable onPress={() => logoutDevice(d)} style={[s.logoutBtn, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <LogOut size={15} color={active ? colors.destructive : colors.mutedForeground} />
              </Pressable>
              <Pressable onPress={() => setDetail(d)} style={[s.infoBtn, { backgroundColor: colors.secondary }]}>
                <Info size={14} color={colors.foreground} />
              </Pressable>
            </Pressable>
          );
        })}

        {list.length === 0 && !errorMsg && (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Smartphone size={28} color={colors.mutedForeground} />
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No devices yet</Text>
            <Text style={[s.emptySub, { color: colors.mutedForeground }]}>Your current device will appear here automatically after login. Tap refresh to register manually.</Text>
          </View>
        )}

        <View style={s.hintBox}>
          <Text style={[s.hintText, { color: colors.mutedForeground }]}>Security: every login creates a device session tagged with deviceId + IP. Up to 3 active devices allowed. Revoking a device forces it to re-login on next request.</Text>
        </View>
      </ScrollView>

      <Pressable onPress={doRegister} style={[s.primaryBtn, { backgroundColor: colors.primary }]}>
        {registering ? <ActivityIndicator color="#fff" /> : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <RefreshCcw size={16} color="#fff" />
            <Text style={s.primaryText}>Refresh & register this device</Text>
          </View>
        )}
      </Pressable>

      {/* Detail modal */}
      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <View style={s.modalBackdrop}>
          <Pressable style={s.modalBackdropPress} onPress={() => setDetail(null)} />
          <View style={[s.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Device details</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setDetail(null)} style={[s.closeBtn, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={{ color: colors.foreground, fontWeight: '700' }}>✕</Text>
              </Pressable>
            </View>
            {detail && (
              <View style={{ gap: 10, marginTop: 12 }}>
                <Row label="Company" value={user?.name || detail.deviceName || 'Company'} colors={colors} />
                <Row label="Owner" value={user?.name || '—'} colors={colors} />
                <Row label="Mobile" value={user?.phone || '—'} colors={colors} />
                <Row label="Last active" value={detail.lastActive ? new Date(detail.lastActive).toLocaleString() : '—'} colors={colors} />
                <Row label="Status" value={detail.isActive ? 'Active' : 'Logged out'} colors={colors} />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable onPress={() => { if (detail) logoutDevice(detail); setDetail(null); }} style={[s.secondaryBtn, { flex: 1, justifyContent: 'center', borderColor: colors.destructive + '40', backgroundColor: colors.destructive + '10' }]}>
                    <LogOut size={14} color={colors.destructive} />
                    <Text style={[s.secondaryText, { color: colors.destructive }]}>Logout this</Text>
                  </Pressable>
                  <Pressable onPress={() => setDetail(null)} style={[s.primaryBtn, { flex: 1, backgroundColor: colors.primary, height: 42, marginTop: 0 }]}>
                    <Text style={s.primaryText}>Close</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Text style={{ width: 92, fontSize: 12, fontWeight: '600', color: colors.mutedForeground }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 12, color: colors.foreground, lineHeight: 16 }}>{value}</Text>
    </View>
  );
}

const createStyles = (c: any) => StyleSheet.create({
  wrap: { flex: 1, padding: 12, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 13, color: c.mutedForeground, textAlign: 'center' },
  infoCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shieldBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800' },
  subtitle: { fontSize: 11, marginTop: 2, lineHeight: 14 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  secondaryText: { fontSize: 12, fontWeight: '700' },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  meta: { fontSize: 11, lineHeight: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaSmall: { fontSize: 11, fontWeight: '600' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  logoutBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  infoBtn: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 18, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
  emptySub: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
  hintBox: { paddingHorizontal: 4, paddingTop: 4 },
  hintText: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  modalBackdropPress: { flex: 1 },
  modalCard: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 16, paddingBottom: 22, maxHeight: '86%' },
  modalTitle: { fontSize: 15, fontWeight: '800' },
  closeBtn: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
