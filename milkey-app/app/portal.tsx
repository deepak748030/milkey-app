import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { SearchInput } from '@/components/common/SearchInput';
import { DateRangePicker } from '@/components/DateRangePicker';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
    ArrowDownLeft,
    ArrowLeft,
    ArrowUpRight,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Clock3,
    Droplets,
    Filter,
    History,
    IndianRupee,
    Lock,
    LogOut,
    MapPin,
    Phone,
    ShoppingCart,
    UserRound,
    Wallet,
    X,
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

/**
 * Farmer / Customer portal.
 *
 * Design is intentionally copied from the dairy-owner tabs:
 * - flat green TopBar-like header (no gradient)
 * - colors.card + colors.border cards with 12px radius
 * - 8–10px gaps, #eef2f7 table headers on light theme
 * - no shadow / elevation anywhere
 * - tables fit the screen width; there is NO horizontal ScrollView
 */

type Align = 'left' | 'center' | 'right';
type SectionKey = 'entries' | 'payments' | 'advances';
type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';
type EntryStatusFilter = 'all' | 'paid' | 'pending';
type AdvanceTypeFilter = 'all' | 'given' | 'adjusted';
type SectionFilter = 'all' | SectionKey;

interface Filters {
    search: string;
    datePreset: DatePreset;
    startDate: string;
    endDate: string;
    status: EntryStatusFilter;
    mode: string;
    advanceType: AdvanceTypeFilter;
    dairy: string;
    section: SectionFilter;
}

interface PortalColumn<T> {
    key: string;
    title: string;
    flex: number;
    align?: Align;
    hideOnCompact?: boolean;
    render: (row: T) => React.ReactNode;
}

const DEFAULT_FILTERS: Filters = {
    search: '',
    datePreset: 'all',
    startDate: '',
    endDate: '',
    status: 'all',
    mode: 'all',
    advanceType: 'all',
    dairy: 'all',
    section: 'all',
};

const DATE_PRESETS: Array<{ key: DatePreset; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'week', label: '7 Days' },
    { key: 'month', label: 'This Month' },
    { key: 'custom', label: 'Custom' },
];

const STATUS_OPTIONS: Array<{ key: EntryStatusFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'pending', label: 'Pending' },
];

const ADVANCE_OPTIONS: Array<{ key: AdvanceTypeFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'given', label: 'Given' },
    { key: 'adjusted', label: 'Adjusted' },
];

const SECTION_OPTIONS: Array<{ key: SectionFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'entries', label: 'Entries' },
    { key: 'payments', label: 'Payments' },
    { key: 'advances', label: 'Advances' },
];

const STANDARD_MODES = ['cash', 'upi', 'bank', 'cheque'];

const pad2 = (value: number) => String(value).padStart(2, '0');

const dateKeyFromDate = (date: Date) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const localDateKey = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return dateKeyFromDate(date);
};

const yearOf = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : String(date.getFullYear());
};

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

const modeLabel = (value: string) => {
    const key = String(value || '').toLowerCase();
    if (!key || key === 'all') return 'All';
    return key.charAt(0).toUpperCase() + key.slice(1);
};

const getDateRange = (filters: Filters): { start?: string; end?: string } | null => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayKey = dateKeyFromDate(today);
    const dayMs = 24 * 60 * 60 * 1000;

    if (filters.datePreset === 'today') return { start: todayKey, end: todayKey };
    if (filters.datePreset === 'week') {
        return { start: dateKeyFromDate(new Date(today.getTime() - 6 * dayMs)), end: todayKey };
    }
    if (filters.datePreset === 'month') {
        return { start: `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-01`, end: todayKey };
    }
    if (filters.datePreset === 'custom') {
        const rawStart = filters.startDate.trim();
        const rawEnd = filters.endDate.trim();
        if (!rawStart && !rawEnd) return null;
        let start = rawStart || '0000-01-01';
        let end = rawEnd || todayKey;
        if (start > end) [start, end] = [end, start];
        return { start, end };
    }
    return null;
};

const rowSearchText = (row: any, profile?: PortalUser | null) => [
    row?.customerName,
    row?.farmerName,
    row?.remark,
    row?.mode,
    row?.type,
    row?.status,
    row?.dairyName,
    profile?.name,
    profile?.code,
    profile?.phone,
    profile?.address,
    profile?.dairyName,
    shortDate(row?.date),
    longDate(row?.date),
    money(row?.amount),
    quantity(row?.quantity),
].filter(Boolean).join(' ').toLowerCase();

// Plain themed box. Avoids components/ui/Card, which has an unrelated runtime bug.
function Box({ style, children, ...rest }: any) {
    const { colors } = useTheme();
    return (
        <View
            style={[
                {
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                },
                style,
            ]}
            {...rest}
        >
            {children}
        </View>
    );
}

function Chip({ label, active, onPress, s }: { label: string; active: boolean; onPress: () => void; s: any }) {
    return (
        <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
            <Text numberOfLines={1} style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
        </Pressable>
    );
}

function FilterGroup({ label, children, s }: { label: string; children: React.ReactNode; s: any }) {
    return (
        <View style={s.filterGroup}>
            <Text style={s.filterGroupLabel}>{label}</Text>
            <View style={s.chipRow}>{children}</View>
        </View>
    );
}

