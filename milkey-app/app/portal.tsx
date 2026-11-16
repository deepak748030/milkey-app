import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
    ArrowDownLeft,
    ArrowLeft,
    ArrowUpRight,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock3,
    Droplets,
    History,
    IndianRupee,
    Lock,
    LogOut,
    MapPin,
    Phone,
    ShoppingCart,
    UserRound,
    Wallet,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { clearAuth } from '@/lib/authStore';
import {
    clearPortalSession,
    firstAvailablePortalModule,
    getPortalSession,
    portalApi,
    setPortalSession,
    PortalAdvanceRow,
    PortalDashboard,
    PortalEntryRow,
    PortalModule,
    PortalPaymentRow,
    PortalUser,
} from '@/lib/portalAuth';

const GREEN_DARK = '#087A3D';
const PALE_GREEN = '#EDF9F1';
const PALE_ORANGE = '#FFF6DF';
const ORANGE = '#C77700';

const money = (value: number | string | undefined) => {
    const n = Number(value || 0);
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const quantity = (value: number | string | undefined) => (
    Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })
);

const longDate = (value?: string) => {
    if (!value) return '--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const shortDate = (value?: string) => {
    if (!value) return '--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const todayLabel = () => new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
});

type Align = 'left' | 'center' | 'right';
type Column = { label: string; flex: number; align?: Align };

type RowWithId = { id: string };

function DataTable<T extends RowWithId>({
    colors,
    columns,
    rows,
    tableWidth,
    renderRow,
    emptyText,
}: {
    colors: any;
    columns: Column[];
    rows: T[];
    tableWidth: number;
    renderRow: (row: T, index: number) => React.ReactNode;
    emptyText: string;
}) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
            <View style={{ minWidth: tableWidth }}>
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: '#EEF3F7',
                    borderRadius: 8,
                    paddingVertical: 9,
                    paddingHorizontal: 8,
                    marginBottom: 2,
                }}>
                    {columns.map((col) => (
                        <Text
                            key={col.label}
                            numberOfLines={1}
                            style={{
                                flex: col.flex,
                                fontSize: 10.5,
                                fontWeight: '700',
                                color: '#52616B',
                                textAlign: col.align || 'center',
                            }}
                        >
                            {col.label}
                        </Text>
                    ))}
                </View>
                {rows.length === 0 ? (
                    <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{emptyText}</Text>
                    </View>
                ) : rows.map((row, index) => (
                    <View
                        key={row.id || String(index)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            minHeight: 42,
                            borderBottomWidth: index === rows.length - 1 ? 0 : 1,
                            borderBottomColor: colors.border,
                            backgroundColor: index % 2 === 0 ? colors.card : colors.background,
                        }}
                    >
                        {renderRow(row, index)}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

function Cell({
    children,
    flex,
    align = 'center',
    colors,
    bold,
}: {
    children: React.ReactNode;
    flex: number;
    align?: Align;
    colors: any;
    bold?: boolean;
}) {
    return (
        <View style={{ flex, alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }}>
            {typeof children === 'string' || typeof children === 'number' ? (
                <Text
                    numberOfLines={1}
                    style={{
                        fontSize: 11,
                        color: colors.foreground,
                        fontWeight: bold ? '800' : '600',
                        textAlign: align,
                    }}
                >
                    {children}
                </Text>
            ) : children}
        </View>
    );
}

function StatusPill({ status, colors }: { status?: string; colors: any }) {
    const isPaid = String(status || '').toLowerCase() === 'paid';
    return (
        <View style={{
            paddingHorizontal: 7,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: isPaid ? '#DFF6E6' : PALE_ORANGE,
            alignSelf: 'center',
        }}>
            <Text style={{ fontSize: 9.5, fontWeight: '800', color: isPaid ? GREEN_DARK : ORANGE }}>
                {status || 'Pending'}
            </Text>
        </View>
    );
}

function SectionCard({
    title,
    icon: Icon,
    colors,
    count,
    expanded,
    onToggle,
    children,
}: {
    title: string;
    icon: any;
    colors: any;
    count: number;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <View style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.primary + '35',
            marginTop: 12,
            overflow: 'hidden',
            shadowColor: GREEN_DARK,
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 2,
        }}>
            <LinearGradient
                colors={[colors.primary + '12', colors.card]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                }}
            >
                <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                }}>
                    <Icon size={15} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.foreground }}>{title}</Text>
                    <Text style={{ fontSize: 9.5, color: colors.mutedForeground, marginTop: 1 }}>
                        {count} record{count === 1 ? '' : 's'}
                    </Text>
                </View>
                {count > 4 && (
                    <Pressable onPress={onToggle} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.primary }}>
                            {expanded ? 'Show Less' : 'View All'}
                        </Text>
                        <ChevronRight size={14} color={colors.primary} />
                    </Pressable>
                )}
            </LinearGradient>
            <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>{children}</View>
        </View>
    );
}

