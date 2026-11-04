import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
// Expo Router 57 keeps this hook in its navigation core but no longer re-exports it.
import { usePreventRemove } from 'expo-router/build/react-navigation/core/usePreventRemove';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { milkRateSettingsApi, MilkRateSettingsDoc, purchaseFarmersApi } from '@/lib/milkeyApi';

type Expanded = 'fatSnf' | 'fixed' | 'fat' | 'bonus' | null;
type RateSettingsForm = {
  fatSnfRate: string;
  fixedBuffalo: string;
  fixedCow: string;
  fatRateBuffalo: string;
  fatRateCow: string;
  bonusType: 'perLitre' | 'percent';
  bonusPerLitre: string;
  bonusPercent: string;
};
type RateSettingsTextField = Exclude<keyof RateSettingsForm, 'bonusType'>;

const EMPTY_FORM: RateSettingsForm = {
  fatSnfRate: '',
  fixedBuffalo: '',
  fixedCow: '',
  fatRateBuffalo: '',
  fatRateCow: '',
  bonusType: 'perLitre',
  bonusPerLitre: '',
  bonusPercent: '',
};

const toRateNumber = (value: string) => parseFloat(value) || 0;
const toUpdatePayload = (values: RateSettingsForm) => ({
  fatSnfRate: { buffalo: toRateNumber(values.fatSnfRate), cow: toRateNumber(values.fatSnfRate), baseLabel: '65/90' },
  fixedRate: { buffalo: toRateNumber(values.fixedBuffalo), cow: toRateNumber(values.fixedCow) },
  fatRate: { buffalo: toRateNumber(values.fatRateBuffalo), cow: toRateNumber(values.fatRateCow) },
  bonus: { type: values.bonusType, perLitre: toRateNumber(values.bonusPerLitre), percent: toRateNumber(values.bonusPercent) },
});

