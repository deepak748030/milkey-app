import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
// Expo Router 57 keeps this hook in its navigation core but no longer re-exports it.
import { usePreventRemove } from 'expo-router/build/react-navigation/core/usePreventRemove';
import { ArrowLeft, ChevronDown, ChevronUp, Table as TableIcon, Milk, Percent, Gift, IndianRupee } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { milkRateSettingsApi, MilkRateSettingsDoc, purchaseFarmersApi } from '@/lib/milkeyApi';
import RateSettingModal from '@/components/RateSettingModal';

type Expanded = 'fatSnf' | 'fixed' | 'fat' | 'bonus' | null;
type RateSettingsForm = {
  fatSnfRate: string;
  fixedBuffalo: string;
  fixedCow: string;
  fatRateBuffalo: string;
  fatRateCow: string;
  bonusEnabled: boolean;
  bonusType: 'perLitre' | 'percent';
  bonusPerLitre: string;
  bonusPercent: string;
};
type RateSettingsTextField = Exclude<keyof RateSettingsForm, 'bonusType' | 'bonusEnabled'>;

const EMPTY_FORM: RateSettingsForm = {
  fatSnfRate: '',
  fixedBuffalo: '',
  fixedCow: '',
  fatRateBuffalo: '',
  fatRateCow: '',
  bonusEnabled: false,
  bonusType: 'perLitre',
  bonusPerLitre: '',
  bonusPercent: '',
};

const toRateNumber = (value: string) => parseFloat(value) || 0;
const toUpdatePayload = (values: RateSettingsForm) => ({
  fatSnfRate: { buffalo: toRateNumber(values.fatSnfRate), cow: toRateNumber(values.fatSnfRate), baseLabel: '65/90' },
  fixedRate: { buffalo: toRateNumber(values.fixedBuffalo), cow: toRateNumber(values.fixedCow) },
  fatRate: { buffalo: toRateNumber(values.fatRateBuffalo), cow: toRateNumber(values.fatRateCow) },
  bonus: { enabled: values.bonusEnabled, type: values.bonusType, perLitre: toRateNumber(values.bonusPerLitre), percent: toRateNumber(values.bonusPercent) },
});