function SummaryCard({
    label,
    value,
    sub,
    icon: Icon,
    tone,
    colors,
}: {
    label: string;
    value: string;
    sub?: string;
    icon: any;
    tone: 'green' | 'orange' | 'wallet';
    colors: any;
}) {
    const bg = tone === 'orange' ? PALE_ORANGE : tone === 'wallet' ? '#EAF7F1' : PALE_GREEN;
    const iconColor = tone === 'orange' ? ORANGE : GREEN_DARK;
    return (
        <View style={{
            flex: 1,
            minWidth: 100,
            backgroundColor: colors.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 9,
            marginHorizontal: 3,
            shadowColor: GREEN_DARK,
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 1,
        }}>
            <View style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: bg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 7,
            }}>
                <Icon size={14} color={iconColor} />
            </View>
            <Text numberOfLines={1} style={{ fontSize: 9.5, fontWeight: '700', color: colors.mutedForeground }}>{label}</Text>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '900', color: colors.foreground, marginTop: 2 }}>{value}</Text>
            {!!sub && <Text numberOfLines={1} style={{ fontSize: 9, color: colors.mutedForeground, marginTop: 2 }}>{sub}</Text>}
        </View>
    );
}

export default function PortalScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const tableWidth = Math.max(width - 36, 520);

    const [session, setSession] = useState<PortalUser | null>(null);
    const [module, setModule] = useState<PortalModule>('collection');
    const [dashboard, setDashboard] = useState<PortalDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState<Record<'entries' | 'payments' | 'advances', boolean>>({
        entries: false,
        payments: false,
        advances: false,
    });

    const toggleSection = useCallback((key: 'entries' | 'payments' | 'advances') => {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const logout = useCallback(async () => {
        await portalApi.logout().catch(() => undefined);
        await clearPortalSession().catch(() => undefined);
        await clearAuth().catch(() => undefined);
        router.replace('/auth');
    }, []);

    const confirmLogout = useCallback(() => {
        Alert.alert(
            'Logout?',
            'You will need to verify your mobile number again to view your dairy records.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: () => { void logout(); } },
            ],
        );
    }, [logout]);

    useEffect(() => {
        let alive = true;
        (async () => {
            const local = await getPortalSession();
            if (!local) {
                router.replace('/auth');
                return;
            }
            let user = local.user;
            setSession(user);
            const remote = await portalApi.getSession();
            if (remote.success && remote.response?.user) {
                user = remote.response.user;
                await setPortalSession(local.token, user);
            } else if (remote.status === 401 || remote.code === 'INVALID_PORTAL_SESSION' || remote.code === 'PORTAL_SESSION_REQUIRED') {
                await clearPortalSession();
                router.replace('/auth');
                return;
            }
            if (alive) {
                setSession(user);
                setModule(firstAvailablePortalModule(user));
            }
        })();
        return () => { alive = false; };
    }, []);

    const loadDashboard = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError('');
        const result = await portalApi.getDashboard(module);
        if (result.success && result.response) {
            setDashboard(result.response);
            if (result.response.profile) setSession(result.response.profile);
            if (!result.response.availableModules.includes(module)) {
                setModule(firstAvailablePortalModule(result.response.profile));
            }
        } else if (result.status === 401 || result.code === 'INVALID_PORTAL_SESSION' || result.code === 'PORTAL_SESSION_REQUIRED') {
            await clearPortalSession();
            router.replace('/auth');
            return;
        } else {
            setDashboard(null);
            setError(result.message || 'Could not load your dairy records.');
        }
        setLoading(false);
        setRefreshing(false);
    }, [module]);

    const sessionKey = session?.availableModules?.join(',') || '';
    useEffect(() => {
        if (!session || !session.availableModules.includes(module)) return;
        setExpanded({ entries: false, payments: false, advances: false });
        void loadDashboard(false);
    }, [session?.phone, sessionKey, module, loadDashboard]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void loadDashboard(true);
    }, [loadDashboard]);

    const switchTo = useCallback((next: PortalModule) => {
        if (!session?.availableModules.includes(next)) return;
        setDashboard(null);
        setError('');
        setModule(next);
    }, [session]);

    const profile = dashboard?.profile || session;
    const summary = dashboard?.summary;
    const entries: PortalEntryRow[] = dashboard?.entries || [];
    const payments: PortalPaymentRow[] = dashboard?.payments || [];
    const advances: PortalAdvanceRow[] = dashboard?.advances || [];
    const available = session?.availableModules || [];
    const isSelling = module === 'selling';

    const visible = useMemo(() => ({
        entries: expanded.entries ? entries : entries.slice(0, 4),
        payments: expanded.payments ? payments : payments.slice(0, 4),
        advances: expanded.advances ? advances : advances.slice(0, 4),
    }), [entries, payments, advances, expanded]);

    const unavailableNote = available.length === 1
        ? `Only ${available[0] === 'collection' ? 'Collection' : 'Selling'} data is linked to this mobile number. The other switch is unavailable.`
        : '';

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style="light" />
            <LinearGradient
                colors={[colors.primary, GREEN_DARK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    paddingTop: insets.top + 12,
                    paddingBottom: 44,
                    paddingHorizontal: 14,
                    borderBottomLeftRadius: 22,
                    borderBottomRightRadius: 22,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable onPress={confirmLogout} hitSlop={10} style={{ width: 42, alignItems: 'flex-start' }}>
                        <ArrowLeft size={22} color="#fff" />
                    </Pressable>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 19, fontWeight: '900', color: '#fff', letterSpacing: 0.2 }}>
                            {isSelling ? 'Selling' : 'Customer Details'}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#D8F7E4', marginTop: 2 }}>
                            Farmer / Customer view
                        </Text>
                    </View>
                    <Pressable onPress={confirmLogout} hitSlop={10} style={{ width: 42, alignItems: 'flex-end' }}>
                        <LogOut size={19} color="#fff" />
                    </Pressable>
                </View>
                <View style={{
                    alignSelf: 'flex-end',
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#ffffff22',
                    borderRadius: 999,
                    paddingHorizontal: 11,
                    paddingVertical: 7,
                    marginTop: 10,
                }}>
                    <CalendarDays size={14} color="#fff" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff', marginHorizontal: 6 }}>{todayLabel()}</Text>
                    <ChevronDown size={13} color="#fff" />
                </View>
            </LinearGradient>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: Math.max(insets.bottom + 24, 34) }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            >
                <View style={{
                    marginTop: -30,
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: colors.primary + '35',
                    padding: 14,
                    overflow: 'hidden',
                    shadowColor: GREEN_DARK,
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 5 },
                    elevation: 4,
                }}>
                    <View style={{
                        position: 'absolute',
                        width: 170,
                        height: 170,
                        borderRadius: 85,
                        backgroundColor: colors.primary + '0D',
                        right: -60,
                        top: -55,
                    }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            backgroundColor: '#DCEEFB',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 2,
                            borderColor: '#fff',
                            marginRight: 12,
                        }}>
                            <UserRound size={32} color={GREEN_DARK} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '900', color: colors.foreground, flexShrink: 1 }}>
                                    {profile?.name || 'Farmer / Customer'}
                                </Text>
                                <View style={{ backgroundColor: '#DFF6E6', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }}>
                                    <Text style={{ fontSize: 9, fontWeight: '800', color: GREEN_DARK }}>
                                        {profile?.status || 'Active'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                                {isSelling ? 'Customer Code' : 'Farmer Code'} : {profile?.code || '--'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <Phone size={12} color={colors.primary} />
                                <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.foreground, marginLeft: 5 }}>
                                    {profile?.phone || '--'}
                                </Text>
                            </View>
                        </View>
                    </View>
                    {!!profile?.address && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9 }}>
                            <MapPin size={12} color={colors.primary} />
                            <Text numberOfLines={1} style={{ fontSize: 11, color: colors.mutedForeground, marginLeft: 5, flex: 1 }}>
                                {profile.address}
                            </Text>
                        </View>
                    )}
                    <View style={{
                        marginTop: 10,
                        backgroundColor: colors.primary + '0D',
                        borderRadius: 9,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}>
                        <CheckCircle2 size={13} color={colors.primary} />
                        <Text numberOfLines={2} style={{ fontSize: 10, color: colors.foreground, marginLeft: 6, flex: 1 }}>
                            Linked dairy: {profile?.dairyNames?.join(', ') || profile?.dairyName || 'Dairy'}
                        </Text>
                    </View>
                </View>

                <View style={{
                    flexDirection: 'row',
                    backgroundColor: colors.card,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: colors.primary,
                    padding: 4,
                    marginTop: 16,
                    overflow: 'hidden',
                }}>
                    {(['collection', 'selling'] as PortalModule[]).map((item) => {
                        const enabled = available.includes(item);
                        const active = module === item && enabled;
                        const Icon = item === 'collection' ? Droplets : ShoppingCart;
                        return (
                            <Pressable
                                key={item}
                                onPress={() => switchTo(item)}
                                disabled={!enabled}
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 999,
                                    paddingVertical: 11,
                                    backgroundColor: active ? colors.card : 'transparent',
                                    opacity: enabled ? 1 : 0.45,
                                    borderWidth: active ? 2 : 0,
                                    borderColor: active ? colors.primary : 'transparent',
                                }}
                            >
                                <Icon size={16} color={active ? GREEN_DARK : enabled ? colors.mutedForeground : '#9CA3AF'} />
                                <Text style={{
                                    fontSize: 15,
                                    fontWeight: '900',
                                    color: active ? colors.foreground : enabled ? colors.mutedForeground : '#9CA3AF',
                                    marginLeft: 6,
                                }}>
                                    {item === 'collection' ? 'Collection' : 'Selling'}
                                </Text>
                                {!enabled && <Lock size={12} color="#9CA3AF" style={{ marginLeft: 5 }} />}
                            </Pressable>
                        );
                    })}
                </View>
                {!!unavailableNote && (
                    <Text style={{ fontSize: 10.5, color: colors.mutedForeground, textAlign: 'center', marginTop: 7 }}>
                        {unavailableNote}
                    </Text>
                )}

                <View style={{ flexDirection: 'row', marginHorizontal: -3, marginTop: 14 }}>
                    <SummaryCard
                        label={isSelling ? 'Today Milk' : 'Today Milk'}
                        value={money(summary?.todayMilkAmount)}
                        sub={`${quantity(summary?.todayMilkQuantity)} L today`}
                        icon={isSelling ? ShoppingCart : Droplets}
                        tone="green"
                        colors={colors}
                    />
                    <SummaryCard
                        label="Advance Pending"
                        value={money(summary?.advancePending)}
                        sub="Isolated ledger"
                        icon={Clock3}
                        tone="orange"
                        colors={colors}
                    />
                    <SummaryCard
                        label="Current Balance"
                        value={money(summary?.currentBalance)}
                        sub="Read-only"
                        icon={Wallet}
                        tone="wallet"
                        colors={colors}
                    />
                </View>

                {(loading && !dashboard) ? (
                    <View style={{
                        marginTop: 14,
                        padding: 24,
                        borderRadius: 16,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                    }}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 10 }}>
                            Loading your linked dairy records...
                        </Text>
                    </View>
                ) : !!error ? (
                    <View style={{
                        marginTop: 14,
                        padding: 18,
                        borderRadius: 16,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                    }}>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center' }}>{error}</Text>
                        <Pressable onPress={() => void loadDashboard(false)} style={{
                            marginTop: 12,
                            backgroundColor: colors.primary,
                            borderRadius: 9,
                            paddingHorizontal: 16,
                            paddingVertical: 9,
                        }}>
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Retry</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <SectionCard
                            title={isSelling ? 'Recent Selling Entries' : 'Purchase Entry (Milk)'}
                            icon={isSelling ? ShoppingCart : Droplets}
                            colors={colors}
                            count={entries.length}
                            expanded={expanded.entries}
                            onToggle={() => toggleSection('entries')}
                        >
                            <DataTable
                                colors={colors}
                                tableWidth={tableWidth}
                                emptyText="No milk entries found for this mobile number."
                                columns={[
                                    { label: 'Date', flex: 1.05 },
                                    { label: isSelling ? 'Customer' : 'Farmer', flex: 1.35, align: 'left' },
                                    { label: 'Qty (L)', flex: 0.8 },
                                    { label: 'Rate (₹)', flex: 0.8 },
                                    { label: 'Amount (₹)', flex: 1 },
                                    { label: 'Status', flex: 0.9 },
                                ]}
                                rows={visible.entries}
                                renderRow={(row) => (
                                    <>
                                        <Cell flex={1.05} colors={colors}>{shortDate(row.date)}</Cell>
                                        <Cell flex={1.35} align="left" colors={colors}>
                                            {isSelling ? (row.customerName || profile?.name || '--') : (row.farmerName || profile?.name || '--')}
                                        </Cell>
                                        <Cell flex={0.8} colors={colors}>{quantity(row.quantity)}</Cell>
                                        <Cell flex={0.8} colors={colors}>{money(row.rate)}</Cell>
                                        <Cell flex={1} colors={colors} bold>{money(row.amount)}</Cell>
                                        <Cell flex={0.9} colors={colors}>
                                            <StatusPill status={row.status} colors={colors} />
                                        </Cell>
                                    </>
                                )}
                            />
                        </SectionCard>

                        <SectionCard
                            title={isSelling ? 'Selling Payment History' : 'Settlement Payment History'}
                            icon={IndianRupee}
                            colors={colors}
                            count={payments.length}
                            expanded={expanded.payments}
                            onToggle={() => toggleSection('payments')}
                        >
                            <DataTable
                                colors={colors}
                                tableWidth={tableWidth}
                                emptyText="No payment history found."
                                columns={[
                                    { label: 'Date', flex: 1.05 },
                                    { label: 'Amount', flex: 1 },
                                    { label: 'Mode', flex: 0.9 },
                                    { label: 'Remark', flex: 1.8, align: 'left' },
                                    { label: 'Dairy', flex: 1.25, align: 'left' },
                                ]}
                                rows={visible.payments}
                                renderRow={(row) => (
                                    <>
                                        <Cell flex={1.05} colors={colors}>{longDate(row.date)}</Cell>
                                        <Cell flex={1} colors={colors} bold>{money(row.amount)}</Cell>
                                        <Cell flex={0.9} colors={colors}>{row.mode}</Cell>
                                        <Cell flex={1.8} align="left" colors={colors}>{row.remark || '--'}</Cell>
                                        <Cell flex={1.25} align="left" colors={colors}>{row.dairyName || profile?.dairyName || '--'}</Cell>
                                    </>
                                )}
                            />
                        </SectionCard>

                        <SectionCard
                            title="Advance History"
                            icon={History}
                            colors={colors}
                            count={advances.length}
                            expanded={expanded.advances}
                            onToggle={() => toggleSection('advances')}
                        >
                            <DataTable
                                colors={colors}
                                tableWidth={tableWidth}
                                emptyText="No advance history found."
                                columns={[
                                    { label: 'Date', flex: 1.05 },
                                    { label: 'Type', flex: 1.15 },
                                    { label: 'Amount', flex: 1 },
                                    { label: 'Remark', flex: 1.8, align: 'left' },
                                    { label: 'Dairy', flex: 1.25, align: 'left' },
                                ]}
                                rows={visible.advances}
                                renderRow={(row) => {
                                    const up = row.direction === 'up';
                                    const Arrow = up ? ArrowUpRight : ArrowDownLeft;
                                    return (
                                        <>
                                            <Cell flex={1.05} colors={colors}>{longDate(row.date)}</Cell>
                                            <Cell flex={1.15} colors={colors}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Arrow size={12} color={up ? GREEN_DARK : ORANGE} />
                                                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: up ? GREEN_DARK : ORANGE, marginLeft: 3 }}>
                                                        {row.type}
                                                    </Text>
                                                </View>
                                            </Cell>
                                            <Cell flex={1} colors={colors} bold>{money(row.amount)}</Cell>
                                            <Cell flex={1.8} align="left" colors={colors}>{row.remark || '--'}</Cell>
                                            <Cell flex={1.25} align="left" colors={colors}>{row.dairyName || profile?.dairyName || '--'}</Cell>
                                        </>
                                    );
                                }}
                            />
                        </SectionCard>

                        <Text style={{
                            fontSize: 9.5,
                            color: colors.mutedForeground,
                            textAlign: 'center',
                            marginTop: 16,
                            paddingHorizontal: 12,
                        }}>
                            This is a read-only view. Please contact your dairy owner to add or correct any entry.
                        </Text>
                    </>
                )}
            </ScrollView>
        </View>
    );
}
