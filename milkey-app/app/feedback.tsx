import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, RefreshControl, Modal } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { MessageSquare, Send, ChevronLeft, Plus, X, Check, Clock, AlertCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { feedbackApi, Feedback } from '@/lib/milkeyApi';

const feedbackTypes = [
    { id: 'feedback', label: 'Feedback', icon: '💬' },
    { id: 'suggestion', label: 'Suggestion', icon: '💡' },
    { id: 'complaint', label: 'Complaint', icon: '😔' },
    { id: 'query', label: 'Query', icon: '❓' },
    { id: 'bug_report', label: 'Bug Report', icon: '🐛' },
];

const priorityOptions = [
    { id: 'low', label: 'Low', color: '#22C55E' },
    { id: 'medium', label: 'Medium', color: '#F59E0B' },
    { id: 'high', label: 'High', color: '#EF4444' },
];

export default function FeedbackScreen() {
    const { colors, isDark } = useTheme();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        type: 'feedback',
        subject: '',
        message: '',
        priority: 'medium'
    });

    const styles = createStyles(colors, isDark);

    useEffect(() => { fetchFeedbacks(); }, []);

    const fetchFeedbacks = async () => {
        setLoading(true);
        try {
            const res = await feedbackApi.getMyFeedbacks();
            if (res.success) setFeedbacks(res.response?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchFeedbacks();
        setRefreshing(false);
    }, []);

    const handleSubmit = async () => {
        if (!form.subject.trim()) {
            Alert.alert('Error', 'Please enter a subject');
            return;
        }
        if (!form.message.trim()) {
            Alert.alert('Error', 'Please enter your message');
            return;
        }

        setLoading(true);
        const res = await feedbackApi.submit({
            type: form.type,
            subject: form.subject.trim(),
            message: form.message.trim(),
            priority: form.priority
        });

        if (res.success) {
            Alert.alert('Success', 'Your feedback has been submitted. We will review it shortly.');
            setShowModal(false);
            setForm({ type: 'feedback', subject: '', message: '', priority: 'medium' });
            fetchFeedbacks();
        } else {
            Alert.alert('Error', res.message || 'Failed to submit feedback');
        }
        setLoading(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return colors.warning;
            case 'in_review': return colors.primary;
            case 'resolved': return colors.success;
            case 'closed': return colors.mutedForeground;
            default: return colors.mutedForeground;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock size={14} color={colors.warning} />;
            case 'in_review': return <AlertCircle size={14} color={colors.primary} />;
            case 'resolved': return <Check size={14} color={colors.success} />;
            default: return <Clock size={14} color={colors.mutedForeground} />;
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>Feedback & Support</Text>
                <Pressable onPress={() => setShowModal(true)} style={styles.addBtn}>
                    <Plus size={20} color={colors.white} />
                </Pressable>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            >
                {/* Info Card */}
                <View style={styles.infoCard}>
                    <MessageSquare size={24} color={colors.primary} />
                    <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>We value your feedback!</Text>
                        <Text style={styles.infoText}>Share your thoughts, suggestions, or report issues. Our team will review and respond.</Text>
                    </View>
                </View>

                {/* Submit Button */}
                <Pressable style={styles.submitBtn} onPress={() => setShowModal(true)}>
                    <Send size={18} color={colors.white} />
                    <Text style={styles.submitBtnText}>Submit New Feedback</Text>
                </Pressable>

                {/* Previous Submissions */}
                <Text style={styles.sectionTitle}>Your Submissions</Text>

                {feedbacks.length > 0 ? feedbacks.map((item) => (
                    <View key={item._id} style={styles.feedbackCard}>
                        <View style={styles.feedbackHeader}>
                            <Text style={styles.feedbackType}>{feedbackTypes.find(t => t.id === item.type)?.icon} {feedbackTypes.find(t => t.id === item.type)?.label}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                                {getStatusIcon(item.status)}
                                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status.replace('_', ' ')}</Text>
                            </View>
                        </View>
                        <Text style={styles.feedbackSubject}>{item.subject}</Text>
                        <Text style={styles.feedbackMessage} numberOfLines={2}>{item.message}</Text>
                        <Text style={styles.feedbackDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>

                        {item.adminResponse && (
                            <View style={styles.responseBox}>
                                <Text style={styles.responseLabel}>Admin Response:</Text>
                                <Text style={styles.responseText}>{item.adminResponse}</Text>
                            </View>
                        )}
                    </View>
                )) : (
                    <View style={styles.emptyState}>
                        <MessageSquare size={48} color={colors.mutedForeground} />
                        <Text style={styles.emptyText}>No submissions yet</Text>
                        <Text style={styles.emptySubtext}>Tap the button above to submit your first feedback</Text>
                    </View>
                )}
            </ScrollView>

            {/* Submit Modal */}
            <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Submit Feedback</Text>
                            <Pressable onPress={() => setShowModal(false)}><X size={20} color={colors.foreground} /></Pressable>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Type Selection */}
                            <Text style={styles.inputLabel}>Type</Text>
                            <View style={styles.typeGrid}>
                                {feedbackTypes.map((type) => (
                                    <Pressable
                                        key={type.id}
                                        style={[styles.typeBtn, form.type === type.id && styles.typeBtnActive]}
                                        onPress={() => setForm(p => ({ ...p, type: type.id }))}
                                    >
                                        <Text style={styles.typeIcon}>{type.icon}</Text>
                                        <Text style={[styles.typeLabel, form.type === type.id && { color: colors.white }]}>{type.label}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Priority */}
                            <Text style={styles.inputLabel}>Priority</Text>
                            <View style={styles.priorityRow}>
                                {priorityOptions.map((p) => (
                                    <Pressable
                                        key={p.id}
                                        style={[styles.priorityBtn, { borderColor: p.color }, form.priority === p.id && { backgroundColor: p.color }]}
                                        onPress={() => setForm(prev => ({ ...prev, priority: p.id }))}
                                    >
                                        <Text style={[styles.priorityLabel, form.priority === p.id && { color: colors.white }]}>{p.label}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Subject */}
                            <Text style={styles.inputLabel}>Subject</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Brief description of your feedback"
                                value={form.subject}
                                onChangeText={(v) => setForm(p => ({ ...p, subject: v }))}
                                placeholderTextColor={colors.mutedForeground}
                                maxLength={200}
                            />

                            {/* Message */}
                            <Text style={styles.inputLabel}>Message</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Describe in detail..."
                                value={form.message}
                                onChangeText={(v) => setForm(p => ({ ...p, message: v }))}
                                placeholderTextColor={colors.mutedForeground}
                                multiline
                                numberOfLines={5}
                                textAlignVertical="top"
                                maxLength={2000}
                            />
                            <Text style={styles.charCount}>{form.message.length}/2000</Text>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.saveBtn} onPress={handleSubmit}>
                                <Send size={16} color={colors.white} />
                                <Text style={styles.saveBtnText}>{loading ? 'Submitting...' : 'Submit'}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, paddingTop: 50, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { marginRight: 12 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.foreground },
    addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    scrollView: { flex: 1 },
    scrollContent: { padding: 12, paddingBottom: 40 },
    infoCard: { flexDirection: 'row', backgroundColor: colors.primary + '15', borderRadius: 12, padding: 16, marginBottom: 16, gap: 12 },
    infoContent: { flex: 1 },
    infoTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
    infoText: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, gap: 8, marginBottom: 20 },
    submitBtnText: { color: colors.white, fontSize: 15, fontWeight: '600' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
    feedbackCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    feedbackType: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
    statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
    feedbackSubject: { fontSize: 15, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
    feedbackMessage: { fontSize: 13, color: colors.mutedForeground, marginBottom: 8 },
    feedbackDate: { fontSize: 11, color: colors.mutedForeground },
    responseBox: { marginTop: 12, padding: 12, backgroundColor: colors.success + '10', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.success },
    responseLabel: { fontSize: 11, fontWeight: '600', color: colors.success, marginBottom: 4 },
    responseText: { fontSize: 13, color: colors.foreground },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginTop: 16 },
    emptySubtext: { fontSize: 13, color: colors.mutedForeground, marginTop: 4, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
    modalBody: { padding: 16 },
    modalFooter: { flexDirection: 'row', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
    inputLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground, marginBottom: 8, marginTop: 12 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.secondary, gap: 6 },
    typeBtnActive: { backgroundColor: colors.primary },
    typeIcon: { fontSize: 14 },
    typeLabel: { fontSize: 12, fontWeight: '600', color: colors.foreground },
    priorityRow: { flexDirection: 'row', gap: 10 },
    priorityBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 2, backgroundColor: 'transparent' },
    priorityLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.foreground },
    textArea: { height: 120, paddingTop: 12 },
    charCount: { fontSize: 11, color: colors.mutedForeground, textAlign: 'right', marginTop: 4 },
    cancelBtn: { flex: 1, backgroundColor: colors.muted, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    cancelBtnText: { color: colors.foreground, fontSize: 15, fontWeight: '600' },
    saveBtn: { flex: 1, flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
    saveBtnText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});
