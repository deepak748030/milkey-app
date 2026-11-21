import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    Image,
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
    Check,
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
    PortalModuleProfile,
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

const money = (value: number | string | undefined) => {
    const n = Number(value || 0);
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

// Preserve paise and negative balances in the overview rather than rounding
// them to whole rupees. Missing data stays a dash while the dashboard loads.
const summaryMoney = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(Number(value))) return '--';
    const n = Number(value);
    return `${n < 0 ? '-' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};
const summaryQuantity = (value: number | null | undefined) => (
    value == null || !Number.isFinite(Number(value))
        ? '--'
        : `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`
);

const settlementMoney = (value: number | string | undefined) => {
    const n = Number(value || 0);
    const formatted = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `-₹${formatted}` : `₹${formatted}`;
};

const settlementDate = (value?: string) => {
    if (!value) return '--';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '--' : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const quantity = (value: number | string | undefined) => (
    Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })
);

const portalDate = (value?: string) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// SellingEntry dates represent a UTC calendar day, not a local instant.
const sellingEntryDate = (value?: string) => {
    if (!value) return '--';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '--' : date.toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const longDate = portalDate;
const shortDate = portalDate;

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

const rowSearchText = (row: any, profile?: PortalModuleProfile | null) => [
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
    dense = false,
    numberOfLines = 1,
}: {
    children: React.ReactNode;
    s: any;
    align?: Align;
    bold?: boolean;
    muted?: boolean;
    dense?: boolean;
    numberOfLines?: number;
}) {
    const alignStyle = align === 'left' ? s.alignLeft : align === 'right' ? s.alignRight : s.alignCenter;
    return (
        <Text
            numberOfLines={numberOfLines}
            ellipsizeMode="tail"
            style={[s.cellText, dense && s.entryDenseText, alignStyle, bold && s.bold, muted && s.muted]}
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
    dense = false,
    minTableWidth,
    s,
}: {
    columns: PortalColumn<T>[];
    rows: T[];
    emptyText: string;
    compact: boolean;
    dense?: boolean;
    minTableWidth?: number;
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

    const table = (
        <View style={[s.tableWrap, minTableWidth ? { minWidth: minTableWidth, flex: 1 } : undefined]}>
            <View style={[s.tHead, dense && s.entryDenseHead]}>
                {visibleColumns.map((col) => (
                    <Text
                        key={col.key}
                        numberOfLines={1}
                        style={[
                            s.tHeadText,
                            dense && s.entryDenseHeadText,
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
                <View key={row.id || String(index)} style={[s.row, dense && s.entryDenseRow, index % 2 === 1 && s.rowAlt]}>
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
    return minTableWidth ? (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
            {table}
        </ScrollView>
    ) : table;
}

function CollectionSettlementHistory({
    rows,
    colors,
    s,
    selling,
}: {
    rows: PortalPaymentRow[];
    selling: boolean;
    colors: any;
    s: any;
}) {
    if (!rows.length) {
        return <View style={s.empty}><Text style={s.emptyText}>No settlement payments found.</Text></View>;
    }

    const line = (label: string, amount: number | undefined, color?: string) => (
        <View style={s.settlementLine} key={label}>
            <Text style={s.settlementLabel}>{label}</Text>
            <Text style={[s.settlementValue, color ? { color } : null]}>{settlementMoney(amount || 0)}</Text>
        </View>
    );

    return (
        <View>
            {rows.map((row, index) => {
                const range = row.periodStart && row.periodEnd
                    ? `${settlementDate(row.periodStart)} - ${settlementDate(row.periodEnd)}`
                    : settlementDate(row.date);
                const closing = Number(row.closingBalance || 0);
                return (
                    <View key={row.id} style={s.settlementCard}>
                        <View style={s.settlementCardHeader}>
                            <Text style={s.settlementNumber}>{index + 1}</Text>
                            <Text numberOfLines={1} style={s.settlementMode}>{row.mode || 'Settlement'}</Text>
                            <Text numberOfLines={1} style={s.settlementPeriod}>{range}</Text>
                        </View>
                        <View style={s.settlementDivider} />
                        {!selling && row.entriesAmount != null && row.extraMilkAmount != null && <>
                            {line('Entries Amount:', row.entriesAmount)}
                            {line('Extra Amount:', row.extraMilkAmount)}
                        </>}
                        {line('Milk Amount:', row.totalMilkAmount)}
                        {!selling && (row.entriesAmount == null || row.extraMilkAmount == null) && <Text style={s.settlementLabel}>Breakdown unavailable for this payment</Text>}
                        {line(row.advanceEffect === 'add' ? 'Advance (+):' : 'Advance:', (Number(row.totalAdvanceDeduction) || 0) * (row.advanceEffect === 'add' ? 1 : -1), colors.warning)}
                        {line('Total Payable:', row.netPayable)}
                        {line('Paid Amount:', row.amount, colors.success)}
                        <View style={s.settlementClosing}>
                            <View style={s.settlementBalanceGroup}>
                                <Text style={s.settlementClosingLabel}>Closing Balance:</Text>
                                <Text style={[s.settlementClosingValue, { color: closing < 0 ? colors.destructive : colors.success }]}>{settlementMoney(closing)}</Text>
                            </View>
                            <Text style={s.settlementCreated}>Created: {settlementDate(row.createdAt || row.date)}</Text>
                        </View>
                    </View>
                );
            })}
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
    dense = false,
    children,
}: {
    title: string;
    subtitle: string;
    icon: any;
    colors: any;
    s: any;
    dense?: boolean;
    showViewAll: boolean;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <Box style={s.sectionCard}>
            <View style={[s.sectionHeader, dense && s.entryDenseSectionHeader]}>
                <View style={[s.sectionIcon, dense && s.entryDenseSectionIcon]}>
                    <Icon size={15} color={colors.white} />
                </View>
                <View style={s.sectionTitleWrap}>
                    <Text numberOfLines={1} style={[s.sectionTitle, dense && s.entryDenseSectionTitle]}>{title}</Text>
                    <Text numberOfLines={1} style={[s.sectionSub, dense && s.entryDenseSectionSub]}>{subtitle}</Text>
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
            <View style={[s.sectionBody, dense && s.entryDenseSectionBody]}>{children}</View>
        </Box>
    );
}

function SummaryCard({
    label, shortLabel, value, sub, icon: Icon, tone, colors, isDark, negative = false, last = false, gridWidth, s,
}: {
    label: string;
    shortLabel: string;
    value: string;
    sub?: string;
    icon: any;
    gridWidth: number;
    tone: 'green' | 'orange' | 'balance';
    negative?: boolean;
    last?: boolean;
    colors: any;
    isDark: boolean;
    s: any;
}) {
    const tint = tone === 'orange' ? (isDark ? '#FBBF24' : '#B45309')
        : tone === 'balance' ? (isDark ? '#A78BFA' : '#7C3AED') : colors.primary;
    // Use the measured grid width rather than the window width: the portal can
    // also be embedded in a narrower container. Long amounts may wrap instead
    // of becoming unreadably small or losing digits on web.
    const usableWidth = Math.max(20, gridWidth / 3 - 16);
    const showIcon = usableWidth >= 68;
    const fontFor = (text: string, max: number) => Math.max(10, Math.min(max, Math.floor(usableWidth / (Math.max(text.length, 1) * 0.64) * 10) / 10));
    return (
        <View style={[s.summaryCell, !last && s.summaryDivider]}>
            <View accessible accessibilityRole="text" accessibilityLabel={[label, value, sub].filter(Boolean).join(', ')} style={s.summaryCard}>
                <View style={s.summaryCardHeading}>
                    {showIcon && <View style={[s.summaryIcon, { backgroundColor: tint + '18' }]}><Icon size={12} color={tint} strokeWidth={2.3} /></View>}
                    <Text numberOfLines={1} adjustsFontSizeToFit style={s.summaryLabel}>{shortLabel}</Text>
                </View>
                <Text style={[s.summaryValue, { fontSize: fontFor(value, 14) }, negative && { color: colors.destructive }]}>{value}</Text>
                {!!sub && <Text style={[s.summarySub, { fontSize: fontFor(sub, 10) }]}>{sub}</Text>}
            </View>
        </View>
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

    const [summaryGridWidth, setSummaryGridWidth] = useState(0);
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
    const [loadingMoreAdvances, setLoadingMoreAdvances] = useState(false);
    const [advancePageError, setAdvancePageError] = useState('');
    const dashboardRequest = useRef(0);
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
        const requestId = ++dashboardRequest.current;
        setLoadingMoreAdvances(false);
        setAdvancePageError('');
        if (!isRefresh) setLoading(true);
        setError('');
        const result = await portalApi.getDashboard(module);
        if (requestId !== dashboardRequest.current) return;
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
    useFocusEffect(useCallback(() => {
        if (!session?.phone || !session.availableModules.includes(module)) return;
        void loadDashboard(false);
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void loadDashboard(true);
        });
        return () => {
            subscription.remove();
            ++dashboardRequest.current;
        };
    }, [session?.phone, sessionKey, module, loadDashboard]));

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
        if (next === module || !session?.availableModules.includes(next)) return;
        ++dashboardRequest.current;
        setDashboard(null);
        setLoading(true);
        setRefreshing(false);
        setLoadingMoreAdvances(false);
        setAdvancePageError('');
        setError('');
        setFilters(DEFAULT_FILTERS);
        setFiltersOpen(false);
        setExpanded({ entries: false, payments: false, advances: false });
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        setModule(next);
    }, [module, session]);

    const loadMoreAdvances = useCallback(async () => {
        const cursor = dashboard?.advancePage?.nextCursor;
        if (!cursor || loadingMoreAdvances) return;
        const requestId = dashboardRequest.current;
        setExpanded((current) => ({ ...current, advances: true }));
        setLoadingMoreAdvances(true);
        setAdvancePageError('');
        const result = await portalApi.getAdvances(module, cursor);
        if (requestId !== dashboardRequest.current) return;
        if (result.success && result.response) {
            const page = result.response;
            setDashboard((current) => {
                if (!current || current.module !== module) return current;
                const ids = new Set(current.advances.map((row) => row.id));
                return {
                    ...current,
                    advances: [...current.advances, ...page.advances.filter((row) => !ids.has(row.id))],
                    advancePage: { total: current.advancePage?.total ?? current.advances.length, nextCursor: page.nextCursor },
                };
            });
        } else if (result.status === 401 || result.code === 'INVALID_PORTAL_SESSION' || result.code === 'PORTAL_SESSION_REQUIRED') {
            await clearPortalSession();
            router.replace('/auth');
        } else {
            setAdvancePageError(result.message || 'Could not load more advances.');
        }
        setLoadingMoreAdvances(false);
    }, [dashboard?.advancePage?.nextCursor, loadingMoreAdvances, module]);

    const profile = dashboard?.profile || session?.moduleProfiles?.[module] || session;
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
        if ((isSelling && row.date && dateRange ? ((dateRange.start && row.date.slice(0, 10) < dateRange.start) || (dateRange.end && row.date.slice(0, 10) > dateRange.end)) : !matchesDate(row.date)) || !matchesCommon(row)) return false;
        const paid = String(row.status || '').toLowerCase() === 'paid';
        if (filters.status === 'paid' && !paid) return false;
        if (filters.status === 'pending' && paid) return false;
        return true;
    }), [entries, matchesDate, matchesCommon, filters.status, isSelling, dateRange]);

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
        if (key === 'advances' && isSelling && !expanded[key]) return rows.slice(0, 3);
        if (key === 'payments') return rows.slice(0, 1);
        if (key === 'advances' && expanded[key]) return rows;
        const cap = filters.section === 'all' && !expanded[key] ? 5 : 100;
        return rows.slice(0, cap);
    };

    const entryColumns: PortalColumn<PortalEntryRow>[] = isSelling ? [
        { key: 'date', title: 'Date', flex: 1.2, render: (row) => <CellText s={s} dense numberOfLines={1}>{sellingEntryDate(row.date)}</CellText> },
        { key: 'quantity', title: 'M + E (L)', flex: 1.35, render: (row) => <CellText s={s} dense numberOfLines={1}>{`${Number(row.morningQuantity || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} + ${Number(row.eveningQuantity || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}`}</CellText> },
        { key: 'rate', title: 'Rate', flex: 0.8, render: (row) => <CellText s={s} dense>{money(row.rate)}</CellText> },
        { key: 'amount', title: 'Amount', flex: 1, render: (row) => <CellText s={s} dense bold>{money(row.amount)}</CellText> },
        { key: 'paid', title: 'Paid', flex: 0.6, render: (row) => {
            const paid = String(row.status || '').trim().toLowerCase() === 'paid';
            return <View accessible accessibilityRole="text" accessibilityLabel={paid ? 'Paid' : 'Not paid'} style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>{paid ? <Check size={14} color={colors.success} strokeWidth={3} /> : null}</View>;
        } },
    ] : [
        {
            key: 'date',
            title: 'Date',
            flex: 1.2,
            render: (row) => <CellText s={s} dense numberOfLines={1}>{shortDate(row.date)}</CellText>,
        },
        {
            key: 'quantity',
            title: 'Milk',
            flex: 0.62,
            render: (row) => <CellText s={s} dense numberOfLines={1}>{quantity(row.quantity)}</CellText>,
        },
        {
            key: 'fat',
            title: 'FAT',
            flex: 0.52,
            render: (row) => <CellText s={s} dense numberOfLines={1}>{row.fat == null ? '--' : quantity(row.fat)}</CellText>,
        },
        {
            key: 'snf',
            title: 'SNF',
            flex: 0.52,
            render: (row) => <CellText s={s} dense numberOfLines={1}>{row.snf == null ? '--' : quantity(row.snf)}</CellText>,
        },
        {
            key: 'rate',
            title: 'Rate',
            flex: 0.67,
            render: (row) => <CellText s={s} dense numberOfLines={1}>{quantity(row.rate)}</CellText>,
        },
        {
            key: 'bonus',
            title: 'Bonus',
            flex: 0.72,
            render: (row) => {
                if (!(Number(row.bonusAmount) > 0)) return <CellText s={s} dense>--</CellText>;
                const value = Number(row.bonusRate) > 0
                    ? row.bonusType === 'percent'
                        ? `+${quantity(row.bonusRate)}%`
                        : `+${quantity(row.bonusRate)}/L`
                    : `+${money(row.bonusAmount)}`;
                return <CellText s={s} dense numberOfLines={1}>{value}</CellText>;
            },
        },
        {
            key: 'amount',
            title: 'Amt',
            flex: 1,
            render: (row) => <CellText bold s={s} dense>{money(row.amount)}</CellText>,
        },
        {
            key: 'paid',
            title: 'Paid',
            flex: 0.55,
            render: (row) => {
                const paid = String(row.status || '').trim().toLowerCase() === 'paid';
                return (
                    <View accessible accessibilityRole="text" accessibilityLabel={paid ? 'Paid' : 'Not paid'} style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                        {paid ? <Check size={14} color={colors.success} strokeWidth={3} /> : null}
                    </View>
                );
            },
        },
    ];

    const paymentColumns: PortalColumn<PortalPaymentRow>[] = [
        {
            key: 'date',
            title: 'Date',
            flex: 1,
            align: 'left',
            render: (row) => (
                <CellText align="left" s={s}>{shortDate(row.date)}</CellText>
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
            key: 'name',
            title: 'Name',
            flex: 1.3,
            render: (row) => (
                <View>
                    <CellText s={s} dense numberOfLines={1}>{row.farmerName || row.customerName || profile?.name || '--'}</CellText>
                    {dairyOptions.length > 1 && <CellText s={s} dense numberOfLines={1}>{row.dairyName || 'Dairy'}</CellText>}
                </View>
            ),
        },
        {
            key: 'note',
            title: 'Note',
            flex: 1,
            render: (row) => <CellText s={s} dense numberOfLines={1}>{row.remark || 'Advance'}</CellText>,
        },
        {
            key: 'amount',
            title: 'Amt',
            flex: 0.75,
            render: (row) => <CellText bold s={s} dense>{money(row.amount)}</CellText>,
        },
        {
            key: 'date',
            title: 'Date',
            flex: 0.9,
            render: (row) => <CellText s={s} dense numberOfLines={1}>{shortDate(row.date)}</CellText>,
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
            title: isSelling ? 'Selling Entries' : 'Collection Entries',
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
            title: isSelling ? 'Advance History' : 'Pending Advances',
            icon: History,
            rows: filteredAdvances,
            columns: advanceColumns,
        },
    ];

    return (
        <View style={s.container}>
            <StatusBar style="light" />

            {/* Flat TopBar-like header, copied from the dairy-owner screens. */}
            <View style={[s.header, { paddingTop: insets.top + 6 }]}>
                <View style={s.headerRow}>
                    <View style={s.headerTitle}>
                        <Text numberOfLines={1} style={s.headerTitleText}>
                            {isSelling ? 'Selling' : 'Customer Details'}
                        </Text>
                        <Text numberOfLines={1} style={s.headerSub}>Farmer / Customer view</Text>
                    </View>
                    <View style={s.headerActions}>
                        <Pressable onPress={confirmLogout} hitSlop={10} style={s.headerBtn}>
                            <LogOut size={18} color={colors.white} />
                        </Pressable>
                    </View>
                </View>
            </View>

            <ScrollView
                ref={scrollRef}
                style={s.scroll}
                contentContainerStyle={[s.scrollContent, { paddingBottom: 24 }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            >
                <View style={s.topInfoStack}>
                    <LinearGradient colors={isDark ? ['#184C36', '#0E3225', '#12603B'] : ['#B8F3C5', '#E9F8EA', '#22A851']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.profileCard}>
                        <View pointerEvents="none" style={s.decorCircle} />
                        <View style={s.profileTopRow}>
                            <Image source={require('@/assets/images/customer-avatar-fair.jpg')} style={s.avatar} />
                            <View style={s.profileInfo}>
                                <View style={s.profileHeadingRow}>
                                    <View style={s.profileNameRow}>
                                        <Text numberOfLines={1} style={s.profileName}>{profile?.name || 'Farmer / Customer'}</Text>
                                        <StatusPill status={profile?.status || 'Active'} colors={colors} s={s} />
                                    </View>
                                </View>
                                <View style={s.profileDetails}>
                                    <Text style={s.profileMeta}>{isSelling ? 'Customer Code' : 'Farmer Code'}: {profile?.code || '--'}</Text>
                                    <View style={s.profileLine}>
                                        <Phone size={11} color={colors.primary} />
                                        <Text style={s.profileLineText}>{profile?.phone || '--'}</Text>
                                    </View>
                                    {!!profile?.address && (
                                        <View style={s.profileLine}>
                                            <MapPin size={11} color={colors.primary} />
                                            <Text numberOfLines={1} style={[s.profileLineText, { color: colors.mutedForeground, fontWeight: '500' }]}>{profile.address}</Text>
                                        </View>
                                    )}
                                    {isSelling && (
                                        <Text style={s.profileMeta}>
                                            Milk Rate: {profile?.milkRate != null && Number.isFinite(Number(profile.milkRate)) ? `₹${Number(profile.milkRate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/L` : '--'}
                                        </Text>
                                    )}
                                </View>
                                <View accessible accessibilityLabel={`Linked by ${profile?.linkedDairyNames?.join(', ') || profile?.dairyNames?.join(', ') || profile?.dairyName || 'Dairy'}`} style={s.profileDairy}>
                                    <Text style={s.profileDairyLabel}>LINKED BY</Text>
                                    <Text numberOfLines={2} style={s.profileDairyName}>{profile?.linkedDairyNames?.join(', ') || profile?.dairyNames?.join(', ') || profile?.dairyName || 'Dairy'}</Text>
                                </View>
                            </View>
                        </View>
                        <View style={s.summaryGrid} onLayout={(event) => setSummaryGridWidth(event.nativeEvent.layout.width)}>
                            <SummaryCard
                                label={isSelling ? 'Today selling' : 'Today collection'} shortLabel="Today" gridWidth={summaryGridWidth || Math.max(0, width - 50)}
                                value={summaryQuantity(summary?.todayMilkQuantity)}
                                sub={summary ? summaryMoney(summary.todayMilkAmount) : '--'}
                                icon={isSelling ? ShoppingCart : Droplets}
                                tone="green" colors={colors} isDark={isDark} s={s}
                            />
                            <SummaryCard
                                label="Advance pending" shortLabel="Advance" gridWidth={summaryGridWidth || Math.max(0, width - 50)}
                                value={summary ? summaryMoney(summary.advancePending) : '--'}
                                icon={Clock3} tone="orange" colors={colors} isDark={isDark} s={s}
                            />
                            <SummaryCard
                                label="Current balance" shortLabel="Balance" gridWidth={summaryGridWidth || Math.max(0, width - 50)}
                                value={summary ? summaryMoney(summary.currentBalance) : '--'}
                                icon={Wallet} tone="balance" last negative={!!summary && summary.currentBalance < 0} colors={colors} isDark={isDark} s={s}
                            />
                        </View>
                    </LinearGradient>
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
                                const showViewAll = config.key === 'entries' || config.key === 'payments'
                                    ? true
                                    : config.key === 'advances'
                                        ? rows.length > (isSelling ? 3 : 5)
                                        : filters.section === 'all' && rows.length > 5;
                                const advancePage = config.key === 'advances' ? dashboard?.advancePage : undefined;
                                const subtitle = advancePage?.nextCursor
                                    ? `${rows.length} loaded • ${advancePage.total} total`
                                    : `${rows.length} record${rows.length === 1 ? '' : 's'}${config.key !== 'advances' && rows.length > 100 ? ' • showing 100' : ''}`;
                                return (
                                    <SectionCard
                                        key={config.key}
                                        title={config.title}
                                        subtitle={subtitle}
                                        icon={config.icon}
                                        colors={colors}
                                        s={s}
                                        dense={config.key === 'entries' || config.key === 'advances'}
                                        showViewAll={showViewAll}
                                        expanded={config.key === 'entries' || config.key === 'payments' ? false : expanded[config.key]}
                                        onToggle={() => {
                                            if (config.key === 'entries') {
                                                const range = filters.datePreset === 'custom'
                                                    ? { start: filters.startDate || undefined, end: filters.endDate || undefined }
                                                    : getDateRange(filters);
                                                const reversed = !!range?.start && !!range?.end && range.start > range.end;
                                                const start = reversed ? range?.end : range?.start;
                                                const end = reversed ? range?.start : range?.end;
                                                (router as any).push({ pathname: isSelling ? '/portal-selling-entries' : '/portal-collection-entries', params: {
                                                    ...(start ? { startDate: start } : {}),
                                                    ...(end ? { endDate: end } : {}),
                                                } });
                                            } else if (config.key === 'payments') {
                                                (router as any).push(isSelling ? '/portal-selling-payments' : '/portal-settlement-payments');
                                            } else toggleSection(config.key);
                                        }}
                                    >
                                        {config.key === 'payments' ? (
                                            <CollectionSettlementHistory rows={visible as PortalPaymentRow[]} colors={colors} s={s} selling={isSelling} />
                                        ) : (
                                            <PortalTable
                                                columns={config.columns}
                                                rows={visible}
                                                emptyText={emptyText}
                                                compact={compact}
                                                dense={config.key === 'entries' || config.key === 'advances'}
                                                minTableWidth={config.key === 'entries' ? 300 : undefined}
                                                s={s}
                                            />
                                        )}
                                        {advancePage?.nextCursor && (
                                            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                                                {!!advancePageError && <Text style={{ color: colors.destructive, marginBottom: 6 }}>{advancePageError}</Text>}
                                                <Pressable onPress={() => void loadMoreAdvances()} disabled={loadingMoreAdvances}>
                                                    {loadingMoreAdvances ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: '700' }}>Load more advances</Text>}
                                                </Pressable>
                                            </View>
                                        )}
                                    </SectionCard>
                                );
                            })}

                    </>
                )}
            </ScrollView>

            {/* Portal-only bottom navigation; never enters the dairy-owner tabs. */}
            <View accessibilityRole="tablist" style={[s.portalTabBar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
                {(['collection', 'selling'] as PortalModule[]).map((item) => {
                    const enabled = available.includes(item);
                    const active = module === item && enabled;
                    const label = item === 'collection' ? 'My milk' : 'My purchase';
                    const Icon = item === 'collection' ? Droplets : ShoppingCart;
                    return (
                        <Pressable
                            key={item}
                            accessibilityRole="tab"
                            accessibilityLabel={label}
                            accessibilityState={{ selected: active, disabled: !enabled }}
                            accessibilityHint={enabled ? `Show ${label} records` : `${label} is not linked to this mobile number`}
                            onPress={() => switchTo(item)}
                            disabled={!enabled}
                            style={[s.portalTab, !enabled && s.portalTabDisabled]}
                        >
                            <View style={[s.portalTabIcon, active && s.portalTabIconActive]}>
                                <Icon size={21} color={active ? colors.white : colors.mutedForeground} />
                                {!enabled && <Lock size={11} color={colors.mutedForeground} style={s.portalTabLock} />}
                            </View>
                            <Text style={[s.portalTabLabel, active && s.portalTabLabelActive]}>{label}</Text>
                        </Pressable>
                    );
                })}
            </View>

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
        scrollContent: { paddingHorizontal: 10, paddingTop: 1, gap: 10 },

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

        topInfoStack: { gap: 6 },
        profileCard: { padding: 8, overflow: 'hidden', borderRadius: 16 },
        decorCircle: {
            position: 'absolute', width: 180, height: 180, borderRadius: 90,
            backgroundColor: isDark ? 'rgba(120,220,150,0.08)' : 'rgba(255,255,255,0.22)', right: -70, top: -100,
        },
        profileTopRow: {
            flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8,
            borderRadius: 12, padding: 10,
            backgroundColor: isDark ? 'rgba(15,35,26,0.85)' : 'rgba(255,255,255,0.86)',
        },
        avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary + '15', borderWidth: 2, borderColor: colors.primary },
        profileInfo: { flex: 1, minWidth: 0 },
        profileHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
        profileNameRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
        profileName: { fontSize: 16, fontWeight: '800', color: colors.foreground, flexShrink: 1 },
        profileDetails: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4, marginTop: 5 },
        profileMeta: { fontSize: 11, color: colors.mutedForeground, fontWeight: '600' },
        profileLine: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
        profileLineText: { flexShrink: 1, fontSize: 11, fontWeight: '600', color: colors.foreground },
        profileDairy: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 6, minWidth: 0 },
        profileDairyLabel: { fontSize: 9, fontWeight: '800', color: colors.primary, letterSpacing: 0.3 },
        profileDairyName: { flex: 1, fontSize: 10, fontWeight: '700', color: colors.foreground },
        summaryGrid: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, paddingVertical: 8, overflow: 'hidden' },
        summaryCell: { flex: 1, minWidth: 0, paddingHorizontal: 6 },
        summaryDivider: { borderRightWidth: 1, borderRightColor: colors.primary + '45' },
        summaryCard: { flex: 1, minHeight: 52 },
        summaryCardHeading: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        summaryIcon: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
        summaryLabel: { flex: 1, fontSize: 10, fontWeight: '700', color: colors.mutedForeground },
        summaryValue: { fontWeight: '900', color: colors.foreground, marginTop: 4 },
        summarySub: { fontWeight: '600', color: colors.mutedForeground, marginTop: 1 },

        portalTabBar: {
            flexDirection: 'row',
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 5,
        },
        portalTab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2 },
        portalTabDisabled: { opacity: 0.45 },
        portalTabIcon: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
        portalTabIconActive: { backgroundColor: colors.primary },
        portalTabLock: { position: 'absolute', right: -3, bottom: -1 },
        portalTabLabel: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
        portalTabLabelActive: { color: colors.primary, fontWeight: '800' },

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
        entryDenseSectionHeader: { gap: 5, paddingHorizontal: 7, paddingVertical: 5 },
        entryDenseSectionIcon: { width: 23, height: 23, borderRadius: 6 },
        entryDenseSectionTitle: { fontSize: 12 },
        entryDenseSectionSub: { fontSize: 8, marginTop: 0 },
        entryDenseSectionBody: { padding: 5 },
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
        entryDenseHead: { gap: 1, paddingVertical: 4, paddingHorizontal: 4 },
        entryDenseHeadText: { fontSize: 8, letterSpacing: 0 },
        entryDenseRow: { gap: 1, paddingVertical: 7, paddingHorizontal: 4 },
        entryDenseText: { fontSize: 9 },
        settlementCard: { padding: 8, marginBottom: 7, borderWidth: 1, borderColor: colors.primary + '20', borderRadius: 9, backgroundColor: colors.card },
        settlementCardHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 22, gap: 5 },
        settlementNumber: { fontSize: 11, fontWeight: '900', color: colors.primary },
        settlementMode: { flex: 1, fontSize: 10, fontWeight: '800', color: colors.foreground },
        settlementPeriod: { maxWidth: '58%', fontSize: 9, color: colors.mutedForeground, textAlign: 'right' },
        settlementDivider: { height: 1, backgroundColor: colors.primary + '55', marginVertical: 4 },
        settlementLine: { minHeight: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        settlementLabel: { fontSize: 9.5, color: colors.mutedForeground },
        settlementValue: { fontSize: 10, fontWeight: '700', color: colors.foreground },
        settlementClosing: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5, marginTop: 3, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border },
        settlementBalanceGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        settlementClosingLabel: { fontSize: 9, fontWeight: '800', color: colors.mutedForeground },
        settlementCreated: { flex: 1, fontSize: 7.5, color: colors.mutedForeground, textAlign: 'right' },
        settlementClosingValue: { fontSize: 9.5, fontWeight: '900' },
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
