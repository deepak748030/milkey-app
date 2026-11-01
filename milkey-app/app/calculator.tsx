import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, History as HistoryIcon, RotateCcw, Calculator, Droplets, Beaker, Gauge, IndianRupee, Trash2, Share2 } from 'lucide-react-native';
import { milkCalc } from '@/lib/milk-calc';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CALC_PRIMARY = '#14804a';
const CALC_PRIMARY_SOFT = '#eef7f0';
const HISTORY_KEY = 'milkey_milk_history';

type HistoryItem = {
  id: string;
  qty: string;
  fat: string;
  clr: string;
  rate: string;
  snf: number;
  fatKg: number;
  snfKg: number;
  avgRate: number;
  amount: number;
  perQuintal: number;
  date: string;
};

const sanitize = (raw: string) => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const [head, ...rest] = cleaned.split('.');
  const joined = rest.length ? `${head}.${rest.join('')}` : head;
  const [whole, frac] = joined.split('.');
  return frac && frac.length > 2 ? `${whole}.${frac.slice(0, 2)}` : joined;
};

const InputBox = memo(function InputBox({
  label,
  value,
  placeholder,
  fieldKey,
  focusedKey,
  onChange,
  onFocus,
  onBlur,
  colors,
  styles,
}: {
  label: string;
  value: string;
  placeholder: string;
  fieldKey: string;
  focusedKey: string | null;
  onChange: (v: string) => void;
  onFocus: (k: string) => void;
  onBlur: () => void;
  colors: any;
  styles: any;
}) {
  const isFocused = focusedKey === fieldKey;
  return (
    <View style={[styles.inputBox, isFocused && styles.inputBoxFocused]} pointerEvents="auto">
      <Text style={[styles.inputLabel, isFocused && styles.inputLabelFocused]}>{label}</Text>
      <View style={styles.divider} />
      <TextInput
        value={value}
        onChangeText={(t) => onChange(sanitize(t))}
        onFocus={() => onFocus(fieldKey)}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
        style={styles.input}
        selectionColor={CALC_PRIMARY}
        returnKeyType="next"
        blurOnSubmit={false}
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        underlineColorAndroid="transparent"
      />
    </View>
  );
});

