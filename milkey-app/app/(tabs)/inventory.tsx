import React, { memo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import TopBar from '@/components/TopBar';
import { Package, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function InventoryScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const styles = createStyles(colors, isDark);
    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <TopBar title={t.tabs.inventory || 'Inventory'} />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <Package size={48} color={colors.primary} strokeWidth={1.5} />
                    </View>
                    <Text style={styles.title}>Inventory</Text>
                    <View style={styles.badge}>
                        <Clock size={14} color="#F59E0B" strokeWidth={2} />
                        <Text style={styles.badgeText}>Upcoming Soon</Text>
                    </View>
                    <Text style={styles.desc}>Inventory management is coming soon. You will be able to track stock, manage products and monitor inventory levels from here.</Text>
                </View>
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>What is coming?</Text>
                    <View style={styles.bulletRow}><View style={styles.dot} /><Text style={styles.bulletText}>Stock tracking & alerts</Text></View>
                    <View style={styles.bulletRow}><View style={styles.dot} /><Text style={styles.bulletText}>Product inventory management</Text></View>
                    <View style={styles.bulletRow}><View style={styles.dot} /><Text style={styles.bulletText}>Low stock notifications</Text></View>
                    <View style={styles.bulletRow}><View style={styles.dot} /><Text style={styles.bulletText}>Inventory reports</Text></View>
                </View>
            </ScrollView>
        </View>
    );
}
const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, padding: 16, justifyContent: 'center', minHeight: 500 },
    card: { backgroundColor: colors.card, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
    iconWrap: { width: 80, height: 80, borderRadius: 20, backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 24, fontWeight: '800', color: colors.foreground, marginBottom: 8 },
    badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
    badgeText: { fontSize: 13, fontWeight: '700', color: '#92400E' },
    desc: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
    infoCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
    infoTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
    bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    bulletText: { fontSize: 13, fontWeight: '500', color: colors.foreground },
});
export default memo(InventoryScreen);
