import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ChevronLeft, TrendingUp, Users, Droplets, Wallet, Calendar } from 'lucide-react-native';
import { router } from 'expo-router';
import { reportsApi } from '@/lib/milkeyApi';
import { LineChart, BarChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 32;

type PeriodType = '7' | '14' | '30';

interface ChartDataPoint {
    date: string;
    label: string;
    quantity: number;
    amount: number;
    morningQty: number;
    eveningQty: number;
    payments: number;
}

interface TopFarmer {
    farmer: { _id: string; code: string; name: string };
    totalQuantity: number;
    totalAmount: number;
    collections: number;
    avgRate: number;
}

export default function AnalyticsScreen() {
    const { colors, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState<PeriodType>('7');
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [totals, setTotals] = useState<any>(null);
    const [topFarmers, setTopFarmers] = useState<TopFarmer[]>([]);
    const [chartType, setChartType] = useState<'quantity' | 'amount'>('quantity');

    const styles = createStyles(colors, isDark);

    useEffect(() => { fetchData(); }, [period]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [analyticsRes, farmersRes] = await Promise.all([
                reportsApi.getAnalytics({ days: parseInt(period) }),
                reportsApi.getTopFarmers({ days: parseInt(period), limit: 5 }),
            ]);

            if (analyticsRes.success && analyticsRes.response) {
                setChartData(analyticsRes.response.chartData);
                setTotals(analyticsRes.response.totals);
            }

            if (farmersRes.success && farmersRes.response) {
                setTopFarmers(farmersRes.response);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, [period]);

    const getLineChartData = () => {
        const labels = chartData.slice(-7).map(d => d.label.split(' ')[0]);
        const data = chartData.slice(-7).map(d => chartType === 'quantity' ? d.quantity : d.amount / 100);

        return {
            labels,
            datasets: [{
                data: data.length > 0 ? data : [0],
                color: () => colors.primary,
                strokeWidth: 2
            }],
            legend: [chartType === 'quantity' ? 'Quantity (L)' : 'Amount (₹100s)']
        };
    };

    const getBarChartData = () => {
        const labels = chartData.slice(-7).map(d => d.label.split(' ')[0]);
        const morningData = chartData.slice(-7).map(d => d.morningQty);
        const eveningData = chartData.slice(-7).map(d => d.eveningQty);

        return {
            labels,
            datasets: [
                { data: morningData.length > 0 ? morningData : [0] },
            ],
            legend: ['Morning Collection (L)']
        };
    };

    const chartConfig = {
        backgroundColor: colors.card,
        backgroundGradientFrom: colors.card,
        backgroundGradientTo: colors.card,
        decimalPlaces: 1,
        color: (opacity = 1) => `rgba(74, 144, 217, ${opacity})`,
        labelColor: () => colors.mutedForeground,
        style: { borderRadius: 12 },
        propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
        propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '5,5' },
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>Analytics</Text>
                <TrendingUp size={24} color={colors.primary} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            >
                {/* Period Selector */}
                <View style={styles.periodRow}>
                    {(['7', '14', '30'] as PeriodType[]).map((p) => (
                        <Pressable
                            key={p}
                            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                            onPress={() => setPeriod(p)}
                        >
                            <Text style={[styles.periodText, period === p && { color: colors.white }]}>
                                {p === '7' ? '7 Days' : p === '14' ? '14 Days' : '30 Days'}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <View style={styles.summaryGrid}>
                            <View style={[styles.summaryCard, { backgroundColor: colors.primary + '20' }]}>
                                <Droplets size={20} color={colors.primary} />
                                <Text style={styles.summaryValue}>{totals?.totalQuantity?.toFixed(1) || 0} L</Text>
                                <Text style={styles.summaryLabel}>Total Milk</Text>
                            </View>
                            <View style={[styles.summaryCard, { backgroundColor: colors.success + '20' }]}>
                                <Wallet size={20} color={colors.success} />
                                <Text style={[styles.summaryValue, { color: colors.success }]}>₹{totals?.totalAmount?.toFixed(0) || 0}</Text>
                                <Text style={styles.summaryLabel}>Total Value</Text>
                            </View>
                        </View>

                        <View style={styles.summaryGrid}>
                            <View style={[styles.summaryCard, { backgroundColor: colors.warning + '20' }]}>
                                <Calendar size={20} color={colors.warning} />
                                <Text style={[styles.summaryValue, { color: colors.warning }]}>{totals?.avgDailyQty?.toFixed(1) || 0} L</Text>
                                <Text style={styles.summaryLabel}>Daily Avg</Text>
                            </View>
                            <View style={[styles.summaryCard, { backgroundColor: colors.destructive + '20' }]}>
                                <TrendingUp size={20} color={colors.destructive} />
                                <Text style={[styles.summaryValue, { color: colors.destructive }]}>₹{totals?.totalPayments?.toFixed(0) || 0}</Text>
                                <Text style={styles.summaryLabel}>Payments</Text>
                            </View>
                        </View>

                        {/* Chart Type Toggle */}
                        <View style={styles.chartTypeRow}>
                            <Pressable
                                style={[styles.chartTypeBtn, chartType === 'quantity' && styles.chartTypeBtnActive]}
                                onPress={() => setChartType('quantity')}
                            >
                                <Droplets size={14} color={chartType === 'quantity' ? colors.white : colors.foreground} />
                                <Text style={[styles.chartTypeText, chartType === 'quantity' && { color: colors.white }]}>Quantity</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.chartTypeBtn, chartType === 'amount' && styles.chartTypeBtnActive]}
                                onPress={() => setChartType('amount')}
                            >
                                <Wallet size={14} color={chartType === 'amount' ? colors.white : colors.foreground} />
                                <Text style={[styles.chartTypeText, chartType === 'amount' && { color: colors.white }]}>Amount</Text>
                            </Pressable>
                        </View>

                        {/* Line Chart */}
                        <View style={styles.chartCard}>
                            <Text style={styles.chartTitle}>Collection Trend</Text>
                            {chartData.length > 0 && (
                                <LineChart
                                    data={getLineChartData()}
                                    width={CHART_WIDTH}
                                    height={200}
                                    chartConfig={chartConfig}
                                    bezier
                                    style={styles.chart}
                                    withInnerLines={true}
                                    withOuterLines={false}
                                    withVerticalLabels={true}
                                    withHorizontalLabels={true}
                                    fromZero={true}
                                />
                            )}
                        </View>

                        {/* Bar Chart - Morning vs Evening */}
                        <View style={styles.chartCard}>
                            <Text style={styles.chartTitle}>Morning Collection</Text>
                            {chartData.length > 0 && (
                                <BarChart
                                    data={getBarChartData()}
                                    width={CHART_WIDTH}
                                    height={180}
                                    chartConfig={{
                                        ...chartConfig,
                                        color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
                                    }}
                                    style={styles.chart}
                                    showValuesOnTopOfBars={true}
                                    fromZero={true}
                                    yAxisLabel=""
                                    yAxisSuffix="L"
                                />
                            )}
                        </View>

                        {/* Top Farmers */}
                        <View style={styles.topFarmersCard}>
                            <View style={styles.topFarmersHeader}>
                                <Users size={18} color={colors.primary} />
                                <Text style={styles.topFarmersTitle}>Top Farmers</Text>
                            </View>

                            {topFarmers.length > 0 ? topFarmers.map((item, idx) => (
                                <View key={item.farmer._id} style={styles.farmerRow}>
                                    <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? colors.warning : idx === 1 ? colors.mutedForeground : colors.muted }]}>
                                        <Text style={styles.rankText}>{idx + 1}</Text>
                                    </View>
                                    <View style={styles.farmerInfo}>
                                        <Text style={styles.farmerName}>{item.farmer.name}</Text>
                                        <Text style={styles.farmerCode}>Code: {item.farmer.code}</Text>
                                    </View>
                                    <View style={styles.farmerStats}>
                                        <Text style={styles.farmerQty}>{item.totalQuantity.toFixed(1)} L</Text>
                                        <Text style={styles.farmerAmt}>₹{item.totalAmount.toFixed(0)}</Text>
                                    </View>
                                </View>
                            )) : (
                                <Text style={styles.emptyText}>No data available</Text>
                            )}
                        </View>

                        {/* Quick Stats */}
                        <View style={styles.quickStatsCard}>
                            <Text style={styles.quickStatsTitle}>Quick Stats</Text>
                            <View style={styles.quickStatsRow}>
                                <View style={styles.quickStatItem}>
                                    <Text style={styles.quickStatLabel}>Max Daily</Text>
                                    <Text style={styles.quickStatValue}>{totals?.maxQty?.toFixed(1) || 0} L</Text>
                                </View>
                                <View style={styles.quickStatItem}>
                                    <Text style={styles.quickStatLabel}>Min Daily</Text>
                                    <Text style={styles.quickStatValue}>{totals?.minQty?.toFixed(1) || 0} L</Text>
                                </View>
                                <View style={styles.quickStatItem}>
                                    <Text style={styles.quickStatLabel}>Total Days</Text>
                                    <Text style={styles.quickStatValue}>{chartData.length}</Text>
                                </View>
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, paddingTop: 50, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { marginRight: 12 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.foreground },
    scrollView: { flex: 1 },
    scrollContent: { padding: 12, paddingBottom: 40 },
    periodRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    periodBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    periodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    periodText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    loadingContainer: { paddingVertical: 60, alignItems: 'center' },
    summaryGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    summaryCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
    summaryValue: { fontSize: 20, fontWeight: '700', color: colors.foreground, marginTop: 8 },
    summaryLabel: { fontSize: 11, color: colors.mutedForeground, marginTop: 4 },
    chartTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    chartTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: colors.card, gap: 6, borderWidth: 1, borderColor: colors.border },
    chartTypeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chartTypeText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    chartCard: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    chartTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
    chart: { borderRadius: 8, marginLeft: -8 },
    topFarmersCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    topFarmersHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    topFarmersTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    farmerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    rankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    rankText: { fontSize: 12, fontWeight: '700', color: colors.white },
    farmerInfo: { flex: 1, marginLeft: 12 },
    farmerName: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    farmerCode: { fontSize: 11, color: colors.mutedForeground },
    farmerStats: { alignItems: 'flex-end' },
    farmerQty: { fontSize: 14, fontWeight: '700', color: colors.primary },
    farmerAmt: { fontSize: 11, color: colors.success },
    emptyText: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 20 },
    quickStatsCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    quickStatsTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
    quickStatsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    quickStatItem: { alignItems: 'center' },
    quickStatLabel: { fontSize: 11, color: colors.mutedForeground, marginBottom: 4 },
    quickStatValue: { fontSize: 16, fontWeight: '700', color: colors.foreground },
});
