import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { X, Search, Check, Plus, Calendar as CalendarIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { membersApi, sellingEntriesApi, Member } from '@/lib/milkeyApi';
import { getAuthToken } from '@/lib/authStore';
import { SuccessModal } from './SuccessModal';
import { Calendar } from './Calendar';
import { SubscriptionModal } from './SubscriptionModal';
import { useSubscriptionStore } from '@/lib/subscriptionStore';

interface QuickEntryModalProps {
    isVisible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function QuickEntryModal({ isVisible, onClose, onSuccess }: QuickEntryModalProps) {
    const { colors, isDark } = useTheme();

    // State
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingEntry, setSavingEntry] = useState(false);
    const [searchMember, setSearchMember] = useState('');
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [mornQty, setMornQty] = useState('');
    const [eveQty, setEveQty] = useState('');
    const [rate, setRate] = useState('50');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempCalendarDate, setTempCalendarDate] = useState<Date | null>(new Date());

    // Success modal
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });

    // Subscription modal
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const { status, fetchStatus } = useSubscriptionStore();

    // Load members when modal opens
    useEffect(() => {
        if (isVisible) {
            loadMembers();
            resetForm();
        }
    }, [isVisible]);

    const loadMembers = async () => {
        const token = await getAuthToken();
        if (!token) return;

        setLoading(true);
        try {
            const res = await membersApi.getAll();
            if (res.success) {
                setMembers(res.response?.data || []);
            }
        } catch (error) {
            console.error('Failed to load members:', error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSearchMember('');
        setSelectedMember(null);
        setEntryDate(new Date().toISOString().split('T')[0]);
        setMornQty('');
        setEveQty('');
        setRate('50');
        setShowSuggestions(false);
    };

    // Filtered members for search
    const filteredMembers = useMemo(() => {
        if (!searchMember.trim()) return members.slice(0, 10);
        const query = searchMember.toLowerCase();
        return members.filter(m => m.name.toLowerCase().includes(query)).slice(0, 10);
    }, [members, searchMember]);

    const totalQuantity = (parseFloat(mornQty) || 0) + (parseFloat(eveQty) || 0);
    const totalAmount = totalQuantity * (parseFloat(rate) || 0);

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

    const handleSelectMember = (member: Member) => {
        setSelectedMember(member);
        setSearchMember(member.name);
        setRate(member.ratePerLiter?.toString() || '50');
        setShowSuggestions(false);
    };

    const handleSaveEntry = async () => {
        if (savingEntry) return;

        // Check subscription first
        const currentStatus = status || await fetchStatus();
        if (!currentStatus?.hasSelling) {
            setShowSubscriptionModal(true);
            return;
        }

        if (!selectedMember) {
            setSuccessMessage({ title: 'Error', message: 'Please select a member first' });
            setShowSuccessModal(true);
            return;
        }

        const morn = parseFloat(mornQty) || 0;
        const eve = parseFloat(eveQty) || 0;
        if (morn <= 0 && eve <= 0) {
            setSuccessMessage({ title: 'Error', message: 'Please enter morning or evening quantity' });
            setShowSuccessModal(true);
            return;
        }

        setSavingEntry(true);
        try {
            const res = await sellingEntriesApi.create({
                memberId: selectedMember._id,
                morningQuantity: morn,
                eveningQuantity: eve,
                rate: parseFloat(rate) || selectedMember.ratePerLiter,
                date: entryDate,
            });
            if (res.success) {
                setSuccessMessage({ title: 'Success', message: 'Entry saved successfully!' });
                setShowSuccessModal(true);
            } else {
                setSuccessMessage({ title: 'Error', message: res.message || 'Failed to save entry' });
                setShowSuccessModal(true);
            }
        } catch (error) {
            setSuccessMessage({ title: 'Error', message: 'Failed to save entry' });
            setShowSuccessModal(true);
        } finally {
            setSavingEntry(false);
        }
    };

    const handleSuccessClose = () => {
        setShowSuccessModal(false);
        if (successMessage.title === 'Success') {
            resetForm();
            onSuccess?.();
            onClose();
        }
    };

    const handleDateSelect = (date: Date | null) => {
        if (date) {
            setEntryDate(formatLocalDate(date));
            setTempCalendarDate(date);
        }
        setShowDatePicker(false);
    };

    const styles = createStyles(colors, isDark);

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable style={styles.closeButton} onPress={onClose}>
                            <X size={24} color={colors.foreground} />
                        </Pressable>
                        <Text style={styles.title}>Quick Entry</Text>
                        <View style={styles.placeholder} />
                    </View>

                    {/* Content */}
                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={styles.loadingText}>Loading members...</Text>
                            </View>
                        ) : (
                            <>
                                {/* Member Search */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Member (Customer)</Text>
                                    <Pressable
                                        style={styles.searchInput}
                                        onPress={() => setShowSuggestions(true)}
                                    >
                                        <Search size={16} color={colors.mutedForeground} />
                                        <TextInput
                                            style={styles.searchTextInput}
                                            placeholder="Search member by name..."
                                            value={searchMember}
                                            onChangeText={(text) => {
                                                setSearchMember(text);
                                                setShowSuggestions(true);
                                                if (selectedMember) setSelectedMember(null);
                                            }}
                                            onFocus={() => setShowSuggestions(true)}
                                            placeholderTextColor={colors.mutedForeground}
                                        />
                                        {selectedMember && (
                                            <View style={styles.selectedBadge}>
                                                <Check size={12} color={colors.white} />
                                            </View>
                                        )}
                                        {selectedMember && (
                                            <Pressable onPress={() => { setSelectedMember(null); setSearchMember(''); }}>
                                                <X size={16} color={colors.destructive} />
                                            </Pressable>
                                        )}
                                    </Pressable>

                                    {/* Suggestions Dropdown */}
                                    {showSuggestions && (
                                        <View style={styles.suggestionDropdown}>
                                            <ScrollView
                                                style={{ maxHeight: 150 }}
                                                nestedScrollEnabled
                                                keyboardShouldPersistTaps="handled"
                                            >
                                                {filteredMembers.map(member => (
                                                    <Pressable
                                                        key={member._id}
                                                        style={styles.suggestionItem}
                                                        onPress={() => handleSelectMember(member)}
                                                    >
                                                        <Text style={styles.suggestionName}>{member.name}</Text>
                                                        <Text style={styles.suggestionRate}>₹{member.ratePerLiter}/L</Text>
                                                    </Pressable>
                                                ))}
                                                {filteredMembers.length === 0 && (
                                                    <View style={styles.emptyContainer}>
                                                        <Text style={styles.emptyText}>No members found</Text>
                                                    </View>
                                                )}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>

                                {/* Date and Quantities Row */}
                                <View style={styles.row}>
                                    <View style={[styles.inputGroup, { flex: 1 }]}>
                                        <Text style={styles.label}>Date</Text>
                                        <Pressable style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                                            <Text style={styles.dateText}>{formatDate(entryDate)}</Text>
                                            <CalendarIcon size={16} color={colors.mutedForeground} />
                                        </Pressable>
                                    </View>
                                    <View style={[styles.inputGroup, { flex: 0.75 }]}>
                                        <Text style={styles.label}>Morn (L)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={mornQty}
                                            onChangeText={setMornQty}
                                            keyboardType="decimal-pad"
                                            placeholder="0"
                                            placeholderTextColor={colors.mutedForeground}
                                        />
                                    </View>
                                    <View style={[styles.inputGroup, { flex: 0.75 }]}>
                                        <Text style={styles.label}>Eve (L)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={eveQty}
                                            onChangeText={setEveQty}
                                            keyboardType="decimal-pad"
                                            placeholder="0"
                                            placeholderTextColor={colors.mutedForeground}
                                        />
                                    </View>
                                </View>

                                {/* Total and Save */}
                                <View style={styles.totalRow}>
                                    <View style={styles.totalBox}>
                                        <Text style={styles.totalLabel}>Total</Text>
                                        <Text style={styles.totalValue}>₹{totalAmount.toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.buttonRow}>
                                        <Pressable
                                            style={[styles.saveBtn, savingEntry && styles.saveBtnDisabled]}
                                            onPress={handleSaveEntry}
                                            disabled={savingEntry}
                                        >
                                            {savingEntry ? (
                                                <ActivityIndicator size="small" color={colors.white} />
                                            ) : (
                                                <Text style={styles.saveBtnText}>Save Entry</Text>
                                            )}
                                        </Pressable>
                                        <Pressable
                                            style={styles.clearBtn}
                                            onPress={resetForm}
                                            disabled={savingEntry}
                                        >
                                            <Text style={styles.clearBtnText}>Clear</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </>
                        )}
                    </ScrollView>
                </View>
            </View>

            {/* Date Picker Modal */}
            <Modal
                visible={showDatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <View style={styles.datePickerOverlay}>
                    <View style={styles.datePickerModal}>
                        <View style={styles.datePickerHeader}>
                            <Pressable onPress={() => setShowDatePicker(false)}>
                                <X size={24} color={colors.foreground} />
                            </Pressable>
                            <Text style={styles.datePickerTitle}>Select Date</Text>
                            <View style={{ width: 24 }} />
                        </View>
                        <Calendar
                            selectedDate={tempCalendarDate}
                            onDateSelect={handleDateSelect}
                        />
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
        justifyContent: 'flex-end',
    },
    modal: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    closeButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.foreground,
    },
    placeholder: {
        width: 32,
    },
    content: {
        padding: 16,
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: colors.mutedForeground,
        fontSize: 14,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 6,
    },
    searchInput: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: colors.background,
        gap: 8,
    },
    searchTextInput: {
        flex: 1,
        fontSize: 14,
        color: colors.foreground,
        padding: 0,
    },
    selectedBadge: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    suggestionDropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: colors.card,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        marginTop: 4,
        zIndex: 1000,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    suggestionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    suggestionName: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.foreground,
    },
    suggestionRate: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    emptyContainer: {
        padding: 16,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: colors.mutedForeground,
    },
    row: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: colors.background,
    },
    dateText: {
        fontSize: 14,
        color: colors.foreground,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 14,
        backgroundColor: colors.background,
        color: colors.foreground,
        textAlign: 'center',
    },
    totalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    totalBox: {
        backgroundColor: colors.secondary,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginBottom: 2,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.primary,
    },
    buttonRow: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
    },
    saveBtn: {
        flex: 1,
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnDisabled: {
        opacity: 0.6,
    },
    saveBtnText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
    },
    clearBtn: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearBtnText: {
        color: colors.mutedForeground,
        fontSize: 14,
        fontWeight: '500',
    },
    // Date Picker Modal Styles
    datePickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    datePickerModal: {
        backgroundColor: colors.card,
        borderRadius: 16,
        width: '100%',
        maxWidth: 360,
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