function StatusPill({ status, colors, s }: { status?: string; colors: any; s: any }) {
    const key = String(status || '').toLowerCase();
    const positive = key === 'paid' || key === 'active' || key === 'settled' || key === 'adjusted';
    return (
        <View style={[s.statusPill, { backgroundColor: positive ? colors.success + '18' : colors.warning + '18' }]}>
            <Text style={[s.statusPillText, { color: positive ? colors.success : colors.warning }]}>
                {status || 'Pending'}
            </Text>
        </View>
    );
}

function CellText({
    children,
    s,
    align = 'center',
    bold,
    muted,
    numberOfLines = 1,
}: {
    children: React.ReactNode;
    s: any;
    align?: Align;
    bold?: boolean;
    muted?: boolean;
    numberOfLines?: number;
}) {
    const alignStyle = align === 'left' ? s.alignLeft : align === 'right' ? s.alignRight : s.alignCenter;
    return (
        <Text
            numberOfLines={numberOfLines}
            ellipsizeMode="tail"
            style={[s.cellText, alignStyle, bold && s.bold, muted && s.muted]}
        >
            {children}
        </Text>
    );
}

function TwoLineCell({
    primary,
    secondary,
    s,
    align = 'center',
    bold,
}: {
    primary: string;
    secondary?: string;
    s: any;
    align?: Align;
    bold?: boolean;
}) {
    const alignStyle = align === 'left' ? s.alignLeft : align === 'right' ? s.alignRight : s.alignCenter;
    return (
        <View style={{ minWidth: 0, flexShrink: 1 }}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={[s.cellText, alignStyle, bold && s.bold]}>
                {primary}
            </Text>
            {!!secondary && (
                <Text numberOfLines={1} ellipsizeMode="tail" style={[s.cellSub, alignStyle]}>
                    {secondary}
                </Text>
            )}
        </View>
    );
}

