import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { X, Search, Sun, Moon, Check, Calendar as CalendarIcon, Zap, Users } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { sellingEntriesApi, BulkEntryMember, BulkSession, BulkEntryPayloadItem } from '@/lib/milkeyApi';
import { SuccessModal } from './SuccessModal';
import { Calendar } from './Calendar';
import { SubscriptionModal } from './SubscriptionModal';
import { useSubscriptionStore } from '@/lib/subscriptionStore';

interface BulkEntryModalProps {
    isVisible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface BulkRow extends BulkEntryMember {
    included: boolean;
    quantity: string;
    rate: string;
}

export function BulkEntryModal({ isVisible, onClose, onSuccess }: BulkEntryModalProps) {
    const { colors, isDark } = useTheme();

    // State
    const [session, setSession] = useState<BulkSession | null>(null);
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [rows, setRows] = useState<BulkRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempCalendarDate, setTempCalendarDate] = useState<Date | null>(new Date());

    // Success modal
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });

    // Subscription modal
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const { status, fetchStatus } = useSubscriptionStore();

    // Format date without timezone issues
    const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const resetState = () => {
        setSession(null);
        setEntryDate(formatLocalDate(new Date()));
        setRows([]);
        setSearch('');
    };

    // Load bulk list when modal opens
    useEffect(() => {
        if (isVisible) {
            resetState();
        }
    }, [isVisible]);

    // Load members whenever session or date changes
    const loadList = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        try {
            const res = await sellingEntriesApi.bulkList({ date: entryDate, session });
            if (res.success && res.response?.data) {
                setRows(res.response.data.map(m => ({
                    ...m,
                    included: !m.alreadyEntered,
                    quantity: (m.alreadyEntered ? m.existingQuantity : m.defaultQuantity).toString(),
                    rate: (m.alreadyEntered && m.existingRate ? m.existingRate : m.ratePerLiter).toString(),
                })));
            } else {
                setRows([]);
            }
        } catch (error) {
            console.error('Failed to load bulk list:', error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [session, entryDate]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const filteredRows = useMemo(() => {
        if (!search.trim()) return rows;
        const q = search.toLowerCase();
        return rows.filter(r => r.name.toLowerCase().includes(q) || (r.mobile || '').includes(q));
    }, [rows, search]);

    // Rows that will actually be submitted
    const submitRows = useMemo(() =>
        rows.filter(r => r.included && !r.alreadyEntered && (parseFloat(r.quantity) || 0) > 0),
        [rows]
    );

    const totalQuantity = submitRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
    const totalAmount = submitRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0), 0);

    const updateRow = (memberId: string, patch: Partial<BulkRow>) => {
        setRows(prev => prev.map(r => (r.memberId === memberId ? { ...r, ...patch } : r)));
    };

    const toggleRow = (memberId: string) => {
        setRows(prev => prev.map(r => {
            if (r.memberId !== memberId || r.alreadyEntered) return r;
            return { ...r, included: !r.included };
        }));
    };

    const handleSelectSession = (value: BulkSession) => {
        setSession(value);
    };

    const handleDateSelect = (date: Date | null) => {
        if (date) {
            setEntryDate(formatLocalDate(date));
            setTempCalendarDate(date);
        }
        setShowDatePicker(false);
    };

    const handleSubmitAll = async () => {
        if (submitting || !session) return;

        // Check subscription first
        const currentStatus = status || await fetchStatus();
        if (!currentStatus?.hasSelling) {
            setShowSubscriptionModal(true);
            return;
        }

        if (submitRows.length === 0) {
            setSuccessMessage({ title: 'Error', message: 'No entries to submit. Enter a quantity for at least one member.' });
            setShowSuccessModal(true);
            return;
        }

        setSubmitting(true);
        try {
            const entries: BulkEntryPayloadItem[] = submitRows.map(r => ({
                memberId: r.memberId,
                quantity: parseFloat(r.quantity) || 0,
                rate: parseFloat(r.rate) || r.ratePerLiter,
                notes: r.defaultNotes,
            }));

            const res = await sellingEntriesApi.bulkCreate({ date: entryDate, session, entries });
            if (res.success && res.response) {
                const { savedCount, skippedCount } = res.response;
                setSuccessMessage({
                    title: 'Success',
                    message: `${savedCount} ${session} ${savedCount === 1 ? 'entry' : 'entries'} saved${skippedCount ? `, ${skippedCount} skipped (already entered)` : ''}!`
                });
                setShowSuccessModal(true);
            } else {
                setSuccessMessage({ title: 'Error', message: res.message || 'Failed to save bulk entries' });
                setShowSuccessModal(true);
            }
        } catch (error) {
            setSuccessMessage({ title: 'Error', message: 'Failed to save bulk entries' });
            setShowSuccessModal(true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSuccessClose = () => {
        setShowSuccessModal(false);
        if (successMessage.title === 'Success') {
            onSuccess?.();
            onClose();
        }
    };

    const styles = createStyles(colors, isDark);
    const alreadyCount = rows.filter(r => r.alreadyEntered).length;

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable style={styles.closeButton} onPress={onClose}>
                            <X size={24} color={colors.foreground} />
                        </Pressable>
                        <View style={styles.headerCenter}>
                            <Text style={styles.title}>Bulk Quick Entry</Text>
                            <Text style={styles.subtitle}>One session · all members</Text>
                        </View>
                        <View style={styles.placeholder} />
                    </View>

                    {/* Content */}
                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Date selector */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Date</Text>
                            <Pressable style={styles.dateInput} onPress={() => {
                                setTempCalendarDate(new Date(entryDate + 'T00:00:00'));
                                setShowDatePicker(true);
                            }}>
                                <Text style={styles.dateText}>{formatDate(entryDate)}</Text>
                                <CalendarIcon size={16} color={colors.mutedForeground} />
                            </Pressable>
                        </View>

                        {/* Session selector */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Select Session <Text style={{ color: colors.destructive }}>*</Text></Text>
                            <View style={styles.sessionRow}>
                                <Pressable
                                    style={[styles.sessionBtn, session === 'morning' && styles.sessionBtnActiveMorning]}
                                    onPress={() => handleSelectSession('morning')}
                                >
                                    <Sun size={18} color={session === 'morning' ? colors.white : colors.warning} />
                                    <Text style={[styles.sessionBtnText, session === 'morning' && styles.sessionBtnTextActive]}>
                                        Morning
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.sessionBtn, session === 'evening' && styles.sessionBtnActiveEvening]}
                                    onPress={() => handleSelectSession('evening')}
                                >
                                    <Moon size={18} color={session === 'evening' ? colors.white : colors.primary} />
                                    <Text style={[styles.sessionBtnText, session === 'evening' && styles.sessionBtnTextActive]}>
                                        Evening
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* Members list */}
                        {session && (
                            <>
                                <View style={styles.listHeaderRow}>
                                    <View style={styles.listHeaderLeft}>
                                        <Users size={14} color={colors.primary} />
                                        <Text style={styles.listHeaderText}>
                                            Daily Auto Entry Members ({filteredRows.length})
                                        </Text>
                                    </View>
                                    {alreadyCount > 0 && (
                                        <View style={styles.enteredBadge}>
                                            <Check size={10} color={colors.white} />
                                            <Text style={styles.enteredBadgeText}>{alreadyCount} done</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.searchInput}>
                                    <Search size={16} color={colors.mutedForeground} />
                                    <TextInput
                                        style={styles.searchTextInput}
                                        placeholder="Search member..."
                                        value={search}
                                        onChangeText={setSearch}
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>

                                {loading ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="large" color={colors.primary} />
                                        <Text style={styles.loadingText}>Loading members...</Text>
                                    </View>
                                ) : filteredRows.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>
                                            {rows.length === 0
                                                ? 'No members with Daily Auto Entry ON.\nAdd members and enable Daily Auto Entry in the Member tab.'
                                                : 'No members match your search.'}
                                        </Text>
                                    </View>
                                ) : (
                                    filteredRows.map((row) => {
                                        const qty = parseFloat(row.quantity) || 0;
                                        const rt = parseFloat(row.rate) || 0;
                                        const amount = qty * rt;
                                        return (
                                            <Pressable
                                                key={row.memberId}
                                                style={[styles.memberRow, row.alreadyEntered && styles.memberRowDone]}
                                                onPress={() => toggleRow(row.memberId)}
                                            >
                                                <View style={styles.memberRowTop}>
                                                    <View style={styles.memberInfo}>
                                                        <View style={[
                                                            styles.checkbox,
                                                            row.included && !row.alreadyEntered && styles.checkboxChecked
                                                        ]}>
                                                            {(row.included || row.alreadyEntered) && (
                                                                <Check size={12} color={colors.white} />
                                                            )}
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={[styles.memberName, row.alreadyEntered && styles.memberNameDone]} numberOfLines={1}>
                                                                {row.name}
                                                            </Text>
                                                            <Text style={styles.memberMobile}>{row.mobile}</Text>
                                                        </View>
                                                    </View>
                                                    {row.alreadyEntered ? (
                                                        <View style={styles.doneBadge}>
                                                            <Check size={10} color={colors.white} />
                                                            <Text style={styles.doneBadgeText}>Entered</Text>
                                                        </View>
                                                    ) : (
                                                        <Text style={styles.rowAmount}>₹{amount.toFixed(2)}</Text>
                                                    )}
                                                </View>

                                                {!row.alreadyEntered && (
                                                    <View style={styles.memberRowInputs}>
                                                        <View style={styles.qtyWrap}>
                                                            <Text style={styles.inputCaption}>Qty (L)</Text>
                                                            <TextInput
                                                                style={styles.qtyInput}
                                                                value={row.quantity}
                                                                onChangeText={(text) => updateRow(row.memberId, { quantity: text })}
                                                                keyboardType="decimal-pad"
                                                                placeholder="0"
                                                                placeholderTextColor={colors.mutedForeground}
                                                                selectTextOnFocus
                                                            />
                                                        </View>
                                                        <Text style={styles.multiplySign}>×</Text>
                                                        <View style={styles.qtyWrap}>
                                                            <Text style={styles.inputCaption}>Rate (₹/L)</Text>
                                                            <TextInput
                                                                style={styles.qtyInput}
                                                                value={row.rate}
                                                                onChangeText={(text) => updateRow(row.memberId, { rate: text })}
                                                                keyboardType="decimal-pad"
                                                                placeholder="0"
                                                                placeholderTextColor={colors.mutedForeground}
                                                                selectTextOnFocus
                                                            />
                                                        </View>
                                                    </View>
                                                )}
                                            </Pressable>
                                        );
                                    })
                                )}
                            </>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    {session && (
                        <View style={styles.footer}>
                            <View style={styles.summaryRow}>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryValue}>{submitRows.length}</Text>
                                    <Text style={styles.summaryLabel}>Members</Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryValue}>{totalQuantity.toFixed(1)} L</Text>
                                    <Text style={styles.summaryLabel}>Quantity</Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryValue, { color: colors.primary }]}>₹{totalAmount.toFixed(2)}</Text>
                                    <Text style={styles.summaryLabel}>Total Amount</Text>
                                </View>
                            </View>
                            <Pressable
                                style={[styles.submitBtn, (submitting || submitRows.length === 0) && styles.submitBtnDisabled]}
                                onPress={handleSubmitAll}
                                disabled={submitting || submitRows.length === 0}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <>
                                        <Zap size={16} color={colors.white} />
                                        <Text style={styles.submitBtnText}>Submit All Entries</Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    )}
                </View>
            </View>

            {/* Date Picker Modal */}
            <Modal
                visible={showDatePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <View style={styles.datePickerOverlay}>
                    <View style={styles.datePickerModal}>
                        <View style={styles.datePickerHeader}>
                            <Text style={styles.datePickerTitle}>Select Date</Text>
                            <Pressable onPress={() => setShowDatePicker(false)}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                        <View style={{ padding: 12 }}>
                            <Calendar
                                onDateSelect={handleDateSelect}
                                selectedDate={tempCalendarDate}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            <SuccessModal
                isVisible={showSuccessModal}
                onClose={handleSuccessClose}
                title={successMessage.title}
                message={successMessage.message}
                autoClose={successMessage.title === 'Success'}
                duration={1500}
            />

            <SubscriptionModal
                visible={showSubscriptionModal}
                onClose={() => setShowSubscriptionModal(false)}
                title="Subscription Required"
            />
        </Modal>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modal: {
        backgroundColor: colors.card,
        borderRadius: 20,
        width: '100%',
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerCenter: {
        alignItems: 'center',
    },
    closeButton: {
        padding: 4,
    },
    title: {
        fontSize: 17,
        fontWeight: 'bold',
        color: colors.foreground,
    },
    subtitle: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginTop: 1,
    },
    placeholder: {
        width: 32,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 14,
    },
    inputGroup: {
        marginBottom: 14,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 6,
    },
    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 11,
        backgroundColor: colors.background,
    },
    dateText: {
        fontSize: 14,
        color: colors.foreground,
        fontWeight: '500',
    },
    sessionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    sessionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    sessionBtnActiveMorning: {
        backgroundColor: colors.warning,
        borderColor: colors.warning,
    },
    sessionBtnActiveEvening: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    sessionBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
    },
    sessionBtnTextActive: {
        color: colors.white,
    },
    listHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    listHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    listHeaderText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.foreground,
    },
    enteredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: colors.success,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    enteredBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.white,
    },
    searchInput: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: colors.background,
        gap: 8,
        marginBottom: 10,
    },
    searchTextInput: {
        flex: 1,
        fontSize: 14,
        color: colors.foreground,
        padding: 0,
    },
    loadingContainer: {
        paddingVertical: 30,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: colors.mutedForeground,
        fontSize: 13,
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: colors.mutedForeground,
        textAlign: 'center',
        lineHeight: 19,
    },
    memberRow: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
        backgroundColor: colors.background,
    },
    memberRowDone: {
        opacity: 0.65,
        backgroundColor: colors.muted,
    },
    memberRowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    memberInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.card,
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    memberName: {
        fontSize: 13.5,
        fontWeight: '600',
        color: colors.foreground,
    },
    memberNameDone: {
        textDecorationLine: 'line-through',
    },
    memberMobile: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginTop: 1,
    },
    rowAmount: {
        fontSize: 13.5,
        fontWeight: '700',
        color: colors.primary,
        marginLeft: 8,
    },
    doneBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: colors.success,
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 3,
        marginLeft: 8,
    },
    doneBadgeText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: colors.white,
    },
    memberRowInputs: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginTop: 8,
        paddingLeft: 28,
    },
    qtyWrap: {
        flex: 1,
    },
    inputCaption: {
        fontSize: 10,
        color: colors.mutedForeground,
        marginBottom: 3,
        fontWeight: '600',
    },
    qtyInput: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 7,
        paddingHorizontal: 10,
        paddingVertical: 7,
        fontSize: 14,
        fontWeight: '600',
        backgroundColor: colors.card,
        color: colors.foreground,
        textAlign: 'center',
    },
    multiplySign: {
        fontSize: 13,
        color: colors.mutedForeground,
        paddingBottom: 9,
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 14,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '800',
        color: colors.foreground,
    },
    summaryLabel: {
        fontSize: 10,
        color: colors.mutedForeground,
        marginTop: 1,
    },
    summaryDivider: {
        width: 1,
        height: 26,
        backgroundColor: colors.border,
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingVertical: 13,
    },
    submitBtnDisabled: {
        opacity: 0.5,
    },
    submitBtnText: {
        color: colors.white,
        fontSize: 14.5,
        fontWeight: '700',
    },
    // Date picker
    datePickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    datePickerModal: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 20,
        width: '100%',
        overflow: 'hidden',
    },
    datePickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    datePickerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.foreground,
    },
});