export default function CalculatorScreen() {
  const { colors, isDark } = useTheme();
  const { language } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHi = language === 'hi';
  const isMr = (language as string) === 'mr';

  const [qty, setQty] = useState('');
  const [fat, setFat] = useState('');
  const [clr, setClr] = useState('');
  const [rate, setRate] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const tTitle = isHi ? 'दूध कैलकुलेटर' : isMr ? 'दूध कॅल्क्युलेटर' : 'Milk calculator';
  const tQty = 'QTY';
  const tFat = 'FAT';
  const tClr = 'CLR';
  const tRate = 'RATE';
  const tReset = isHi ? 'रीसेट' : 'Reset';
  const tCalculate = isHi ? 'गणना करें' : isMr ? 'गणना करा' : 'Calculate';
  const pQty = isHi ? 'जैसे 25' : 'Eg. 25';
  const pFat = isHi ? 'जैसे 4.5' : 'Eg. 4.5';
  const pClr = isHi ? 'जैसे 25.5' : 'Eg. 25.5';
  const pRate = isHi ? '4550 या 7' : '4550 or 7';
  const msgAll = isHi ? 'कृपया सभी मान भरें' : isMr ? 'कृपया सर्व मूल्ये भरा' : 'Please enter all values';
  const msgAdded = isHi ? 'हिस्ट्री में जुड़ गया' : isMr ? 'इतिहासात जोडले' : 'Added to history';

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed: HistoryItem[] = JSON.parse(raw);
        const migrated = parsed.map((it: any) => {
          if (it.snf === undefined) {
            const r = milkCalc({ qty: parseFloat(it.qty) || 0, fat: parseFloat(it.fat) || 0, clr: parseFloat(it.clr) || 0, rate: parseFloat(it.rate) || 0 });
            return { ...it, snf: r.snf, fatKg: r.fatKg, snfKg: r.snfKg, avgRate: r.avgRate };
          }
          return it;
        });
        setHistory(migrated);
      } else setHistory([]);
    } catch {}
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    setQty(item.qty); setFat(item.fat); setClr(item.clr); setRate(item.rate);
  }, []);

  const clearHistory = useCallback(async () => {
    await AsyncStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }, []);

  const handleDeleteItem = useCallback(async (id: string) => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      const arr: HistoryItem[] = raw ? JSON.parse(raw) : [];
      const next = arr.filter((it) => it.id !== id);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      setHistory(next);
    } catch {}
  }, []);

  const handleShareHistory = useCallback(async () => {
    if (history.length === 0) return;
    const totalQty = history.reduce((a, b) => a + (parseFloat(b.qty) || 0), 0);
    const totalFatKg = history.reduce((a, b) => a + (b.fatKg || 0), 0);
    const totalSnfKg = history.reduce((a, b) => a + (b.snfKg || 0), 0);
    const totalAmt = history.reduce((a, b) => a + (b.amount || 0), 0);
    let msg = `MILKEY - Milk Calculator History\n\n`;
    history.forEach((it, idx) => {
      msg += `${idx + 1}. QTY- ${it.qty} | FAT- ${it.fat} | CLR- ${it.clr} | RATE- ${it.rate} | FAT Kg- ${it.fatKg.toFixed(2)} | SNF Kg- ${it.snfKg.toFixed(2)} | Amount- ${it.amount.toFixed(1)}\n`;
    });
    msg += `\nTotal:\nQTY - ${totalQty.toFixed(1)} Kg\nFAT Kg - ${totalFatKg.toFixed(2)} Kg\nSNF Kg - ${totalSnfKg.toFixed(2)} Kg\nAmount - ₹${totalAmt.toFixed(1)}`;
    try { const { Share } = await import('react-native'); await Share.share({ message: msg }); } catch {}
  }, [history]);

  const handleReset = useCallback(() => {
    setQty(''); setFat(''); setClr(''); setRate(''); setFocused(null);
  }, []);

  const handleCalculate = useCallback(async () => {
    if (!qty || !fat || !clr || !rate) { showToast(msgAll); return; }
    try {
      const r = milkCalc({ qty: parseFloat(qty) || 0, fat: parseFloat(fat) || 0, clr: parseFloat(clr) || 0, rate: parseFloat(rate) || 0 });
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      const arr: HistoryItem[] = raw ? JSON.parse(raw) : [];
      const newItem: HistoryItem = {
        id: Date.now().toString(), qty, fat, clr, rate,
        snf: r.snf, fatKg: r.fatKg, snfKg: r.snfKg, avgRate: r.avgRate, amount: r.amount, perQuintal: r.perQuintal,
        date: new Date().toLocaleString(),
      };
      const next = [newItem, ...arr].slice(0, 30);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      setHistory(next);
      setQty(''); setFat(''); setClr(''); setRate(''); setFocused(null);
      showToast(msgAdded);
    } catch {}
  }, [qty, fat, clr, rate, msgAll, msgAdded, showToast]);

  const onFocus = useCallback((k: string) => setFocused(k), []);
  const onBlur = useCallback(() => setFocused(null), []);
  const styles = createStyles(colors, isDark, insets);
  const onQtyChange = useCallback((v: string) => setQty(v), []);
  const onFatChange = useCallback((v: string) => setFat(v), []);
  const onClrChange = useCallback((v: string) => setClr(v), []);
  const onRateChange = useCallback((v: string) => setRate(v), []);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>{tTitle}</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="none" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={false}>
        <View style={styles.grid}>
          <InputBox label={tQty} value={qty} placeholder={pQty} fieldKey="qty" focusedKey={focused} onChange={onQtyChange} onFocus={onFocus} onBlur={onBlur} colors={colors} styles={styles} />
          <InputBox label={tFat} value={fat} placeholder={pFat} fieldKey="fat" focusedKey={focused} onChange={onFatChange} onFocus={onFocus} onBlur={onBlur} colors={colors} styles={styles} />
          <InputBox label={tClr} value={clr} placeholder={pClr} fieldKey="clr" focusedKey={focused} onChange={onClrChange} onFocus={onFocus} onBlur={onBlur} colors={colors} styles={styles} />
          <InputBox label={tRate} value={rate} placeholder={pRate} fieldKey="rate" focusedKey={focused} onChange={onRateChange} onFocus={onFocus} onBlur={onBlur} colors={colors} styles={styles} />
        </View>

        <View style={styles.actionsRow}>
          <Pressable onPress={handleReset} style={styles.btnSecondary}>
            <RotateCcw size={14} color={colors.foreground} />
            <Text style={styles.btnSecondaryText}>{tReset}</Text>
          </Pressable>
          <Pressable onPress={handleCalculate} style={styles.btnPrimary}>
            <Calculator size={14} color="#fff" />
            <Text style={styles.btnPrimaryText}>{tCalculate}</Text>
          </Pressable>
        </View>

        {/* Premium History — clean, no nested box, each entry is a premium card */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <View style={styles.historyTitleRow}>
              <View style={styles.historyIconWrap}>
                <HistoryIcon size={12} color="#fff" />
              </View>
              <Text style={styles.historyTitle}>{isHi ? 'हाल की गणनाएँ' : 'History'}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{history.length}</Text>
              </View>
            </View>
            {history.length > 0 && (
              <Pressable onPress={clearHistory} style={styles.clearBtn} hitSlop={8}>
                <Trash2 size={12} color="#ef4444" />
                <Text style={styles.clearText}>{isHi ? 'साफ करें' : 'Clear'}</Text>
              </Pressable>
            )}
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <HistoryIcon size={18} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>{isHi ? 'कोई हिस्ट्री नहीं' : 'No calculations yet'}</Text>
              <Text style={styles.emptySub}>{isHi ? '4 बॉक्स भरके Calculate दबाएँ' : 'Fill 4 boxes and tap Calculate'}</Text>
            </View>
          ) : (
            <>
              {/* Total of History — compact header above list like second image */}
              {(() => {
                const totalQty = history.reduce((a, b) => a + (parseFloat(b.qty) || 0), 0);
                const totalFatKg = history.reduce((a, b) => a + (b.fatKg || 0), 0);
                const totalSnfKg = history.reduce((a, b) => a + (b.snfKg || 0), 0);
                const totalAmt = history.reduce((a, b) => a + (b.amount || 0), 0);
                return (
                  <View style={styles.totalCard}>
                    <View style={styles.totalHeaderRow}>
                      <Text style={styles.totalTitle}>Total ({history.length})</Text>
                      <Pressable onPress={handleShareHistory} style={styles.totalShareBtn} hitSlop={8}>
                        <Share2 size={12} color={CALC_PRIMARY} />
                        <Text style={styles.totalShareText}>Share</Text>
                      </Pressable>
                    </View>
                    <View style={styles.totalGrid}>
                      <View style={styles.totalCell}><Text style={styles.totalLabel}>QTY</Text><Text style={styles.totalVal}>{totalQty.toFixed(1)} Kg</Text></View>
                      <View style={styles.totalCell}><Text style={styles.totalLabel}>FAT Kg</Text><Text style={styles.totalVal}>{totalFatKg.toFixed(2)} Kg</Text></View>
                      <View style={styles.totalCell}><Text style={styles.totalLabel}>SNF Kg</Text><Text style={styles.totalVal}>{totalSnfKg.toFixed(2)} Kg</Text></View>
                      <View style={styles.totalCell}><Text style={styles.totalLabel}>Amount</Text><Text style={[styles.totalVal, styles.totalValAmount]}>₹{totalAmt.toFixed(1)}</Text></View>
                    </View>
                  </View>
                );
              })()}
              <View style={styles.historyList}>
              {history.map((item) => (
                <Pressable key={item.id} onPress={() => handleHistorySelect(item)} style={styles.hCardCompact}>
                  <View style={styles.hAccent} />
                  <View style={styles.hTop}>
                    <Text style={styles.hDate} numberOfLines={1}>{item.date}</Text>
                    <View style={styles.hAmountPill}>
                      <IndianRupee size={9} color="#fff" />
                      <Text style={styles.hAmountText}>₹{(item.amount ?? 0).toFixed(2)}</Text>
                    </View>
                    <Pressable onPress={() => handleDeleteItem(item.id)} hitSlop={8} style={styles.hDelete}>
                      <Trash2 size={14} color="#9ca3af" />
                    </Pressable>
                  </View>
                  <View style={styles.hChips}>
                    <View style={styles.hChip}><Text style={styles.hChipLabel}>QTY</Text><Text style={styles.hChipVal}>{item.qty} L</Text></View>
                    <View style={styles.hChip}><Text style={styles.hChipLabel}>FAT</Text><Text style={styles.hChipVal}>{item.fat}</Text></View>
                    <View style={styles.hChip}><Text style={styles.hChipLabel}>CLR</Text><Text style={styles.hChipVal}>{item.clr}</Text></View>
                    <View style={styles.hChip}><Text style={styles.hChipLabel}>RATE</Text><Text style={styles.hChipVal}>₹{item.perQuintal?.toFixed(0)}</Text></View>
                  </View>
                  <View style={styles.hResultGrid}>
                    <View style={styles.hResultCell}>
                      <View style={styles.hResultIcon}><Droplets size={9} color={CALC_PRIMARY} /></View>
                      <Text style={styles.hResultLabel}>SNF</Text>
                      <Text style={styles.hResultVal}>{(item.snf ?? 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.hResultDiv} />
                    <View style={styles.hResultCell}>
                      <View style={styles.hResultIcon}><Beaker size={9} color={CALC_PRIMARY} /></View>
                      <Text style={styles.hResultLabel}>FAT kg</Text>
                      <Text style={styles.hResultVal}>{(item.fatKg ?? 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.hResultDiv} />
                    <View style={styles.hResultCell}>
                      <View style={styles.hResultIcon}><Beaker size={9} color={CALC_PRIMARY} /></View>
                      <Text style={styles.hResultLabel}>SNF kg</Text>
                      <Text style={styles.hResultVal}>{(item.snfKg ?? 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.hResultDiv} />
                    <View style={styles.hResultCell}>
                      <View style={styles.hResultIcon}><Gauge size={9} color={CALC_PRIMARY} /></View>
                      <Text style={styles.hResultLabel}>Avg Rate</Text>
                      <Text style={styles.hResultVal}>₹{(item.avgRate ?? 0).toFixed(2)}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
              </View>
            </>
          )}
        </View>

        {toast ? <View style={styles.toastWrap}><Text style={styles.toastText}>{toast}</Text></View> : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: insets.top + 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 15, fontWeight: '800', color: colors.foreground },
  topSpacer: { width: 36 },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 24, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  inputBox: { width: '48.5%', height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  inputBoxFocused: { borderColor: CALC_PRIMARY, backgroundColor: CALC_PRIMARY_SOFT },
  inputLabel: { fontSize: 13, fontWeight: '800', color: colors.mutedForeground, minWidth: 36 },
  inputLabelFocused: { color: CALC_PRIMARY },
  divider: { width: 1, height: 22, backgroundColor: colors.border },
  input: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.foreground, paddingVertical: 4 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  btnSecondary: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnSecondaryText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  btnPrimary: { flex: 1, height: 44, borderRadius: 10, backgroundColor: CALC_PRIMARY, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnPrimaryText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  historySection: { gap: 10, marginTop: 2 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: CALC_PRIMARY, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: 13, fontWeight: '800', color: colors.foreground },
  countBadge: { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  countText: { fontSize: 10, fontWeight: '700', color: colors.mutedForeground },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', backgroundColor: isDark ? '#3f1a22' : '#fef2f2' },
  clearText: { fontSize: 11, fontWeight: '700', color: '#ef4444' },

  emptyCard: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12, backgroundColor: colors.card, gap: 6 },
  emptyIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  emptyTitle: { fontSize: 12, fontWeight: '700', color: colors.foreground },
  emptySub: { fontSize: 11, color: colors.mutedForeground, fontWeight: '500', textAlign: 'center' },

  historyList: { gap: 6 },
  // compact — half height vs previous (padding 12→7, gaps halved)
  hCardCompact: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 7, overflow: 'hidden', gap: 4 },
  hAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: CALC_PRIMARY },
  hTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  hDate: { fontSize: 9, color: colors.mutedForeground, fontWeight: '500', flex: 1, marginRight: 6 },
  hAmountPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: CALC_PRIMARY, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  hAmountText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  hDelete: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: colors.muted, marginLeft: 4 },
  hChips: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  hChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7 },
  hChipLabel: { fontSize: 8, fontWeight: '800', color: colors.mutedForeground, letterSpacing: 0.3 },
  hChipVal: { fontSize: 10, fontWeight: '700', color: colors.foreground },
  hResultGrid: { flexDirection: 'row', backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
  hResultCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 1 },
  hResultIcon: { width: 14, height: 14, borderRadius: 7, backgroundColor: `${CALC_PRIMARY}14`, alignItems: 'center', justifyContent: 'center' },
  hResultLabel: { fontSize: 8, fontWeight: '700', color: colors.mutedForeground, textAlign: 'center' },
  hResultVal: { fontSize: 10, fontWeight: '800', color: colors.foreground, textAlign: 'center' },
  hResultDiv: { width: 1, backgroundColor: colors.border },
  // total header above history — like second image (QTY, FAT Kg, SNF Kg, Amount)
  totalCard: { backgroundColor: isDark ? '#0f2e1a' : '#eef7f0', borderWidth: 1, borderColor: isDark ? '#14532d' : '#bbf7d0', borderRadius: 10, padding: 8, gap: 6 },
  totalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalTitle: { fontSize: 11, fontWeight: '800', color: CALC_PRIMARY, letterSpacing: 0.3 },
  totalShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  totalShareText: { fontSize: 10, fontWeight: '700', color: CALC_PRIMARY },
  totalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  totalCell: { flex: 1, minWidth: '46%', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, gap: 2 },
  totalLabel: { fontSize: 9, fontWeight: '700', color: colors.mutedForeground },
  totalVal: { fontSize: 12, fontWeight: '800', color: colors.foreground },
  totalValAmount: { color: CALC_PRIMARY },

  toastWrap: { backgroundColor: isDark ? '#1f2937' : '#111827', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignSelf: 'center', marginTop: 4 },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