function PortalTable<T extends { id: string }>({
    columns,
    rows,
    emptyText,
    compact,
    s,
}: {
    columns: PortalColumn<T>[];
    rows: T[];
    emptyText: string;
    compact: boolean;
    s: any;
}) {
    const visibleColumns = columns.filter((col) => !(compact && col.hideOnCompact));

    if (!rows.length) {
        return (
            <View style={s.empty}>
                <Text style={s.emptyText}>{emptyText}</Text>
            </View>
        );
    }

    return (
        <View style={s.tableWrap}>
            <View style={s.tHead}>
                {visibleColumns.map((col) => (
                    <Text
                        key={col.key}
                        numberOfLines={1}
                        style={[
                            s.tHeadText,
                            {
                                flex: col.flex,
                                minWidth: 0,
                                flexShrink: 1,
                                textAlign: col.align || 'center',
                            },
                        ]}
                    >
                        {col.title}
                    </Text>
                ))}
            </View>
            {rows.map((row, index) => (
                <View key={row.id || String(index)} style={[s.row, index % 2 === 1 && s.rowAlt]}>
                    {visibleColumns.map((col) => (
                        <View
                            key={col.key}
                            style={[
                                s.cell,
                                {
                                    flex: col.flex,
                                    alignItems: col.align === 'left'
                                        ? 'flex-start'
                                        : col.align === 'right'
                                            ? 'flex-end'
                                            : 'center',
                                },
                            ]}
                        >
                            {col.render(row)}
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
}

function SectionCard({
    title,
    subtitle,
    icon: Icon,
    colors,
    s,
    showViewAll,
    expanded,
    onToggle,
    children,
}: {
    title: string;
    subtitle: string;
    icon: any;
    colors: any;
    s: any;
    showViewAll: boolean;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <Box style={s.sectionCard}>
            <View style={s.sectionHeader}>
                <View style={s.sectionIcon}>
                    <Icon size={15} color={colors.white} />
                </View>
                <View style={s.sectionTitleWrap}>
                    <Text numberOfLines={1} style={s.sectionTitle}>{title}</Text>
                    <Text numberOfLines={1} style={s.sectionSub}>{subtitle}</Text>
                </View>
                {showViewAll && (
                    <Pressable onPress={onToggle} style={s.viewAllBtn}>
                        <Text style={s.viewAllText}>{expanded ? 'Show Less' : 'View All'}</Text>
                        {expanded
                            ? <ChevronUp size={13} color={colors.primary} />
                            : <ChevronRight size={13} color={colors.primary} />}
                    </Pressable>
                )}
            </View>
            <View style={s.sectionBody}>{children}</View>
        </Box>
    );
}

function SummaryCard({
    label,
    value,
    sub,
    icon: Icon,
    tone,
    colors,
    s,
}: {
    label: string;
    value: string;
    sub?: string;
    icon: any;
    tone: 'green' | 'orange' | 'wallet';
    colors: any;
    s: any;
}) {
    const iconBg = tone === 'orange' ? colors.warning + '18' : colors.primary + '12';
    const iconColor = tone === 'orange' ? colors.warning : colors.primary;
    return (
        <Box style={s.summaryCard}>
            <View style={[s.summaryIcon, { backgroundColor: iconBg }]}>
                <Icon size={14} color={iconColor} />
            </View>
            <Text numberOfLines={1} style={s.summaryLabel}>{label}</Text>
            <Text numberOfLines={1} style={s.summaryValue}>{value}</Text>
            {!!sub && <Text numberOfLines={1} style={s.summarySub}>{sub}</Text>}
        </Box>
    );
}

function FilterPanel({
    filters,
    setFilter,
    clearFilters,
    filtersOpen,
    onToggleFilters,
    activeCount,
    dairyOptions,
    modeOptions,
    colors,
    s,
}: {
    filters: Filters;
    setFilter: (key: keyof Filters, value: any) => void;
    clearFilters: () => void;
    filtersOpen: boolean;
    onToggleFilters: () => void;
    activeCount: number;
    dairyOptions: string[];
    modeOptions: string[];
    colors: any;
    s: any;
}) {
    return (
        <Box style={s.filterCard}>
            <View style={s.filterHeader}>
                <Pressable onPress={onToggleFilters} hitSlop={6} style={s.filterHeaderLeft}>
                    <Filter size={15} color={colors.primary} />
                    <Text style={s.filterTitle}>Filters</Text>
                    {activeCount > 0 && (
                        <View style={s.filterCountBadge}>
                            <Text style={s.filterCountText}>{activeCount}</Text>
                        </View>
                    )}
                    <Text style={s.filterHint}>{filtersOpen ? 'Hide filters' : 'Show filters'}</Text>
                    {filtersOpen
                        ? <ChevronUp size={14} color={colors.mutedForeground} />
                        : <ChevronDown size={14} color={colors.mutedForeground} />}
                </Pressable>
                {activeCount > 0 && (
                    <Pressable onPress={clearFilters} style={s.clearBtn}>
                        <X size={12} color={colors.foreground} />
                        <Text style={s.clearText}>Clear</Text>
                    </Pressable>
                )}
            </View>

            <SearchInput
                value={filters.search}
                onChange={(value) => setFilter('search', value)}
                placeholder="Search date, name, remark, amount..."
            />

            {filtersOpen ? (
                <View style={s.filterBody}>
                    <FilterGroup label="Date" s={s}>
                        {DATE_PRESETS.map((preset) => (
                            <Chip
                                key={preset.key}
                                label={preset.label}
                                active={filters.datePreset === preset.key}
                                onPress={() => setFilter('datePreset', preset.key)}
                                s={s}
                            />
                        ))}
                    </FilterGroup>

                    {filters.datePreset === 'custom' && (
                        <DateRangePicker
                            startDate={filters.startDate || null}
                            endDate={filters.endDate || null}
                            onStartDateChange={(date) => setFilter('startDate', date)}
                            onEndDateChange={(date) => setFilter('endDate', date)}
                            startPlaceholder="Start date"
                            endPlaceholder="End date"
                        />
                    )}

                    <FilterGroup label="Entry status" s={s}>
                        {STATUS_OPTIONS.map((option) => (
                            <Chip
                                key={option.key}
                                label={option.label}
                                active={filters.status === option.key}
                                onPress={() => setFilter('status', option.key)}
                                s={s}
                            />
                        ))}
                    </FilterGroup>

                    <FilterGroup label="Payment mode" s={s}>
                        {['all', ...modeOptions].map((mode) => (
                            <Chip
                                key={mode}
                                label={modeLabel(mode)}
                                active={filters.mode === mode}
                                onPress={() => setFilter('mode', mode)}
                                s={s}
                            />
                        ))}
                    </FilterGroup>

                    <FilterGroup label="Advance type" s={s}>
                        {ADVANCE_OPTIONS.map((option) => (
                            <Chip
                                key={option.key}
                                label={option.label}
                                active={filters.advanceType === option.key}
                                onPress={() => setFilter('advanceType', option.key)}
                                s={s}
                            />
                        ))}
                    </FilterGroup>

                    {dairyOptions.length > 1 && (
                        <FilterGroup label="Dairy" s={s}>
                            {['all', ...dairyOptions].map((dairy) => (
                                <Chip
                                    key={dairy}
                                    label={dairy === 'all' ? 'All' : dairy}
                                    active={filters.dairy === dairy}
                                    onPress={() => setFilter('dairy', dairy)}
                                    s={s}
                                />
                            ))}
                        </FilterGroup>
                    )}

                    <FilterGroup label="Show section" s={s}>
                        {SECTION_OPTIONS.map((option) => (
                            <Chip
                                key={option.key}
                                label={option.label}
                                active={filters.section === option.key}
                                onPress={() => setFilter('section', option.key)}
                                s={s}
                            />
                        ))}
                    </FilterGroup>
                </View>
            ) : (
                activeCount > 0 && (
                    <Text style={s.activeFiltersText}>
                        {activeCount} filter{activeCount === 1 ? '' : 's'} active · tap to change
                    </Text>
                )
            )}
        </Box>
    );
}

export default function PortalScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const compact = width < 400;
    const s = createStyles(colors, isDark, width);

    const [session, setSession] = useState<PortalUser | null>(null);
    const [module, setModule] = useState<PortalModule>('collection');
    const [dashboard, setDashboard] = useState<PortalDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
        entries: false,
        payments: false,
        advances: false,
    });
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const scrollRef = useRef<ScrollView | null>(null);
    const filterCardY = useRef(0);

    const setFilter = useCallback((key: keyof Filters, value: any) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

    const toggleSection = useCallback((key: SectionKey) => {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const onFilterLayout = useCallback((event: any) => {
        filterCardY.current = event.nativeEvent.layout.y;
    }, []);

    const openFilters = useCallback(() => {
        setFiltersOpen(true);
        // Bring the expanded filter card into view when the header funnel is tapped.
        setTimeout(() => {
            scrollRef.current?.scrollTo({
                y: Math.max(0, filterCardY.current - 8),
                animated: true,
            });
        }, 0);
    }, []);

    const toggleFilters = useCallback(() => {
        if (filtersOpen) {
            setFiltersOpen(false);
            return;
        }
        openFilters();
    }, [filtersOpen, openFilters]);

    const logout = useCallback(async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        setLogoutModalVisible(false);
        // Do not block navigation on the network call; local session is cleared below.
        void portalApi.logout().catch(() => undefined);
        try {
            await clearPortalSession().catch(() => undefined);
            await clearAuth().catch(() => undefined);
        } finally {
            setLoggingOut(false);
            router.replace('/auth');
        }
    }, [loggingOut]);

    const confirmLogout = useCallback(() => {
        setLogoutModalVisible(true);
    }, []);

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
        void loadDashboard(false);
    }, [session?.phone, sessionKey, module, loadDashboard]);

    useEffect(() => {
        setExpanded({ entries: false, payments: false, advances: false });
    }, [
        filters.search,
        filters.datePreset,
        filters.startDate,
        filters.endDate,
        filters.status,
        filters.mode,
        filters.advanceType,
        filters.dairy,
        filters.section,
    ]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void loadDashboard(true);
    }, [loadDashboard]);

    const switchTo = useCallback((next: PortalModule) => {
        if (!session?.availableModules.includes(next)) return;
        setDashboard(null);
        setError('');
        setFilters(DEFAULT_FILTERS);
        setFiltersOpen(false);
        setExpanded({ entries: false, payments: false, advances: false });
        setModule(next);
    }, [session]);

    const profile = dashboard?.profile || session;
    const summary = dashboard?.summary;
    const entries: PortalEntryRow[] = dashboard?.entries || [];
    const payments: PortalPaymentRow[] = dashboard?.payments || [];
    const advances: PortalAdvanceRow[] = dashboard?.advances || [];
    const available = session?.availableModules || [];
    const isSelling = module === 'selling';

    const dateRange = useMemo(
        () => getDateRange(filters),
        [filters.datePreset, filters.startDate, filters.endDate],
    );

    const matchesDate = useCallback((date?: string) => {
        if (!dateRange?.start && !dateRange?.end) return true;
        const key = localDateKey(date);
        if (!key) return false;
        if (dateRange.start && key < dateRange.start) return false;
        if (dateRange.end && key > dateRange.end) return false;
        return true;
    }, [dateRange]);

    const searchTerm = filters.search.trim().toLowerCase();
    const matchesCommon = useCallback((row: any) => {
        const dairy = row?.dairyName || profile?.dairyName || '';
        if (filters.dairy !== 'all' && dairy !== filters.dairy) return false;
        if (!searchTerm) return true;
        return rowSearchText(row, profile).includes(searchTerm);
    }, [filters.dairy, searchTerm, profile]);

    const filteredEntries = useMemo(() => entries.filter((row) => {
        if (!matchesDate(row.date) || !matchesCommon(row)) return false;
        const paid = String(row.status || '').toLowerCase() === 'paid';
        if (filters.status === 'paid' && !paid) return false;
        if (filters.status === 'pending' && paid) return false;
        return true;
    }), [entries, matchesDate, matchesCommon, filters.status]);

    const filteredPayments = useMemo(() => payments.filter((row) => {
        if (!matchesDate(row.date) || !matchesCommon(row)) return false;
        if (filters.mode !== 'all' && String(row.mode || '').toLowerCase() !== filters.mode) return false;
        return true;
    }), [payments, matchesDate, matchesCommon, filters.mode]);

    const filteredAdvances = useMemo(() => advances.filter((row) => {
        if (!matchesDate(row.date) || !matchesCommon(row)) return false;
        const type = String(row.type || '').toLowerCase();
        const adjusted = type === 'adjusted' || row.direction === 'up' || String(row.status || '').toLowerCase() === 'settled';
        if (filters.advanceType === 'adjusted' && !adjusted) return false;
        if (filters.advanceType === 'given' && adjusted) return false;
        return true;
    }), [advances, matchesDate, matchesCommon, filters.advanceType]);

    const activeCount = useMemo(() => {
        let count = 0;
        if (filters.search.trim()) count += 1;
        if (filters.datePreset !== 'all') count += 1;
        if (filters.status !== 'all') count += 1;
        if (filters.mode !== 'all') count += 1;
        if (filters.advanceType !== 'all') count += 1;
        if (filters.dairy !== 'all') count += 1;
        if (filters.section !== 'all') count += 1;
        return count;
    }, [filters]);

    const dairyOptions = useMemo(() => {
        const set = new Set<string>();
        (profile?.dairyNames || []).forEach((name) => { if (name) set.add(name); });
        [...entries, ...payments, ...advances].forEach((row) => {
            if (row.dairyName) set.add(row.dairyName);
        });
        return Array.from(set).sort();
    }, [profile?.dairyNames, entries, payments, advances]);

    const modeOptions = useMemo(() => {
        const set = new Set<string>(STANDARD_MODES);
        payments.forEach((row) => {
            const mode = String(row.mode || '').toLowerCase();
            if (mode) set.add(mode);
        });
        return Array.from(set);
    }, [payments]);

    const emptyText = activeCount > 0
        ? 'No records match the selected filters.'
        : 'No records found for this mobile number.';

    const displayRows = (rows: any[], key: SectionKey) => {
        const cap = filters.section === 'all' && !expanded[key] ? 5 : 100;
        return rows.slice(0, cap);
    };

    const entryColumns: PortalColumn<PortalEntryRow>[] = [
        {
            key: 'date',
            title: 'Date',
            flex: 1.05,
            align: 'left',
            render: (row) => (
                <TwoLineCell
                    primary={shortDate(row.date)}
                    secondary={compact
                        ? (isSelling ? (row.customerName || profile?.name || '') : (row.farmerName || profile?.name || ''))
                        : yearOf(row.date)}
                    align="left"
                    s={s}
                />
            ),
        },
        {
            key: 'name',
            title: isSelling ? 'Customer' : 'Farmer',
            flex: 1.25,
            align: 'left',
            hideOnCompact: true,
            render: (row) => (
                <CellText align="left" s={s} numberOfLines={1}>
                    {isSelling ? (row.customerName || profile?.name || '--') : (row.farmerName || profile?.name || '--')}
                </CellText>
            ),
        },
        {
            key: 'qtyRate',
            title: 'Qty / Rate',
            flex: 1,
            render: (row) => (
                <TwoLineCell primary={quantity(row.quantity)} secondary={`${money(row.rate)}/L`} s={s} />
            ),
        },
        {
            key: 'amount',
            title: 'Amount',
            flex: 1,
            render: (row) => <CellText bold s={s}>{money(row.amount)}</CellText>,
        },
        {
            key: 'status',
            title: 'Status',
            flex: 0.9,
            render: (row) => <StatusPill status={row.status} colors={colors} s={s} />,
        },
    ];

    const paymentColumns: PortalColumn<PortalPaymentRow>[] = [
        {
            key: 'date',
            title: 'Date',
            flex: 1,
            align: 'left',
            render: (row) => (
                <TwoLineCell primary={shortDate(row.date)} secondary={yearOf(row.date)} align="left" s={s} />
            ),
        },
        {
            key: 'amount',
            title: 'Amount',
            flex: 0.95,
            render: (row) => <CellText bold s={s}>{money(row.amount)}</CellText>,
        },
        {
            key: 'mode',
            title: 'Mode',
            flex: 0.8,
            render: (row) => <CellText s={s}>{row.mode || '--'}</CellText>,
        },
        {
            key: 'remark',
            title: 'Remark',
            flex: 1.7,
            align: 'left',
            render: (row) => (
                <CellText align="left" s={s} numberOfLines={2}>{row.remark || '--'}</CellText>
            ),
        },
        {
            key: 'dairy',
            title: 'Dairy',
            flex: 1.1,
            align: 'left',
            hideOnCompact: true,
            render: (row) => (
                <CellText align="left" s={s} numberOfLines={1}>
                    {row.dairyName || profile?.dairyName || '--'}
                </CellText>
            ),
        },
    ];

    const advanceColumns: PortalColumn<PortalAdvanceRow>[] = [
        {
            key: 'date',
            title: 'Date',
            flex: 1,
            align: 'left',
            render: (row) => (
                <TwoLineCell primary={shortDate(row.date)} secondary={yearOf(row.date)} align="left" s={s} />
            ),
        },
        {
            key: 'type',
            title: 'Type',
            flex: 1.05,
            render: (row) => {
                const up = row.direction === 'up' || row.type === 'Adjusted' || row.status === 'settled';
                const Arrow = up ? ArrowUpRight : ArrowDownLeft;
                const color = up ? colors.success : colors.warning;
                return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 0, flexShrink: 1, maxWidth: '100%' }}>
                        <Arrow size={11} color={color} />
                        <CellText s={s} numberOfLines={1}>{row.type || '--'}</CellText>
                    </View>
                );
            },
        },
        {
            key: 'amount',
            title: 'Amount',
            flex: 0.95,
            render: (row) => <CellText bold s={s}>{money(row.amount)}</CellText>,
        },
        {
            key: 'remark',
            title: 'Remark',
            flex: 1.7,
            align: 'left',
            render: (row) => (
                <CellText align="left" s={s} numberOfLines={2}>{row.remark || '--'}</CellText>
            ),
        },
        {
            key: 'dairy',
            title: 'Dairy',
            flex: 1.1,
            align: 'left',
            hideOnCompact: true,
            render: (row) => (
                <CellText align="left" s={s} numberOfLines={1}>
                    {row.dairyName || profile?.dairyName || '--'}
                </CellText>
            ),
        },
    ];

    const sectionConfigs: Array<{
        key: SectionKey;
        title: string;
        icon: any;
        rows: any[];
        columns: PortalColumn<any>[];
    }> = [
        {
            key: 'entries',
            title: isSelling ? 'Recent Selling Entries' : 'Purchase Entry (Milk)',
            icon: isSelling ? ShoppingCart : Droplets,
            rows: filteredEntries,
            columns: entryColumns,
        },
        {
            key: 'payments',
            title: isSelling ? 'Selling Payment History' : 'Settlement Payment History',
            icon: IndianRupee,
            rows: filteredPayments,
            columns: paymentColumns,
        },
        {
            key: 'advances',
            title: 'Advance History',
            icon: History,
            rows: filteredAdvances,
            columns: advanceColumns,
        },
    ];

    const unavailableNote = available.length === 1
        ? `Only ${available[0] === 'collection' ? 'Collection' : 'Selling'} data is linked to this mobile number. The other switch is unavailable.`
        : '';

    return (
        <View style={s.container}>
            <StatusBar style="light" />

            {/* Flat TopBar-like header, copied from the dairy-owner screens. */}
            <View style={[s.header, { paddingTop: insets.top + 6 }]}>
                <View style={s.headerRow}>
                    <Pressable onPress={confirmLogout} hitSlop={10} style={s.headerBtn}>
                        <ArrowLeft size={20} color={colors.white} />
                    </Pressable>
                    <View style={s.headerTitle}>
                        <Text numberOfLines={1} style={s.headerTitleText}>
                            {isSelling ? 'Selling' : 'Customer Details'}
                        </Text>
                        <Text numberOfLines={1} style={s.headerSub}>Farmer / Customer view</Text>
                    </View>
                    <View style={s.headerActions}>
                        <Pressable onPress={openFilters} hitSlop={6} style={s.headerFilterBtn}>
                            <Filter size={17} color={colors.white} />
                            {!compact && <Text style={s.headerFilterText}>Filters</Text>}
                            {activeCount > 0 && (
                                <View style={s.headerBadge}>
                                    <Text style={s.headerBadgeText}>{activeCount}</Text>
                                </View>
                            )}
                        </Pressable>
                        <Pressable onPress={confirmLogout} hitSlop={10} style={s.headerBtn}>
                            <LogOut size={18} color={colors.white} />
                        </Pressable>
                    </View>
                </View>
            </View>

            <ScrollView
                ref={scrollRef}
                style={s.scroll}
                contentContainerStyle={[s.scrollContent, { paddingBottom: Math.max(insets.bottom + 24, 34) }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            >
                {/* Profile card — same card/border language, no shadow. */}
                <Box style={s.profileCard}>
                    <View style={s.decorCircle} />
                    <View style={s.profileTopRow}>
                        <View style={s.avatar}>
                            <UserRound size={30} color={colors.primary} />
                        </View>
                        <View style={s.profileInfo}>
                            <View style={s.profileNameRow}>
                                <Text numberOfLines={1} style={s.profileName}>
                                    {profile?.name || 'Farmer / Customer'}
                                </Text>
                                <StatusPill status={profile?.status || 'Active'} colors={colors} s={s} />
                            </View>
                            <Text numberOfLines={1} style={s.profileMeta}>
                                {isSelling ? 'Customer Code' : 'Farmer Code'} : {profile?.code || '--'}
                            </Text>
                            <View style={s.profileLine}>
                                <Phone size={12} color={colors.primary} />
                                <Text numberOfLines={1} style={s.profileLineText}>{profile?.phone || '--'}</Text>
                            </View>
                            {!!profile?.address && (
                                <View style={s.profileLine}>
                                    <MapPin size={12} color={colors.primary} />
                                    <Text numberOfLines={1} style={[s.profileLineText, { color: colors.mutedForeground, fontWeight: '500' }]}>
                                        {profile.address}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={s.dairyNote}>
                        <CheckCircle2 size={13} color={colors.primary} />
                        <Text numberOfLines={2} style={s.dairyNoteText}>
                            Linked dairy: {profile?.dairyNames?.join(', ') || profile?.dairyName || 'Dairy'}
                        </Text>
                    </View>
                </Box>

                {/* Collection / Selling switch, styled like the owner SubTabBar. */}
                <View style={s.moduleSwitch}>
                    {(['collection', 'selling'] as PortalModule[]).map((item) => {
                        const enabled = available.includes(item);
                        const active = module === item && enabled;
                        const Icon = item === 'collection' ? Droplets : ShoppingCart;
                        return (
                            <Pressable
                                key={item}
                                onPress={() => switchTo(item)}
                                disabled={!enabled}
                                style={[
                                    s.switchBtn,
                                    active && s.switchBtnActive,
                                    !enabled && { opacity: 0.45 },
                                ]}
                            >
                                <Icon size={15} color={active ? colors.white : enabled ? colors.mutedForeground : colors.mutedForeground} />
                                <Text style={[s.switchText, active && s.switchTextActive]}>
                                    {item === 'collection' ? 'Collection' : 'Selling'}
                                </Text>
                                {!enabled && <Lock size={12} color={colors.mutedForeground} />}
                            </Pressable>
                        );
                    })}
                </View>
                {!!unavailableNote && <Text style={s.unavailableNote}>{unavailableNote}</Text>}

                {/* Summary cards — same gaps/radius as owner screens. */}
                <View style={s.summaryRow}>
                    <SummaryCard
                        label="Today Milk"
                        value={money(summary?.todayMilkAmount)}
                        sub={`${quantity(summary?.todayMilkQuantity)} L today`}
                        icon={isSelling ? ShoppingCart : Droplets}
                        tone="green"
                        colors={colors}
                        s={s}
                    />
                    <SummaryCard
                        label="Advance Pending"
                        value={money(summary?.advancePending)}
                        sub="Isolated ledger"
                        icon={Clock3}
                        tone="orange"
                        colors={colors}
                        s={s}
                    />
                    <SummaryCard
                        label="Current Balance"
                        value={money(summary?.currentBalance)}
                        sub="Read-only"
                        icon={Wallet}
                        tone="wallet"
                        colors={colors}
                        s={s}
                    />
                </View>

                <View onLayout={onFilterLayout} collapsable={false}>
                    <FilterPanel
                        filters={filters}
                        setFilter={setFilter}
                        clearFilters={clearFilters}
                        filtersOpen={filtersOpen}
                        onToggleFilters={toggleFilters}
                        activeCount={activeCount}
                        dairyOptions={dairyOptions}
                        modeOptions={modeOptions}
                        colors={colors}
                        s={s}
                    />
                </View>

                {(loading && !dashboard) ? (
                    <Box style={s.loadingCard}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={s.loadingText}>Loading your linked dairy records...</Text>
                    </Box>
                ) : !!error ? (
                    <Box style={s.errorCard}>
                        <Text style={s.errorText}>{error}</Text>
                        <Pressable onPress={() => void loadDashboard(false)} style={s.retryBtn}>
                            <Text style={s.retryBtnText}>Retry</Text>
                        </Pressable>
                    </Box>
                ) : (
                    <>
                        {sectionConfigs
                            .filter((config) => filters.section === 'all' || filters.section === config.key)
                            .map((config) => {
                                const rows = config.rows;
                                const visible = displayRows(rows, config.key);
                                const showViewAll = filters.section === 'all' && rows.length > 5;
                                const subtitle = `${rows.length} record${rows.length === 1 ? '' : 's'}${rows.length > 100 ? ' • showing 100' : ''}`;
                                return (
                                    <SectionCard
                                        key={config.key}
                                        title={config.title}
                                        subtitle={subtitle}
                                        icon={config.icon}
                                        colors={colors}
                                        s={s}
                                        showViewAll={showViewAll}
                                        expanded={expanded[config.key]}
                                        onToggle={() => toggleSection(config.key)}
                                    >
                                        <PortalTable
                                            columns={config.columns}
                                            rows={visible}
                                            emptyText={emptyText}
                                            compact={compact}
                                            s={s}
                                        />
                                    </SectionCard>
                                );
                            })}

                        <Text style={s.footerNote}>
                            This is a read-only view. Please contact your dairy owner to add or correct any entry.
                        </Text>
                    </>
                )}
            </ScrollView>

            {/* In-app logout confirmation. React Native Web's Alert.alert is a no-op,
                so the header logout icon needs a real modal on every platform. */}
            <Modal
                visible={logoutModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => { if (!loggingOut) setLogoutModalVisible(false); }}
            >
                <View style={s.modalOverlay}>
                    <Pressable
                        disabled={loggingOut}
                        onPress={() => setLogoutModalVisible(false)}
                        style={s.modalScrim}
                    />
                    <Box style={s.logoutModalCard}>
                        <View style={s.logoutModalIcon}>
                            <LogOut size={20} color={colors.destructive} />
                        </View>
                        <Text style={s.logoutModalTitle}>Logout?</Text>
                        <Text style={s.logoutModalBody}>
                            You will need to verify your mobile number again to view your dairy records.
                        </Text>
                        <View style={s.logoutModalActions}>
                            <Pressable
                                disabled={loggingOut}
                                onPress={() => setLogoutModalVisible(false)}
                                style={[s.modalBtn, s.modalBtnCancel]}
                            >
                                <Text style={s.modalCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                disabled={loggingOut}
                                onPress={() => { void logout(); }}
                                style={[s.modalBtn, s.modalBtnLogout]}
                            >
                                {loggingOut ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <Text style={s.modalLogoutText}>Logout</Text>
                                )}
                            </Pressable>
                        </View>
                    </Box>
                </View>
            </Modal>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean, width: number) => {
    const compactFont = width < 380 ? 9.5 : 10.5;
    const compactSub = width < 380 ? 8 : 8.5;
    const tableHeaderBg = isDark ? colors.muted : '#eef2f7';
    const rowAltBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';

    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { flex: 1 },
        scrollContent: { paddingHorizontal: 10, paddingTop: 10, gap: 10 },

        header: {
            backgroundColor: colors.primary,
            paddingHorizontal: 10,
            paddingBottom: 10,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            minHeight: 40,
        },
        headerBtn: {
            width: 38,
            height: 38,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.13)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
        },
        headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        headerFilterBtn: {
            height: 38,
            minWidth: 38,
            paddingHorizontal: 10,
            borderRadius: 11,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            backgroundColor: 'rgba(255,255,255,0.13)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
            position: 'relative',
        },
        headerFilterText: { fontSize: 11, fontWeight: '800', color: colors.white },
        headerBadge: {
            position: 'absolute',
            top: -5,
            right: -5,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            paddingHorizontal: 3,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.primary,
        },
        headerBadgeText: { fontSize: 9, fontWeight: '900', color: colors.primary },
        headerTitle: { flex: 1, alignItems: 'center', minWidth: 0 },
        headerTitleText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
        headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.72)', marginTop: 1 },

        profileCard: { padding: 12, overflow: 'hidden' },
        decorCircle: {
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: colors.primary + '08',
            right: -40,
            top: -45,
        },
        profileTopRow: { flexDirection: 'row', gap: 10 },
        avatar: {
            width: 58,
            height: 58,
            borderRadius: 29,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary + '15',
            borderWidth: 1,
            borderColor: colors.primary + '30',
        },
        profileInfo: { flex: 1, minWidth: 0 },
        profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        profileName: { fontSize: 16, fontWeight: '800', color: colors.foreground, flexShrink: 1 },
        profileMeta: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
        profileLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
        profileLineText: { flex: 1, fontSize: 11.5, fontWeight: '600', color: colors.foreground },
        dairyNote: {
            marginTop: 10,
            padding: 8,
            borderRadius: 8,
            backgroundColor: colors.secondary,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        dairyNoteText: { flex: 1, fontSize: 10, color: colors.foreground },

        moduleSwitch: {
            flexDirection: 'row',
            gap: 6,
            padding: 4,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
        },
        switchBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 6,
            borderRadius: 7,
        },
        switchBtnActive: { backgroundColor: colors.primary },
        switchText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
        switchTextActive: { color: colors.white },
        unavailableNote: { fontSize: 10.5, color: colors.mutedForeground, textAlign: 'center' },

        summaryRow: { flexDirection: 'row', gap: 8 },
        summaryCard: { flex: 1, minWidth: 0, padding: 10 },
        summaryIcon: {
            width: 26,
            height: 26,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6,
        },
        summaryLabel: { fontSize: 9.5, fontWeight: '700', color: colors.mutedForeground },
        summaryValue: { fontSize: 13.5, fontWeight: '900', color: colors.foreground, marginTop: 2 },
        summarySub: { fontSize: 8.5, color: colors.mutedForeground, marginTop: 2 },

        filterCard: { padding: 10, gap: 8 },
        filterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
        filterHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0,
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: colors.primary + '12',
            borderWidth: 1,
            borderColor: colors.primary + '30',
        },
        filterTitle: { fontSize: 13, fontWeight: '800', color: colors.primary },
        filterCountBadge: {
            backgroundColor: colors.primary + '18',
            borderRadius: 999,
            paddingHorizontal: 6,
            paddingVertical: 2,
        },
        filterCountText: { fontSize: 9, fontWeight: '800', color: colors.primary },
        clearBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.muted,
        },
        clearText: { fontSize: 10.5, fontWeight: '700', color: colors.foreground },
        filterHint: { fontSize: 10, color: colors.mutedForeground, marginLeft: 'auto' },
        filterBody: { gap: 10 },
        filterGroup: { gap: 6 },
        filterGroupLabel: {
            fontSize: 10,
            fontWeight: '700',
            color: colors.mutedForeground,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
        },
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
        chip: {
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            maxWidth: '100%',
            flexShrink: 1,
        },
        chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        chipText: { fontSize: 11, fontWeight: '700', color: colors.foreground, flexShrink: 1 },
        chipTextActive: { color: colors.white },
        activeFiltersText: { fontSize: 10, color: colors.mutedForeground, marginTop: 2 },

        sectionCard: { padding: 0, overflow: 'hidden' },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 10,
            paddingVertical: 9,
            backgroundColor: colors.secondary,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        sectionIcon: {
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        sectionTitleWrap: { flex: 1, minWidth: 0 },
        sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.foreground },
        sectionSub: { fontSize: 9.5, color: colors.mutedForeground, marginTop: 1 },
        viewAllBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: colors.primary + '12',
        },
        viewAllText: { fontSize: 10.5, fontWeight: '800', color: colors.primary },
        sectionBody: { padding: 8 },

        tableWrap: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: colors.card,
        },
        tHead: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 7,
            paddingHorizontal: 8,
            backgroundColor: tableHeaderBg,
        },
        tHeadText: {
            fontSize: 9,
            fontWeight: '700',
            color: colors.mutedForeground,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 8,
            paddingHorizontal: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        rowAlt: { backgroundColor: rowAltBg },
        cell: { minWidth: 0, justifyContent: 'center', paddingHorizontal: 1 },
        cellText: {
            fontSize: compactFont,
            fontWeight: '600',
            color: colors.foreground,
            textAlign: 'center',
            flexShrink: 1,
        },
        cellSub: {
            fontSize: compactSub,
            fontWeight: '500',
            color: colors.mutedForeground,
            marginTop: 1,
            textAlign: 'center',
            flexShrink: 1,
        },
        alignLeft: { textAlign: 'left' },
        alignCenter: { textAlign: 'center' },
        alignRight: { textAlign: 'right' },
        bold: { fontWeight: '800' },
        muted: { color: colors.mutedForeground },

        statusPill: {
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 6,
            alignSelf: 'center',
            minWidth: 44,
            alignItems: 'center',
        },
        statusPillText: { fontSize: 9, fontWeight: '800' },

        empty: {
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            borderRadius: 10,
            padding: 16,
            alignItems: 'center',
            backgroundColor: colors.background,
        },
        emptyText: { fontSize: 11, color: colors.mutedForeground, textAlign: 'center' },

        loadingCard: { padding: 20, alignItems: 'center' },
        loadingText: { fontSize: 12, color: colors.mutedForeground, marginTop: 10 },
        errorCard: { padding: 18, alignItems: 'center' },
        errorText: { fontSize: 12, color: colors.mutedForeground, textAlign: 'center' },
        retryBtn: {
            marginTop: 12,
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderRadius: 9,
            backgroundColor: colors.primary,
        },
        retryBtnText: { color: colors.white, fontSize: 12, fontWeight: '800' },
        footerNote: {
            fontSize: 9.5,
            color: colors.mutedForeground,
            textAlign: 'center',
            paddingHorizontal: 12,
        },

        modalOverlay: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
            backgroundColor: 'rgba(0,0,0,0.45)',
        },
        modalScrim: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
        },
        logoutModalCard: {
            width: '100%',
            maxWidth: 340,
            alignSelf: 'center',
            padding: 16,
        },
        logoutModalIcon: {
            width: 44,
            height: 44,
            borderRadius: 12,
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.destructive + '18',
            marginBottom: 10,
        },
        logoutModalTitle: {
            fontSize: 16,
            fontWeight: '800',
            color: colors.foreground,
            textAlign: 'center',
        },
        logoutModalBody: {
            fontSize: 12,
            lineHeight: 17,
            color: colors.mutedForeground,
            textAlign: 'center',
            marginTop: 6,
        },
        logoutModalActions: {
            flexDirection: 'row',
            gap: 8,
            marginTop: 16,
        },
        modalBtn: {
            flex: 1,
            minHeight: 40,
            borderRadius: 10,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        modalBtnCancel: {
            backgroundColor: colors.card,
            borderColor: colors.border,
        },
        modalBtnLogout: {
            backgroundColor: colors.destructive,
            borderColor: colors.destructive,
        },
        modalCancelText: { fontSize: 12, fontWeight: '800', color: colors.foreground },
        modalLogoutText: { fontSize: 12, fontWeight: '800', color: colors.white },
    });
};
