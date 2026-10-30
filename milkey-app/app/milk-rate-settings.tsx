import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { milkRateSettingsApi, MilkRateSettingsDoc, purchaseFarmersApi } from '@/lib/milkeyApi';

type Expanded = 'fatSnf' | 'fixed' | 'fat' | 'advanceRate' | 'bonus' | null;

function useDebouncedSave(fn: () => void, delay = 600) {
  const t = useRef<any>(null);
  return useCallback(() => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(fn, delay);
  }, [fn, delay]);
}

export default function MilkRateSettingsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const s = makeStyles(colors, isDark);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Expanded>('fatSnf');

  // form state — Advance Rate added, Rate Chart screen untouched
  const [fatSnfRate, setFatSnfRate] = useState('');
  const [fixedBuffalo, setFixedBuffalo] = useState('');
  const [fixedCow, setFixedCow] = useState('');
  const [fatRateBuffalo, setFatRateBuffalo] = useState('');
  const [fatRateCow, setFatRateCow] = useState('');
  const [advanceMin, setAdvanceMin] = useState('');
  const [advanceMax, setAdvanceMax] = useState('');
  const [bonusType, setBonusType] = useState<'perLitre' | 'percent'>('perLitre');
  const [bonusPerLitre, setBonusPerLitre] = useState('');
  const [bonusPercent, setBonusPercent] = useState('');

  // members count banners
  const [counts, setCounts] = useState<{ rate: number; fat: number; fatSnf: number } | null>(null);

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
          setFatSnfRate(fatSnfVal ? String(fatSnfVal) : '');
          setFixedBuffalo(d.fixedRate?.buffalo ? String(d.fixedRate.buffalo) : '');
          setFixedCow(d.fixedRate?.cow ? String(d.fixedRate.cow) : '');
          setFatRateBuffalo(d.fatRate?.buffalo ? String(d.fatRate.buffalo) : '');
          setFatRateCow(d.fatRate?.cow ? String(d.fatRate.cow) : '');
          setAdvanceMin((d as any).advanceRate?.min ? String((d as any).advanceRate.min) : '');
          setAdvanceMax((d as any).advanceRate?.max ? String((d as any).advanceRate.max) : '');
          setBonusType(d.bonus?.type || 'perLitre');
          setBonusPerLitre(d.bonus?.perLitre ? String(d.bonus.perLitre) : '');
          setBonusPercent(d.bonus?.percent ? String(d.bonus.percent) : '');
        }
        if (!cancelled && farmersRes.success) {
          const arr: any[] = (farmersRes.response as any)?.data || (farmersRes.response as any) || [];
          const rate = arr.filter((f) => (f.priceBasis || 'rate') === 'rate').length;
          const fat = arr.filter((f) => f.priceBasis === 'fat').length;
          const fatSnf = arr.filter((f) => f.priceBasis === 'fat_snf').length;
          setCounts({ rate, fat, fatSnf });
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const fatSnfNum = parseFloat(fatSnfRate) || 0;
      await milkRateSettingsApi.update({
        fatSnfRate: { buffalo: fatSnfNum, cow: fatSnfNum, baseLabel: '65/90' } as any,
        fixedRate: { buffalo: parseFloat(fixedBuffalo) || 0, cow: parseFloat(fixedCow) || 0 },
        fatRate: { buffalo: parseFloat(fatRateBuffalo) || 0, cow: parseFloat(fatRateCow) || 0 },
        advanceRate: { min: parseFloat(advanceMin) || 0, max: parseFloat(advanceMax) || 0 } as any,
        bonus: { type: bonusType, perLitre: parseFloat(bonusPerLitre) || 0, percent: parseFloat(bonusPercent) || 0 } as any,
      } as any);
    } catch {}
    setSaving(false);
  }, [fatSnfRate, fixedBuffalo, fixedCow, fatRateBuffalo, fatRateCow, advanceMin, advanceMax, bonusType, bonusPerLitre, bonusPercent]);

  const debouncedSave = useDebouncedSave(save, 700);

  const onChange = (setter: (v: string) => void) => (text: string) => {
    if (text === '' || /^\d*\.?\d*$/.test(text)) setter(text);
    debouncedSave();
  };

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
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
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
                <TextInput value={fatSnfRate} onChangeText={onChange(setFatSnfRate)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
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
                <TextInput value={fixedBuffalo} onChangeText={onChange(setFixedBuffalo)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
              </View>
              <View style={[s.tableCell, s.inputCell]}>
                <TextInput value={fixedCow} onChangeText={onChange(setFixedCow)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
              </View>
            </View>
          </View>
          <View style={s.banner}><Text style={s.bannerText}>{counts ? `${counts.rate} members will change` : '— members will change'}</Text></View>
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
                <TextInput value={fatRateBuffalo} onChangeText={onChange(setFatRateBuffalo)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
              </View>
              <View style={[s.tableCell, s.inputCell]}>
                <TextInput value={fatRateCow} onChangeText={onChange(setFatRateCow)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
              </View>
            </View>
          </View>
          <View style={s.banner}><Text style={s.bannerText}>{counts ? `${counts.fat} members will change` : '— members will change'}</Text></View>
        </CollapsibleCard>

        {/* 4. Advance Rate — Minimum & Maximum (like 55 rate) */}
        <CollapsibleCard title="Advance Rate" subtitle={expanded === 'advanceRate' ? '(₹)' : undefined} expanded={expanded === 'advanceRate'} onToggle={() => toggle('advanceRate')} colors={colors} isDark={isDark}>
          <View style={s.greenTable}>
            <View style={s.tableHeaderRow}>
              <View style={[s.tableCell, s.tableHeaderCell]}><Text style={s.headerCellText}>Minimum</Text></View>
              <View style={[s.tableCell, s.tableHeaderCell]}><Text style={s.headerCellText}>Maximum</Text></View>
            </View>
            <View style={s.tableRow}>
              <View style={[s.tableCell, s.inputCell]}>
                <TextInput value={advanceMin} onChangeText={onChange(setAdvanceMin)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
              </View>
              <View style={[s.tableCell, s.inputCell]}>
                <TextInput value={advanceMax} onChangeText={onChange(setAdvanceMax)} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor="#9AA0A6" style={s.input} />
              </View>
            </View>
          </View>
          <Text style={s.helper}>Advance Min/Max — 0 means no limit. Existing functionality same.</Text>
        </CollapsibleCard>

        {/* 5. Bonus — Fix qty bonus, Amount percent bonus */}
        <CollapsibleCard title="Bonus" expanded={expanded === 'bonus'} onToggle={() => toggle('bonus')} colors={colors} isDark={isDark}>
          <View style={s.bonusTabs}>
            <Pressable onPress={() => { setBonusType('perLitre'); debouncedSave(); }} style={[s.bonusTab, bonusType === 'perLitre' && s.bonusTabActive]}>
              <Text style={[s.bonusTabText, bonusType === 'perLitre' && s.bonusTabTextActive]}>Fix qty bonus (₹/L)</Text>
            </Pressable>
            <Pressable onPress={() => { setBonusType('percent'); debouncedSave(); }} style={[s.bonusTab, bonusType === 'percent' && s.bonusTabActive]}>
              <Text style={[s.bonusTabText, bonusType === 'percent' && s.bonusTabTextActive]}>Amount percent bonus (%)</Text>
            </Pressable>
          </View>
          <View style={s.greenTable}>
            <View style={s.tableRow}>
              <View style={[s.tableCell, s.inputCell, { flex: 1 }]}>
                <TextInput
                  value={bonusType === 'perLitre' ? bonusPerLitre : bonusPercent}
                  onChangeText={bonusType === 'perLitre' ? onChange(setBonusPerLitre) : onChange(setBonusPercent)}
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
