import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Pressable,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import TopBar from '@/components/TopBar';
import { Plus, Trash2, Send, FileText, ChevronLeft, Clock, CheckCircle, XCircle, Eye } from 'lucide-react-native';
import { customFormsApi } from '@/lib/milkeyApi';

interface FormField {
    id: string;
    label: string;
    value: string;
}

interface SubmittedForm {
    _id: string;
    formName: string;
    fields: { label: string; value: string }[];
    status: 'pending' | 'reviewed' | 'approved' | 'rejected';
    adminNotes?: string;
    createdAt: string;
}

export default function SubmitFormScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
    const [formName, setFormName] = useState('');
    const [fields, setFields] = useState<FormField[]>([
        { id: '1', label: '', value: '' },
    ]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submittedForms, setSubmittedForms] = useState<SubmittedForm[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchSubmittedForms();
        }
    }, [activeTab]);

    const fetchSubmittedForms = async () => {
        setLoading(true);
        try {
            const response = await customFormsApi.getAll({ page: 1, limit: 10 });
            if (response.success && response.response) {
                setSubmittedForms(response.response.data);
                setHasMore(response.response.hasMore);
                setPage(1);
            }
        } catch (error) {
            console.error('Error fetching forms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const response = await customFormsApi.getAll({ page: nextPage, limit: 10 });
            if (response.success && response.response?.data) {
                setSubmittedForms(prev => [...prev, ...response.response!.data]);
                setHasMore(response.response!.hasMore);
                setPage(nextPage);
            }
        } catch (error) {
            console.error('Error loading more:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const addField = () => {
        const newField: FormField = {
            id: Date.now().toString(),
            label: '',
            value: '',
        };
        setFields([...fields, newField]);
    };

    const removeField = (id: string) => {
        if (fields.length > 1) {
            setFields(fields.filter(f => f.id !== id));
        }
    };

    const updateField = (id: string, key: 'label' | 'value', text: string) => {
        setFields(fields.map(f => (f.id === id ? { ...f, [key]: text } : f)));
    };

    const handleSubmit = async () => {
        if (saving) return;

        const trimmedName = formName.trim();
        if (!trimmedName) {
            Alert.alert('Error', 'Please enter a form name');
            return;
        }

        const validFields = fields.filter(f => f.label.trim() && f.value.trim());
        if (validFields.length === 0) {
            Alert.alert('Error', 'Please add at least one field with label and value');
            return;
        }

        setSaving(true);
        try {
            const response = await customFormsApi.create({
                formName: trimmedName,
                fields: validFields.map(f => ({ label: f.label.trim(), value: f.value.trim() })),
            });

            if (response.success) {
                Alert.alert('Success', 'Form submitted successfully');
                setFormName('');
                setFields([{ id: '1', label: '', value: '' }]);
                setActiveTab('history');
                fetchSubmittedForms();
            } else {
                Alert.alert('Error', response.message || 'Failed to submit form');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to submit form');
        } finally {
            setSaving(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircle size={16} color={colors.success} />;
            case 'rejected':
                return <XCircle size={16} color={colors.destructive} />;
            case 'reviewed':
                return <Eye size={16} color={colors.primary} />;
            default:
                return <Clock size={16} color={colors.warning} />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved':
                return colors.success;
            case 'rejected':
                return colors.destructive;
            case 'reviewed':
                return colors.primary;
            default:
                return colors.warning;
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <View style={styles.container}>
            <TopBar />

            {/* Header */}
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <ChevronLeft size={24} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>Submit Form</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
                <Pressable
                    style={[styles.tab, activeTab === 'create' && styles.tabActive]}
                    onPress={() => setActiveTab('create')}
                >
                    <Plus size={16} color={activeTab === 'create' ? colors.white : colors.mutedForeground} />
                    <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>Create</Text>
                </Pressable>
                <Pressable
                    style={[styles.tab, activeTab === 'history' && styles.tabActive]}
                    onPress={() => setActiveTab('history')}
                >
                    <FileText size={16} color={activeTab === 'history' ? colors.white : colors.mutedForeground} />
                    <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>My Forms</Text>
                </Pressable>
            </View>

            {activeTab === 'create' ? (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {/* Form Name */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Form Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={formName}
                            onChangeText={setFormName}
                            placeholder="Enter form name"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>

                    {/* Dynamic Fields */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.label}>Form Fields</Text>
                            <Pressable style={styles.addBtn} onPress={addField}>
                                <Plus size={18} color={colors.white} />
                                <Text style={styles.addBtnText}>Add Field</Text>
                            </Pressable>
                        </View>

                        {fields.map((field, index) => (
                            <View key={field.id} style={styles.fieldCard}>
                                <View style={styles.fieldHeader}>
                                    <Text style={styles.fieldNumber}>Field {index + 1}</Text>
                                    {fields.length > 1 && (
                                        <Pressable onPress={() => removeField(field.id)}>
                                            <Trash2 size={18} color={colors.destructive} />
                                        </Pressable>
                                    )}
                                </View>
                                <TextInput
                                    style={styles.fieldInput}
                                    value={field.label}
                                    onChangeText={(text) => updateField(field.id, 'label', text)}
                                    placeholder="Field Label (e.g., Name, Address)"
                                    placeholderTextColor={colors.mutedForeground}
                                />
                                <TextInput
                                    style={[styles.fieldInput, styles.valueInput]}
                                    value={field.value}
                                    onChangeText={(text) => updateField(field.id, 'value', text)}
                                    placeholder="Field Value"
                                    placeholderTextColor={colors.mutedForeground}
                                    multiline
                                />
                            </View>
                        ))}
                    </View>

                    {/* Submit Button */}
                    <Pressable
                        style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <>
                                <Send size={18} color={colors.white} />
                                <Text style={styles.submitBtnText}>Submit Form</Text>
                            </>
                        )}
                    </Pressable>
                </ScrollView>
            ) : (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : submittedForms.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <FileText size={48} color={colors.mutedForeground} />
                            <Text style={styles.emptyText}>No forms submitted yet</Text>
                        </View>
                    ) : (
                        <>
                            {submittedForms.map((form) => (
                                <View key={form._id} style={styles.formCard}>
                                    <View style={styles.formCardHeader}>
                                        <Text style={styles.formName}>{form.formName}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(form.status) + '20' }]}>
                                            {getStatusIcon(form.status)}
                                            <Text style={[styles.statusText, { color: getStatusColor(form.status) }]}>
                                                {form.status}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.formDate}>{formatDate(form.createdAt)}</Text>

                                    <View style={styles.fieldsContainer}>
                                        {form.fields.map((field, idx) => (
                                            <View key={idx} style={styles.fieldRow}>
                                                <Text style={styles.fieldLabel}>{field.label}:</Text>
                                                <Text style={styles.fieldValue}>{field.value}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    {form.adminNotes && (
                                        <View style={styles.adminNotes}>
                                            <Text style={styles.adminNotesLabel}>Admin Notes:</Text>
                                            <Text style={styles.adminNotesText}>{form.adminNotes}</Text>
                                        </View>
                                    )}
                                </View>
                            ))}

                            {hasMore && (
                                <Pressable style={styles.loadMoreBtn} onPress={handleLoadMore} disabled={loadingMore}>
                                    {loadingMore ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <Text style={styles.loadMoreText}>Load More</Text>
                                    )}
                                </Pressable>
                            )}
                        </>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        backBtn: {
            padding: 4,
            marginRight: 8,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.foreground,
        },
        tabRow: {
            flexDirection: 'row',
            padding: 8,
            gap: 8,
        },
        tab: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 8,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 6,
        },
        tabActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        tabText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.mutedForeground,
        },
        tabTextActive: {
            color: colors.white,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            padding: 12,
            paddingBottom: 100,
        },
        section: {
            marginBottom: 20,
        },
        sectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.foreground,
            marginBottom: 8,
        },
        input: {
            backgroundColor: colors.card,
            borderRadius: 10,
            padding: 14,
            fontSize: 15,
            color: colors.foreground,
            borderWidth: 1,
            borderColor: colors.border,
        },
        addBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            gap: 4,
        },
        addBtnText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.white,
        },
        fieldCard: {
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
        },
        fieldHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
        },
        fieldNumber: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.primary,
        },
        fieldInput: {
            backgroundColor: colors.secondary,
            borderRadius: 8,
            padding: 12,
            fontSize: 14,
            color: colors.foreground,
            marginBottom: 8,
        },
        valueInput: {
            minHeight: 60,
            textAlignVertical: 'top',
        },
        submitBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 14,
            gap: 8,
            marginTop: 10,
        },
        submitBtnDisabled: {
            opacity: 0.6,
        },
        submitBtnText: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.white,
        },
        loadingContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 60,
        },
        emptyContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 60,
        },
        emptyText: {
            fontSize: 15,
            color: colors.mutedForeground,
            marginTop: 12,
        },
        formCard: {
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
        },
        formCardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
        },
        formName: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.foreground,
            flex: 1,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            gap: 4,
        },
        statusText: {
            fontSize: 11,
            fontWeight: '600',
            textTransform: 'capitalize',
        },
        formDate: {
            fontSize: 12,
            color: colors.mutedForeground,
            marginBottom: 12,
        },
        fieldsContainer: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 10,
        },
        fieldRow: {
            flexDirection: 'row',
            marginBottom: 6,
        },
        fieldLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.mutedForeground,
            marginRight: 6,
        },
        fieldValue: {
            fontSize: 13,
            color: colors.foreground,
            flex: 1,
        },
        adminNotes: {
            marginTop: 10,
            padding: 10,
            backgroundColor: colors.primary + '10',
            borderRadius: 8,
        },
        adminNotesLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.primary,
            marginBottom: 4,
        },
        adminNotesText: {
            fontSize: 13,
            color: colors.foreground,
        },
        loadMoreBtn: {
            alignItems: 'center',
            justifyContent: 'center',
            padding: 14,
            backgroundColor: colors.card,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
        },
        loadMoreText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.primary,
        },
    });