export default function MilkRateSettingsScreen() {
  const { colors, isDark } = useTheme();
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
  const [bonusEnabled, setBonusEnabled] = useState(false);
  const [bonusType, setBonusType] = useState<'perLitre' | 'percent'>('perLitre');
  const [bonusPerLitre, setBonusPerLitre] = useState('');
  const [bonusPercent, setBonusPercent] = useState('');
  // Rate Chart (FAT x SNF grid) — same table the purchase screen used to show.
  const [showRateChart, setShowRateChart] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
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

  const onFieldFocus = (key: string) => setFocusedKey(key);
  const onFieldBlur = () => setFocusedKey(null);

  const toggleBonus = () => {
    if (leavingRef.current) return;
    const next = !formRef.current.bonusEnabled;
    formRef.current = { ...formRef.current, bonusEnabled: next };
    setBonusEnabled(next);
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
            bonusEnabled: !!(d.bonus as any)?.enabled,
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
          setBonusEnabled(values.bonusEnabled);
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
        <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 12 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8} disabled={leaving}>
          <ArrowLeft size={22} color={colors.foreground} />
        </Pressable>
        <Text style={s.headerTitle}>Rate Setting</Text>
        {saving ? (
          <View style={s.headerRight}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <View style={s.headerRight} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {saveError ? (
          <Text style={s.errorText}>Save failed: {saveError}. Tap Back to retry.</Text>
        ) : null}

        {/* 1. Fat SNF — Rate Chart */}
        <CollapsibleCard
          title="Fat SNF — Rate Chart"
          icon={<TableIcon size={15} color={colors.primary} />}
          expanded={expanded === 'fatSnf'}
          onToggle={() => toggle('fatSnf')}
          colors={colors}
        >
          {counts && counts.fatSnf > 0 ? (
            <Text style={s.note}>{counts.fatSnf} members · Rate Chart</Text>
          ) : null}
          <Pressable onPress={() => setShowRateChart(true)} style={s.ghostBtn}>
            <TableIcon size={15} color={colors.primary} />
            <Text style={s.ghostBtnText}>View Rate Chart</Text>
          </Pressable>
        </CollapsibleCard>

        {/* 2. Fix Rate */}
        <CollapsibleCard
          title="Fix Rate"
          subtitle={expanded === 'fixed' ? '₹/litre' : undefined}
          icon={<IndianRupee size={15} color={colors.primary} />}
          expanded={expanded === 'fixed'}
          onToggle={() => toggle('fixed')}
          colors={colors}
        >
          <View style={[s.inputBox, focusedKey === 'fixedBuffalo' && s.inputBoxFocused]}>
            <Text style={[s.inputBoxLabel, focusedKey === 'fixedBuffalo' && s.inputBoxLabelFocused]}>Buffalo</Text>
            <View style={s.inputDivider} />
            <TextInput
              value={fixedBuffalo}
              onChangeText={onChange('fixedBuffalo', setFixedBuffalo)}
              onFocus={() => onFieldFocus('fixedBuffalo')}
              onBlur={onFieldBlur}
              keyboardType="decimal-pad"
              placeholder="₹"
              placeholderTextColor={colors.mutedForeground}
              style={s.inputBoxField}
              underlineColorAndroid="transparent"
              selectionColor={colors.primary}
            />
          </View>
          <View style={[s.inputBox, focusedKey === 'fixedCow' && s.inputBoxFocused]}>
            <Text style={[s.inputBoxLabel, focusedKey === 'fixedCow' && s.inputBoxLabelFocused]}>Cow</Text>
            <View style={s.inputDivider} />
            <TextInput
              value={fixedCow}
              onChangeText={onChange('fixedCow', setFixedCow)}
              onFocus={() => onFieldFocus('fixedCow')}
              onBlur={onFieldBlur}
              keyboardType="decimal-pad"
              placeholder="₹"
              placeholderTextColor={colors.mutedForeground}
              style={s.inputBoxField}
              underlineColorAndroid="transparent"
              selectionColor={colors.primary}
            />
          </View>
          {counts ? <Text style={s.note}>{counts.rate} members · Fix Rate</Text> : null}
        </CollapsibleCard>

        {/* 3. Fat Rate */}
        <CollapsibleCard
          title="Fat Rate"
          subtitle={expanded === 'fat' ? 'per point' : undefined}
          icon={<Milk size={15} color={colors.primary} />}
          expanded={expanded === 'fat'}
          onToggle={() => toggle('fat')}
          colors={colors}
        >
          <View style={[s.inputBox, focusedKey === 'fatBuffalo' && s.inputBoxFocused]}>
            <Text style={[s.inputBoxLabel, focusedKey === 'fatBuffalo' && s.inputBoxLabelFocused]}>Buffalo</Text>
            <View style={s.inputDivider} />
            <TextInput
              value={fatRateBuffalo}
              onChangeText={onChange('fatRateBuffalo', setFatRateBuffalo)}
              onFocus={() => onFieldFocus('fatBuffalo')}
              onBlur={onFieldBlur}
              keyboardType="decimal-pad"
              placeholder="₹"
              placeholderTextColor={colors.mutedForeground}
              style={s.inputBoxField}
              underlineColorAndroid="transparent"
              selectionColor={colors.primary}
            />
          </View>
          <View style={[s.inputBox, focusedKey === 'fatCow' && s.inputBoxFocused]}>
            <Text style={[s.inputBoxLabel, focusedKey === 'fatCow' && s.inputBoxLabelFocused]}>Cow</Text>
            <View style={s.inputDivider} />
            <TextInput
              value={fatRateCow}
              onChangeText={onChange('fatRateCow', setFatRateCow)}
              onFocus={() => onFieldFocus('fatCow')}
              onBlur={onFieldBlur}
              keyboardType="decimal-pad"
              placeholder="₹"
              placeholderTextColor={colors.mutedForeground}
              style={s.inputBoxField}
              underlineColorAndroid="transparent"
              selectionColor={colors.primary}
            />
          </View>
          {counts ? <Text style={s.note}>{counts.fat} members · Fat Rate</Text> : null}
        </CollapsibleCard>

        {/* 4. Bonus */}
        <CollapsibleCard
          title="Bonus"
          subtitle={expanded === 'bonus' ? (bonusEnabled ? 'ON' : 'OFF') : undefined}
          icon={<Gift size={15} color={colors.primary} />}
          expanded={expanded === 'bonus'}
          onToggle={() => toggle('bonus')}
          colors={colors}
        >
          <View style={s.rowBetween}>
            <Text style={s.rowLabel}>Bonus</Text>
            <Pressable onPress={toggleBonus} style={[s.toggle, bonusEnabled && s.toggleActive]}>
              <View style={[s.toggleKnob, bonusEnabled && s.toggleKnobActive]} />
            </Pressable>
          </View>
          {bonusEnabled && (
            <>
              <View style={s.rowDivider} />
              <View style={s.segment}>
                <Pressable onPress={() => selectBonusType('perLitre')} style={[s.segmentItem, bonusType === 'perLitre' && s.segmentItemActive]}>
                  <Text style={[s.segmentText, bonusType === 'perLitre' && s.segmentTextActive]}>Per litre</Text>
                </Pressable>
                <Pressable onPress={() => selectBonusType('percent')} style={[s.segmentItem, bonusType === 'percent' && s.segmentItemActive]}>
                  <Percent size={13} color={bonusType === 'percent' ? '#fff' : colors.mutedForeground} />
                  <Text style={[s.segmentText, bonusType === 'percent' && s.segmentTextActive]}>Percent</Text>
                </Pressable>
              </View>
              <View style={[s.inputBox, focusedKey === 'bonus' && s.inputBoxFocused]}>
                <Text style={[s.inputBoxLabel, focusedKey === 'bonus' && s.inputBoxLabelFocused]}>
                  {bonusType === 'perLitre' ? '₹ / litre' : '% of amount'}
                </Text>
                <View style={s.inputDivider} />
                <TextInput
                  value={bonusType === 'perLitre' ? bonusPerLitre : bonusPercent}
                  onChangeText={bonusType === 'perLitre' ? onChange('bonusPerLitre', setBonusPerLitre) : onChange('bonusPercent', setBonusPercent)}
                  onFocus={() => onFieldFocus('bonus')}
                  onBlur={onFieldBlur}
                  keyboardType="decimal-pad"
                  placeholder={bonusType === 'perLitre' ? '₹' : '%'}
                  placeholderTextColor={colors.mutedForeground}
                  style={s.inputBoxField}
                  underlineColorAndroid="transparent"
                  selectionColor={colors.primary}
                />
              </View>
            </>
          )}
        </CollapsibleCard>

      </ScrollView>

      <RateSettingModal
        visible={showRateChart}
        onClose={() => setShowRateChart(false)}
      />
    </SafeAreaView>
  );
}

function CollapsibleCard({
  title, subtitle, icon, expanded, onToggle, children, colors,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  colors: any;
}) {
  const s = makeStyles(colors, false);
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable onPress={onToggle} style={s.cardHeader} hitSlop={4}>
        <View style={s.cardHeaderLeft}>
          {icon ? <View style={[s.cardIcon, { backgroundColor: colors.secondary }]}>{icon}</View> : null}
          <Text style={[s.cardTitle, { color: colors.foreground }]}>{title}</Text>
        </View>
        <View style={s.cardHeaderRight}>
          {subtitle ? <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
          {expanded
            ? <ChevronUp size={17} color={colors.mutedForeground} />
            : <ChevronDown size={17} color={colors.mutedForeground} />}
        </View>
      </Pressable>
      {expanded && (
        <View style={[s.cardBody, { borderTopColor: colors.border }]}>{children}</View>
      )}
    </View>
  );
}

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1 },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 6, paddingVertical: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { padding: 6 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: colors.foreground },
    headerRight: { width: 32, alignItems: 'flex-end', paddingRight: 6 },

    scrollContent: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 28, gap: 0 },
    errorText: { color: colors.destructive, fontSize: 12, textAlign: 'center', marginBottom: 2 },

    card: { borderRadius: 10, borderWidth: 1, overflow: 'hidden', marginBottom: 6 },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 10, paddingVertical: 13,
    },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 14, fontWeight: '700' },
    cardSub: { fontSize: 11, fontWeight: '600' },
    cardBody: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 10, borderTopWidth: 1, gap: 4 },

    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50 },
    rowLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
    // Calculator-style field: bordered box with label chip + left aligned value
    inputBox: {
      flexDirection: 'row', alignItems: 'center', height: 50,
      borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.card, paddingHorizontal: 12, marginTop: 4,
    },
    inputBoxFocused: { borderColor: colors.primary, backgroundColor: colors.secondary },
    inputBoxLabel: { minWidth: 62, fontSize: 12, fontWeight: '800', color: colors.mutedForeground },
    inputBoxLabelFocused: { color: colors.primary },
    inputDivider: { width: 1, height: 22, backgroundColor: colors.border, marginRight: 10 },
    inputBoxField: {
      flex: 1, textAlign: 'left', fontSize: 15, fontWeight: '700',
      color: colors.foreground, paddingVertical: 0, paddingLeft: 2,
    },
    note: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },

    ghostBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
      borderRadius: 9, height: 40, marginTop: 4,
    },
    ghostBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },

    segment: {
      flexDirection: 'row', backgroundColor: colors.muted,
      borderRadius: 9, padding: 3, gap: 3, marginTop: 2,
    },
    segmentItem: { flex: 1, height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 7 },
    segmentItemActive: { backgroundColor: colors.primary },
    segmentText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
    segmentTextActive: { color: '#fff' },

    toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.border, padding: 2, justifyContent: 'center' },
    toggleActive: { backgroundColor: colors.primary },
    toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: 'flex-start' },
    toggleKnobActive: { alignSelf: 'flex-end' },
  });
}