export default function MilkRateSettingsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const s = makeStyles(colors, isDark);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Expanded>('fatSnf');

  // form state
  const [fatSnfRate, setFatSnfRate] = useState('');
  const [fixedBuffalo, setFixedBuffalo] = useState('');
  const [fixedCow, setFixedCow] = useState('');
  const [fatRateBuffalo, setFatRateBuffalo] = useState('');
  const [fatRateCow, setFatRateCow] = useState('');
  const [bonusType, setBonusType] = useState<'perLitre' | 'percent'>('perLitre');
  const [bonusPerLitre, setBonusPerLitre] = useState('');
  const [bonusPercent, setBonusPercent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [leaving, setLeaving] = useState(false);

  const formRef = useRef<RateSettingsForm>({ ...EMPTY_FORM });
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);
  const changeVersionRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const leavingRef = useRef(false);
  const pendingRemovalActionRef = useRef<any>(null);
  const [resumeRemovalKey, setResumeRemovalKey] = useState(0);
  const navigation = useNavigation();

  // members count banners
  const [counts, setCounts] = useState<{ rate: number; fat: number; fatSnf: number } | null>(null);

  const saveLatest = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!hydratedRef.current) return true;

    // Serialize saves. If another edit arrives while a request is in flight, send
    // the latest ref snapshot after it completes so an older request cannot win.
    while (dirtyRef.current) {
      if (inFlightRef.current) {
        const previousSaveSucceeded = await inFlightRef.current;
        if (!previousSaveSucceeded) return false;
        continue;
      }

      const version = changeVersionRef.current;
      const request = (async () => {
        try {
          const result = await milkRateSettingsApi.update(toUpdatePayload({ ...formRef.current }));
          if (!result.success) throw new Error(result.message || 'Unable to save rate settings.');
          return true;
        } catch (error) {
          setSaveError(error instanceof Error ? error.message : 'Unable to save rate settings.');
          return false;
        }
      })();
      inFlightRef.current = request;
      setSaving(true);
      const succeeded = await request;
      if (inFlightRef.current === request) inFlightRef.current = null;
      setSaving(!!inFlightRef.current);

      if (!succeeded) {
        dirtyRef.current = true;
        setHasUnsavedChanges(true);
        return false;
      }
      if (changeVersionRef.current === version) {
        dirtyRef.current = false;
        setHasUnsavedChanges(false);
        setSaveError('');
      }
    }
    return true;
  }, []);

  const scheduleSave = useCallback(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveLatest();
    }, 700);
  }, [saveLatest]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    changeVersionRef.current += 1;
    setHasUnsavedChanges(true);
    setSaveError('');
  }, []);

  const onChange = (key: RateSettingsTextField, setter: (value: string) => void) => (text: string) => {
    if (leavingRef.current || (text !== '' && !/^\d*\.?\d*$/.test(text))) return;
    formRef.current = { ...formRef.current, [key]: text };
    setter(text);
    markDirty();
    scheduleSave();
  };

  const selectBonusType = (type: 'perLitre' | 'percent') => {
    if (leavingRef.current || formRef.current.bonusType === type) return;
    formRef.current = { ...formRef.current, bonusType: type };
    setBonusType(type);
    markDirty();
    scheduleSave();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settingsRes, farmersRes] = await Promise.all([
          milkRateSettingsApi.get(),
          purchaseFarmersApi.getAll({ limit: 200 }),
        ]);
        if (!cancelled && settingsRes.success && settingsRes.response) {
          const d = settingsRes.response as MilkRateSettingsDoc;
          // Fat SNF: single value — use buffalo if present, else cow, or 65/90 label's value
          const fatSnfVal = (d as any).fatSnfRate?.buffalo || (d as any).fatSnfRate?.cow || (d as any).fatSnfRate?.value || 0;
          const values: RateSettingsForm = {
            fatSnfRate: fatSnfVal ? String(fatSnfVal) : '',
            fixedBuffalo: d.fixedRate?.buffalo ? String(d.fixedRate.buffalo) : '',
            fixedCow: d.fixedRate?.cow ? String(d.fixedRate.cow) : '',
            fatRateBuffalo: d.fatRate?.buffalo ? String(d.fatRate.buffalo) : '',
            fatRateCow: d.fatRate?.cow ? String(d.fatRate.cow) : '',
            bonusType: d.bonus?.type || 'perLitre',
            bonusPerLitre: d.bonus?.perLitre ? String(d.bonus.perLitre) : '',
            bonusPercent: d.bonus?.percent ? String(d.bonus.percent) : '',
          };
          formRef.current = values;
          setFatSnfRate(values.fatSnfRate);
          setFixedBuffalo(values.fixedBuffalo);
          setFixedCow(values.fixedCow);
          setFatRateBuffalo(values.fatRateBuffalo);
          setFatRateCow(values.fatRateCow);
          setBonusType(values.bonusType);
          setBonusPerLitre(values.bonusPerLitre);
          setBonusPercent(values.bonusPercent);
        }
        if (!cancelled && farmersRes.success) {
          const arr: any[] = (farmersRes.response as any)?.data || (farmersRes.response as any) || [];
          const rate = arr.filter((f) => (f.priceBasis || 'rate') === 'rate').length;
          const fat = arr.filter((f) => f.priceBasis === 'fat').length;
          const fatSnf = arr.filter((f) => f.priceBasis === 'fat_snf').length;
          setCounts({ rate, fat, fatSnf });
        }
      } catch {}
      if (!cancelled) {
        hydratedRef.current = true;
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  usePreventRemove(hasUnsavedChanges, ({ data }) => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    void saveLatest().then((saved) => {
      if (!saved) {
        leavingRef.current = false;
        setLeaving(false);
        return;
      }
      pendingRemovalActionRef.current = data.action;
      setResumeRemovalKey((key) => key + 1);
    });
  });

  useEffect(() => {
    if (resumeRemovalKey === 0) return;
    const action = pendingRemovalActionRef.current;
    if (!action) return;
    pendingRemovalActionRef.current = null;
    // Let the successful save clear the prevent-remove guard before replaying the
    // original back action. This also makes a single Android back tap sufficient.
    const timer = setTimeout(() => navigation.dispatch(action), 0);
    return () => clearTimeout(timer);
  }, [resumeRemovalKey, navigation]);

  const toggle = (k: Expanded) => setExpanded((prev) => (prev === k ? null : k));

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>Loading rate settings…</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: '#F2F2F2' }]}>
      <View style={[s.header, { paddingTop: insets.top + 6, backgroundColor: '#0E7A2B' }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8} disabled={leaving}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>Milk rate settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {saving && (
          <View style={[s.savingPill, { backgroundColor: '#fff', borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Saving…</Text>
          </View>
        )}
        {saveError ? (
          <Text style={{ color: '#B91C1C', fontSize: 12, textAlign: 'center' }}>
            Save failed: {saveError}. Tap Back to retry.
          </Text>
        ) : null}

        {/* 1. FAT + SNF Rate Chart — single value, NO Cow/Buffalo */}
        <CollapsibleCard
          title="Fat SNF — Rate Chart"
          subtitle={expanded === 'fatSnf' ? '(₹/litre)' : undefined}
          expanded={expanded === 'fatSnf'}
          onToggle={() => toggle('fatSnf')}
          colors={colors}
          isDark={isDark}
        >
          <View style={s.greenTable}>
            <View style={s.tableRow}>
              <View style={[s.tableCell, s.rowLabelCell]}><Text style={s.rowLabelText}>65/90</Text></View>
              <View style={[s.tableCell, s.inputCell, { flex: 1 }]}>
                <TextInput value={fatSnfRate} onChangeText={onChange('fatSnfRate', setFatSnfRate)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
              </View>
            </View>
          </View>
          <Text style={s.helper}>Single chart rate for Fat + SNF. No Cow/Buffalo split.</Text>
          {counts && counts.fatSnf > 0 && (
            <View style={s.banner}><Text style={s.bannerText}>{counts.fatSnf} members will change</Text></View>
          )}
        </CollapsibleCard>

        {/* 2. Fixed Rate — Cow, Buffalo */}
        <CollapsibleCard title="Fix Rate" subtitle={expanded === 'fixed' ? '(₹/litre)' : undefined} expanded={expanded === 'fixed'} onToggle={() => toggle('fixed')} colors={colors} isDark={isDark}>
          <View style={s.greenTable}>
            <View style={s.tableHeaderRow}>
              <View style={[s.tableCell, s.tableHeaderCell]}><Text style={s.headerCellText}>🐃 Buffalo</Text></View>
              <View style={[s.tableCell, s.tableHeaderCell]}><Text style={s.headerCellText}>🐄 Cow</Text></View>
            </View>
            <View style={s.tableRow}>
              <View style={[s.tableCell, s.inputCell]}>
                <TextInput value={fixedBuffalo} onChangeText={onChange('fixedBuffalo', setFixedBuffalo)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
              </View>
              <View style={[s.tableCell, s.inputCell]}>
                <TextInput value={fixedCow} onChangeText={onChange('fixedCow', setFixedCow)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
              </View>
            </View>
          </View>
          <View style={s.banner}><Text style={s.bannerText}>{counts ? `${counts.rate} members will change` : '— members will change'}</Text></View>
          <Text style={s.helper}>Khaali chhode to purchase me rate blank rahega. Member ka apna rate ho to wahi pehle use hoga.</Text>
        </CollapsibleCard>

        {/* 3. FAT Rate — Cow, Buffalo */}
        <CollapsibleCard title="Fat Rate" subtitle={expanded === 'fat' ? 'per point' : undefined} expanded={expanded === 'fat'} onToggle={() => toggle('fat')} colors={colors} isDark={isDark}>
          <View style={s.greenTable}>
            <View style={s.tableHeaderRow}>
              <View style={[s.tableCell, s.tableHeaderCell]}><Text style={s.headerCellText}>🐃 Buffalo</Text></View>
              <View style={[s.tableCell, s.tableHeaderCell]}><Text style={s.headerCellText}>🐄 Cow</Text></View>
            </View>
            <View style={s.tableRow}>
              <View style={[s.tableCell, s.inputCell]}>
                <TextInput value={fatRateBuffalo} onChangeText={onChange('fatRateBuffalo', setFatRateBuffalo)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
              </View>
              <View style={[s.tableCell, s.inputCell]}>
                <TextInput value={fatRateCow} onChangeText={onChange('fatRateCow', setFatRateCow)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
              </View>
            </View>
          </View>
          <View style={s.banner}><Text style={s.bannerText}>{counts ? `${counts.fat} members will change` : '— members will change'}</Text></View>
        </CollapsibleCard>

        {/* 4. Bonus — Fix qty bonus, Amount percent bonus */}
        <CollapsibleCard title="Bonus" expanded={expanded === 'bonus'} onToggle={() => toggle('bonus')} colors={colors} isDark={isDark}>
          <View style={s.bonusTabs}>
            <Pressable onPress={() => selectBonusType('perLitre')} style={[s.bonusTab, bonusType === 'perLitre' && s.bonusTabActive]}>
              <Text style={[s.bonusTabText, bonusType === 'perLitre' && s.bonusTabTextActive]}>Fix qty bonus (₹/L)</Text>
            </Pressable>
            <Pressable onPress={() => selectBonusType('percent')} style={[s.bonusTab, bonusType === 'percent' && s.bonusTabActive]}>
              <Text style={[s.bonusTabText, bonusType === 'percent' && s.bonusTabTextActive]}>Amount percent bonus (%)</Text>
            </Pressable>
          </View>
          <View style={s.greenTable}>
            <View style={s.tableRow}>
              <View style={[s.tableCell, s.inputCell, { flex: 1 }]}>
                <TextInput
                  value={bonusType === 'perLitre' ? bonusPerLitre : bonusPercent}
                  onChangeText={bonusType === 'perLitre' ? onChange('bonusPerLitre', setBonusPerLitre) : onChange('bonusPercent', setBonusPercent)}
                  keyboardType="decimal-pad"
                  placeholder="₹"
                  placeholderTextColor="#9AA0A6"
                  style={s.input}
                />
              </View>
            </View>
          </View>
          <Text style={s.helper}>Added on top of calculated rate.</Text>
        </CollapsibleCard>

        <View style={s.footerNote}>
          <Text style={s.footerNoteText}>Tip: Rates auto-save. Fix Rate = priceBasis “rate”, Fat Rate = “fat”, Fat SNF Rate = “fat_snf”. Change a farmer’s basis in Farmer tab.</Text>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function CollapsibleCard({ title, subtitle, expanded, onToggle, children, colors, isDark }: { title: string; subtitle?: string; expanded: boolean; onToggle: () => void; children: React.ReactNode; colors: any; isDark: boolean }) {
  const s = makeStyles(colors, isDark);
  return (
    <View style={[s.card, expanded && s.cardExpanded]}>
      <Pressable onPress={onToggle} style={[s.cardHeader, expanded && s.cardHeaderExpanded]}>
        <Text style={s.cardTitle}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {subtitle ? <Text style={s.cardSub}>{subtitle}</Text> : null}
          {expanded ? <ChevronUp size={18} color="#0E7A2B" /> : <ChevronDown size={18} color="#6B7280" />}
        </View>
      </Pressable>
      {expanded && <View style={s.cardBody}>{children}</View>}
    </View>
  );
}

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
    backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '800' },
    scrollContent: { padding: 12, gap: 12 },
    savingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 1 },

    card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
    cardExpanded: { borderColor: '#E5E7EB' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#fff' },
    cardHeaderExpanded: { backgroundColor: '#F8F9FA', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
    cardSub: { fontSize: 12, color: '#6B7280', marginRight: 2 },
    cardBody: { padding: 12, gap: 10, backgroundColor: '#fff' },

    greenTable: { borderWidth: 1.5, borderColor: '#0E7A2B', borderRadius: 12, overflow: 'hidden' },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: '#E8F5E9' },
    tableRow: { flexDirection: 'row', borderTopWidth: 1.5, borderTopColor: '#0E7A2B', backgroundColor: '#fff' },
    tableCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: '#0E7A2B' },
    tableCellLabel: { flex: 0.7, backgroundColor: '#F3F4F6' },
    tableHeaderCell: { backgroundColor: '#E8F5E9' },
    headerCellText: { fontSize: 13, fontWeight: '700', color: '#0E7A2B' },
    rowLabelCell: { backgroundColor: '#E8F5E9', flex: 0.7 },
    rowLabelText: { fontSize: 13, fontWeight: '700', color: '#0E7A2B' },
    inputCell: { backgroundColor: '#fff' },
    input: { width: '100%', textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#111827', paddingVertical: 2 },

    moreOptions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
    moreOptionsText: { fontSize: 13, fontWeight: '600', color: '#0E7A2B' },

    banner: { backgroundColor: '#FFF7D1', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 2 },
    bannerText: { fontSize: 12, fontWeight: '600', color: '#92400E' },

    bonusTabs: { flexDirection: 'row', borderWidth: 1, borderColor: '#0E7A2B', borderRadius: 12, overflow: 'hidden' },
    bonusTab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
    bonusTabActive: { backgroundColor: '#0E7A2B' },
    bonusTabText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
    bonusTabTextActive: { color: '#fff' },

    toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB', padding: 2, justifyContent: 'center' },
    toggleActive: { backgroundColor: '#0E7A2B' },
    toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: 'flex-start', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    toggleKnobActive: { alignSelf: 'flex-end' },

    helper: { fontSize: 11, color: '#6B7280', marginTop: 2 },
    footerNote: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12 },
    footerNoteText: { fontSize: 11, lineHeight: 15, color: '#6B7280' },
  });
}
