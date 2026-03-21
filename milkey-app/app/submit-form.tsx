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
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { Send, FileText, ChevronLeft, Clock, CheckCircle, XCircle, Eye, Upload, X, Plus, ImageIcon } from 'lucide-react-native';
import { customFormsApi } from '@/lib/milkeyApi';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

interface SubmittedForm {
    _id: string;
    formName: string;
    description?: string;
    attachments?: string[];
    fields: { label: string; value: string }[];
    status: 'pending' | 'reviewed' | 'approved' | 'rejected';
    adminNotes?: string;
    createdAt: string;
}

export default function SubmitFormScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(colors);

    const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
    const [formTitle, setFormTitle] = useState('');
    const [description, setDescription] = useState('');
    const [attachments, setAttachments] = useState<{ uri: string; name: string; base64?: string }[]>([]);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
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

    const pickImage = async () => {
        if (attachments.length >= 5) {
            Alert.alert('Limit Reached', 'Maximum 5 files allowed');
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: 5 - attachments.length,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets) {
                const newAttachments = result.assets.slice(0, 5 - attachments.length).map(asset => ({
                    uri: asset.uri,
                    name: asset.fileName || `image_${Date.now()}.jpg`,
                    base64: asset.base64 || undefined,
                }));
                setAttachments(prev => [...prev, ...newAttachments].slice(0, 5));
            }
        } catch (error) {
            console.error('Image picker error:', error);
        }
    };

    const pickDocument = async () => {
        if (attachments.length >= 5) {
            Alert.alert('Limit Reached', 'Maximum 5 files allowed');
            return;
        }

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                multiple: true,
            });

            if (!result.canceled && result.assets) {
                const newAttachments: { uri: string; name: string; base64?: string }[] = [];
                for (const asset of result.assets.slice(0, 5 - attachments.length)) {
                    try {
                        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                            encoding: 'base64' as any,
                        });
                        newAttachments.push({
                            uri: asset.uri,
                            name: asset.name || `file_${Date.now()}`,
                            base64,
                        });
                    } catch {
                        newAttachments.push({
                            uri: asset.uri,
                            name: asset.name || `file_${Date.now()}`,
                        });
                    }
                }
                setAttachments(prev => [...prev, ...newAttachments].slice(0, 5));
            }
        } catch (error) {
            console.error('Document picker error:', error);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (saving) return;

        const trimmedTitle = formTitle.trim();
        if (!trimmedTitle) {
            Alert.alert('Error', 'Please enter a form title');
            return;
        }

        const trimmedDesc = description.trim();
        if (!trimmedDesc) {
            Alert.alert('Error', 'Please enter a description');
            return;
        }

        setSaving(true);
        try {
            // Upload attachments first if any
            let uploadedUrls: string[] = [];
            if (attachments.length > 0) {
                setUploading(true);
                const base64Images = attachments
                    .filter(a => a.base64)
                    .map(a => `data:image/jpeg;base64,${a.base64}`);

                if (base64Images.length > 0) {
                    const uploadRes = await customFormsApi.uploadAttachments(base64Images);
                    if (uploadRes.success && uploadRes.response?.urls) {
                        uploadedUrls = uploadRes.response.urls;
                    }
                }
                setUploading(false);
            }

            const response = await customFormsApi.create({
                formName: trimmedTitle,
                description: trimmedDesc,
                attachments: uploadedUrls,
            });

            if (response.success) {
                Alert.alert('Success', 'Form submitted successfully');
                setFormTitle('');
                setDescription('');
                setAttachments([]);
                setActiveTab('history');
                fetchSubmittedForms();
            } else {
                Alert.alert('Error', response.message || 'Failed to submit form');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to submit form');
        } finally {
            setSaving(false);
            setUploading(false);
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
            case 'approved': return colors.success;
            case 'rejected': return colors.destructive;
            case 'reviewed': return colors.primary;
            default: return colors.warning;
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const wordCount = description.trim().split(/\s+/).filter(Boolean).length;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
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
                    {/* Form Title */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Form Title *</Text>
                        <TextInput
                            style={styles.input}
                            value={formTitle}
                            onChangeText={setFormTitle}
                            placeholder="Enter form title"
                            placeholderTextColor={colors.mutedForeground}
                            maxLength={100}
                        />
                    </View>

                    {/* Description Textarea */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.label}>Description *</Text>
                            <Text style={[styles.wordCount, wordCount > 1000 && { color: colors.destructive }]}>
                                {wordCount}/1000 words
                            </Text>
                        </View>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Enter detailed description (max 1000 words)"
                            placeholderTextColor={colors.mutedForeground}
                            multiline
                            textAlignVertical="top"
                            maxLength={5000}
                        />
                    </View>

                    {/* Upload Section */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Attachments (max 5)</Text>

                        {/* Uploaded files preview */}
                        {attachments.length > 0 && (
                            <View style={styles.attachmentsList}>
                                {attachments.map((att, index) => (
                                    <View key={index} style={styles.attachmentItem}>
                                        {att.uri.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                                            <Image source={{ uri: att.uri }} style={styles.attachmentThumb} />
                                        ) : (
                                            <View style={styles.attachmentFileIcon}>
                                                <FileText size={20} color={colors.primary} />
                                            </View>
                                        )}
                                        <Text style={styles.attachmentName} numberOfLines={1}>{att.name}</Text>
                                        <Pressable onPress={() => removeAttachment(index)} style={styles.removeAttBtn}>
                                            <X size={16} color={colors.destructive} />
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        )}

                        {attachments.length < 5 && (
                            <View style={styles.uploadBtnRow}>
                                <Pressable style={styles.uploadBtn} onPress={pickImage}>
                                    <ImageIcon size={18} color={colors.primary} />
                                    <Text style={styles.uploadBtnText}>Images</Text>
                                </Pressable>
                                <Pressable style={styles.uploadBtn} onPress={pickDocument}>
                                    <Upload size={18} color={colors.primary} />
                                    <Text style={styles.uploadBtnText}>Documents</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>

                    {/* Submit Button */}
                    <Pressable
                        style={[styles.submitBtn, (saving || uploading) && styles.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={saving || uploading}
                    >
                        {saving || uploading ? (
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

                                    {/* Description */}
                                    {form.description ? (
                                        <View style={styles.descriptionContainer}>
                                            <Text style={styles.descriptionText} numberOfLines={4}>{form.description}</Text>
                                        </View>
                                    ) : null}

                                    {/* Attachments */}
                                    {form.attachments && form.attachments.length > 0 && (
                                        <View style={styles.formAttachments}>
                                            {form.attachments.map((url, idx) => (
                                                <Image key={idx} source={{ uri: url }} style={styles.formAttachmentThumb} />
                                            ))}
                                        </View>
                                    )}

                                    {/* Old-style fields for backward compat */}
                                    {form.fields && form.fields.length > 0 && (
                                        <View style={styles.fieldsContainer}>
                                            {form.fields.map((field, idx) => (
                                                <View key={idx} style={styles.fieldRow}>
                                                    <Text style={styles.fieldLabel}>{field.label}:</Text>
                                                    <Text style={styles.fieldValue}>{field.value}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

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
            paddingHorizontal: 6,
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
            paddingHorizontal: 6,
            paddingVertical: 6,
            gap: 6,
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
            paddingHorizontal: 6,
            paddingVertical: 6,
            paddingBottom: 100,
        },
        section: {
            marginBottom: 6,
        },
        sectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
        },
        label: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.mutedForeground,
            marginBottom: 4,
        },
        wordCount: {
            fontSize: 12,
            color: colors.mutedForeground,
        },
        input: {
            backgroundColor: colors.card,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            fontSize: 14,
            color: colors.foreground,
            borderWidth: 1,
            borderColor: colors.border,
        },
        textArea: {
            minHeight: 150,
            textAlignVertical: 'top',
        },
        attachmentsList: {
            gap: 6,
            marginBottom: 6,
        },
        attachmentItem: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            padding: 6,
            gap: 8,
        },
        attachmentThumb: {
            width: 40,
            height: 40,
            borderRadius: 6,
        },
        attachmentFileIcon: {
            width: 40,
            height: 40,
            borderRadius: 6,
            backgroundColor: colors.secondary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        attachmentName: {
            flex: 1,
            fontSize: 13,
            color: colors.foreground,
        },
        removeAttBtn: {
            padding: 6,
        },
        uploadBtnRow: {
            flexDirection: 'row',
            gap: 6,
        },
        uploadBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            borderStyle: 'dashed',
        },
        uploadBtnText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.primary,
        },
        submitBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            borderRadius: 8,
            paddingVertical: 14,
            gap: 8,
            marginTop: 6,
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
            marginBottom: 6,
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
            marginBottom: 6,
        },
        descriptionContainer: {
            marginBottom: 6,
        },
        descriptionText: {
            fontSize: 13,
            color: colors.foreground,
            lineHeight: 20,
        },
        formAttachments: {
            flexDirection: 'row',
            gap: 6,
            marginBottom: 6,
            flexWrap: 'wrap',
        },
        formAttachmentThumb: {
            width: 60,
            height: 60,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
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
