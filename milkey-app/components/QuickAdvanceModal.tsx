import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { X, Search, Check, Calendar as CalendarIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { farmersApi, advancesApi, Farmer } from '@/lib/milkeyApi';
import { getAuthToken } from '@/lib/authStore';
import { SuccessModal } from './SuccessModal';
import { Calendar } from './Calendar';
import { SubscriptionModal } from './SubscriptionModal';
import { useSubscriptionStore } from '@/lib/subscriptionStore';

interface QuickAdvanceModalProps {
    isVisible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function QuickAdvanceModal({ isVisible, onClose, onSuccess }: QuickAdvanceModalProps) {
    const { colors, isDark } = useTheme();

    // State
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingAdvance, setSavingAdvance] = useState(false);
    const [searchFarmer, setSearchFarmer] = useState('');
    const [farmerName, setFarmerName] = useState('');
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
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

    // Load farmers when modal opens
    useEffect(() => {
        if (isVisible) {
            loadFarmers();
            resetForm();
        }
    }, [isVisible]);

    const loadFarmers = async () => {
        const token = await getAuthToken();
        if (!token) return;

        setLoading(true);
        try {
            const res = await farmersApi.getAll();
            if (res.success) {
                setFarmers(res.response?.data || []);
            }
        } catch (error) {
            console.error('Failed to load farmers:', error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSearchFarmer('');
        setFarmerName('');
        setSelectedFarmer(null);
        setAdvanceDate(formatLocalDate(new Date()));
        setAmount('');
        setNote('');
        setShowSuggestions(false);
    };

    // Filtered farmers for search
    const filteredFarmers = useMemo(() => {
        if (!searchFarmer.trim()) return farmers.slice(0, 10);
        const query = searchFarmer.toLowerCase();
        return farmers.filter(f =>
            f.name.toLowerCase().includes(query) ||
            f.code.toLowerCase().includes(query) ||
            f.mobile?.includes(query)
        ).slice(0, 10);
    }, [farmers, searchFarmer]);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const handleSelectFarmer = (farmer: Farmer) => {
        setSelectedFarmer(farmer);
        setSearchFarmer(farmer.code);
        setFarmerName(farmer.name);
        setShowSuggestions(false);
    };

    const handleSaveAdvance = async () => {
        if (savingAdvance) return;

        // Check subscription first
        const currentStatus = status || await fetchStatus();
        if (!currentStatus?.hasRegister) {
            setShowSubscriptionModal(true);
            return;
        }

        if (!selectedFarmer) {
            setSuccessMessage({ title: 'Error', message: 'Please select a farmer first' });
            setShowSuccessModal(true);
            return;
        }

        const amountValue = parseFloat(amount) || 0;
        if (amountValue <= 0) {
            setSuccessMessage({ title: 'Error', message: 'Please enter a valid amount' });
            setShowSuccessModal(true);
            return;
        }

        setSavingAdvance(true);
        try {
            const res = await advancesApi.create({
                farmerCode: selectedFarmer.code,
                amount: amountValue,
                date: advanceDate,
                note: note.trim(),
            });
            if (res.success) {
                setSuccessMessage({ title: 'Success', message: 'Advance saved successfully!' });
                setShowSuccessModal(true);
            } else {
                setSuccessMessage({ title: 'Error', message: res.message || 'Failed to save advance' });
                setShowSuccessModal(true);
            }
        } catch (error) {
            setSuccessMessage({ title: 'Error', message: 'Failed to save advance' });
            setShowSuccessModal(true);
        } finally {
            setSavingAdvance(false);
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
            setAdvanceDate(formatLocalDate(date));
            setTempCalendarDate(date);
        }
        setShowDatePicker(false);
    };

    const styles = createStyles(colors, isDark);

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
                        <Text style={styles.title}>Quick Advance</Text>
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
                                <Text style={styles.loadingText}>Loading farmers...</Text>
                            </View>
                        ) : (
                            <>
                                {/* Farmer Search */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Farmer</Text>
                                    <Pressable
                                        style={styles.searchInput}
                                        onPress={() => setShowSuggestions(true)}
                                    >
                                        <Search size={16} color={colors.mutedForeground} />
                                        <TextInput
                                            style={styles.searchTextInput}
                                            placeholder="Search by code, name, or mobile..."
                                            value={searchFarmer}
                                            onChangeText={(text) => {
                                                setSearchFarmer(text);
                                                setShowSuggestions(true);
                                                if (selectedFarmer) setSelectedFarmer(null);
                                            }}
                                            onFocus={() => setShowSuggestions(true)}
                                            placeholderTextColor={colors.mutedForeground}
                                        />
                                        {selectedFarmer && (
                                            <View style={styles.selectedBadge}>
                                                <Check size={12} color={colors.white} />
                                            </View>
                                        )}
                                        {selectedFarmer && (
                                            <Pressable onPress={() => { setSelectedFarmer(null); setSearchFarmer(''); }}>
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
                                                {filteredFarmers.map(farmer => (
                                                    <Pressable
                                                        key={farmer._id}
                                                        style={styles.suggestionItem}
                                                        onPress={() => handleSelectFarmer(farmer)}
                                                    >
                                                        <View>
                                                            <Text style={styles.suggestionName}>{farmer.name}</Text>
                                                            <Text style={styles.suggestionCode}>Code: {farmer.code}</Text>
                                                        </View>
                                                    </Pressable>
                                                ))}
                                                {filteredFarmers.length === 0 && (
                                                    <View style={styles.emptyContainer}>
                                                        <Text style={styles.emptyText}>No farmers found</Text>
                                                    </View>
                                                )}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>

                                {/* Farmer Name (Auto-filled) */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Farmer Name</Text>
                                    <TextInput
                                        style={[styles.input, styles.disabledInput]}
                                        value={farmerName}
                                        editable={false}
                                        placeholder="Select a farmer above"
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>

                                {/* Date and Amount Row */}
                                <View style={styles.row}>
                                    <View style={[styles.inputGroup, { flex: 1 }]}>
                                        <Text style={styles.label}>Date</Text>
                                        <Pressable style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                                            <Text style={styles.dateText}>{formatDate(advanceDate)}</Text>
                                            <CalendarIcon size={16} color={colors.mutedForeground} />
                                        </Pressable>
                                    </View>
                                    <View style={[styles.inputGroup, { flex: 1 }]}>
                                        <Text style={styles.label}>Amount (₹)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={amount}
                                            onChangeText={setAmount}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={colors.mutedForeground}
                                        />
                                    </View>
                                </View>

                                {/* Note */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Note (Optional)</Text>
                                    <TextInput
                                        style={[styles.input, styles.noteInput]}
                                        value={note}
                                        onChangeText={setNote}
                                        placeholder="Add a note..."
                                        placeholderTextColor={colors.mutedForeground}
                                        multiline
                                        numberOfLines={2}
                                    />
                                </View>

                                {/* Save Button */}
                                <View style={styles.buttonRow}>
                                    <Pressable
                                        style={[styles.saveBtn, savingAdvance && styles.saveBtnDisabled]}
                                        onPress={handleSaveAdvance}
                                        disabled={savingAdvance}
                                    >
                                        {savingAdvance ? (
                                            <ActivityIndicator size="small" color={colors.white} />
                                        ) : (
                                            <Text style={styles.saveBtnText}>Save Advance</Text>
                                        )}
                                    </Pressable>
                                    <Pressable
                                        style={styles.clearBtn}
                                        onPress={resetForm}
                                        disabled={savingAdvance}
                                    >
                                        <Text style={styles.clearBtnText}>Clear</Text>
                                    </Pressable>
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
                animationType="slide"
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
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        backgroundColor: colors.card,
        borderRadius: 20,
        width: '100%',
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
    suggestionCode: {
        fontSize: 12,
        color: colors.mutedForeground,
        marginTop: 2,
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
        gap: 12,
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
    },
    noteInput: {
        minHeight: 60,
        textAlignVertical: 'top',
    },
    disabledInput: {
        backgroundColor: colors.muted,
        color: colors.mutedForeground,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    saveBtn: {
        flex: 1,
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 14,
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
        paddingHorizontal: 20,
        paddingVertical: 14,
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
