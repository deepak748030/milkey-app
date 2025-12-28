import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, RefreshControl, Modal } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ChevronLeft, MessageSquare, Check, Clock, AlertCircle, X, Send, Filter } from 'lucide-react-native';
import { router } from 'expo-router';
import { feedbackApi, Feedback } from '@/lib/milkeyApi';

const statusOptions = [
    { id: 'pending', label: 'Pending', color: '#F59E0B' },
    { id: 'in_review', label: 'In Review', color: '#3B82F6' },
    { id: 'resolved', label: 'Resolved', color: '#22C55E' },
    { id: 'closed', label: 'Closed', color: '#6B7280' },
];

const feedbackTypes = [
    { id: 'feedback', label: 'Feedback', icon: '💬' },
    { id: 'suggestion', label: 'Suggestion', icon: '💡' },
    { id: 'complaint', label: 'Complaint', icon: '😔' },
    { id: 'query', label: 'Query', icon: '❓' },
    { id: 'bug_report', label: 'Bug Report', icon: '🐛' },
];

export default function AdminFeedbackScreen() {
    const { colors, isDark } = useTheme();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [feedbacks, setFeedbacks] = useState<(Feedback & { user?: any })[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [selectedFeedback, setSelectedFeedback] = useState<(Feedback & { user?: any }) | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [responseText, setResponseText] = useState('');
    const [newStatus, setNewStatus] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    const styles = createStyles(colors, isDark);

    useEffect(() => { fetchData(); }, [filterStatus]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [feedbacksRes, statsRes] = await Promise.all([
                feedbackApi.getAll({ status: filterStatus || undefined, limit: 50 }),
                feedbackApi.getStats(),
            ]);

            if (feedbacksRes.success && feedbacksRes.response) {
                setFeedbacks(feedbacksRes.response.data);
            }
            if (statsRes.success && statsRes.response) {
                setStats(statsRes.response);
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
    }, [filterStatus]);

    const handleOpenFeedback = (feedback: Feedback & { user?: any }) => {
        setSelectedFeedback(feedback);
        setNewStatus(feedback.status);
        setResponseText(feedback.adminResponse || '');
        setShowModal(true);
    };

    const handleUpdateStatus = async () => {
        if (!selectedFeedback) return;

        setLoading(true);
        const res = await feedbackApi.updateStatus(selectedFeedback._id, newStatus, responseText.trim() || undefined);

        if (res.success) {
            Alert.alert('Success', 'Feedback updated successfully');
            setShowModal(false);
            setSelectedFeedback(null);
            fetchData();
        } else {
            Alert.alert('Error', res.message || 'Failed to update');
        }
        setLoading(false);
    };

    const getStatusColor = (status: string) => {
        return statusOptions.find(s => s.id === status)?.color || colors.mutedForeground;
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock size={14} color={getStatusColor(status)} />;
            case 'in_review': return <AlertCircle size={14} color={getStatusColor(status)} />;
            case 'resolved': return <Check size={14} color={getStatusColor(status)} />;
            default: return <Clock size={14} color={getStatusColor(status)} />;
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>Admin - Feedback</Text>
                <MessageSquare size={20} color={colors.primary} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            >
                {/* Stats Cards */}
                {stats && (
                    <View style={styles.statsGrid}>
                        <View style={[styles.statCard, { backgroundColor: colors.warning + '20' }]}>
                            <Text style={[styles.statValue, { color: colors.warning }]}>{stats.pending}</Text>
                            <Text style={styles.statLabel}>Pending</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.inReview}</Text>
                            <Text style={styles.statLabel}>In Review</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: colors.success + '20' }]}>
                            <Text style={[styles.statValue, { color: colors.success }]}>{stats.resolved}</Text>
                            <Text style={styles.statLabel}>Resolved</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: colors.muted }]}>
                            <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.total}</Text>
                            <Text style={styles.statLabel}>Total</Text>
                        </View>
                    </View>
                )}

                {/* Filter */}
                <View style={styles.filterRow}>
                    <Filter size={16} color={colors.mutedForeground} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                        <Pressable
                            style={[styles.filterChip, !filterStatus && styles.filterChipActive]}
                            onPress={() => setFilterStatus('')}
                        >
                            <Text style={[styles.filterChipText, !filterStatus && { color: colors.white }]}>All</Text>
                        </Pressable>
                        {statusOptions.map((s) => (
                            <Pressable
                                key={s.id}
                                style={[styles.filterChip, filterStatus === s.id && { backgroundColor: s.color }]}
                                onPress={() => setFilterStatus(s.id)}
                            >
                                <Text style={[styles.filterChipText, filterStatus === s.id && { color: colors.white }]}>{s.label}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                {/* Feedback List */}
                {feedbacks.length > 0 ? feedbacks.map((item) => (
                    <Pressable key={item._id} style={styles.feedbackCard} onPress={() => handleOpenFeedback(item)}>
                        <View style={styles.feedbackHeader}>
                            <View style={styles.typeTag}>
                                <Text style={styles.typeIcon}>{feedbackTypes.find(t => t.id === item.type)?.icon}</Text>
                                <Text style={styles.typeLabel}>{feedbackTypes.find(t => t.id === item.type)?.label}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                                {getStatusIcon(item.status)}
                                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                                    {item.status.replace('_', ' ')}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.feedbackSubject}>{item.subject}</Text>
                        <Text style={styles.feedbackMessage} numberOfLines={2}>{item.message}</Text>

                        <View style={styles.feedbackFooter}>
                            <Text style={styles.userName}>From: {item.user?.name || 'Unknown'}</Text>
                            <Text style={styles.feedbackDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                        </View>

                        {item.adminResponse && (
                            <View style={styles.responseIndicator}>
                                <Check size={12} color={colors.success} />
                                <Text style={styles.responseIndicatorText}>Response sent</Text>
                            </View>
                        )}
                    </Pressable>
                )) : (
                    <View style={styles.emptyState}>
                        <MessageSquare size={48} color={colors.mutedForeground} />
                        <Text style={styles.emptyText}>No feedback found</Text>
                    </View>
                )}
            </ScrollView>

            {/* Detail Modal */}
            <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Feedback Details</Text>
                            <Pressable onPress={() => setShowModal(false)}><X size={20} color={colors.foreground} /></Pressable>
                        </View>

                        {selectedFeedback && (
                            <ScrollView style={styles.modalBody}>
                                {/* User Info */}
                                <View style={styles.userInfoCard}>
                                    <Text style={styles.userInfoName}>{selectedFeedback.user?.name || 'Unknown User'}</Text>
                                    <Text style={styles.userInfoEmail}>{selectedFeedback.user?.email || ''}</Text>
                                    <Text style={styles.userInfoDate}>Submitted: {new Date(selectedFeedback.createdAt).toLocaleString()}</Text>
                                </View>

                                {/* Feedback Content */}
                                <Text style={styles.detailLabel}>Type</Text>
                                <View style={styles.typeDisplay}>
                                    <Text>{feedbackTypes.find(t => t.id === selectedFeedback.type)?.icon} {feedbackTypes.find(t => t.id === selectedFeedback.type)?.label}</Text>
                                </View>

                                <Text style={styles.detailLabel}>Subject</Text>
                                <Text style={styles.detailText}>{selectedFeedback.subject}</Text>

                                <Text style={styles.detailLabel}>Message</Text>
                                <Text style={styles.detailText}>{selectedFeedback.message}</Text>

                                {/* Status Update */}
                                <Text style={styles.detailLabel}>Update Status</Text>
                                <View style={styles.statusRow}>
                                    {statusOptions.map((s) => (
                                        <Pressable
                                            key={s.id}
                                            style={[styles.statusOption, { borderColor: s.color }, newStatus === s.id && { backgroundColor: s.color }]}
                                            onPress={() => setNewStatus(s.id)}
                                        >
                                            <Text style={[styles.statusOptionText, newStatus === s.id && { color: colors.white }]}>{s.label}</Text>
                                        </Pressable>
                                    ))}
                                </View>

                                {/* Admin Response */}
                                <Text style={styles.detailLabel}>Admin Response</Text>
                                <TextInput
                                    style={styles.responseInput}
                                    placeholder="Write your response to the user..."
                                    value={responseText}
                                    onChangeText={setResponseText}
                                    placeholderTextColor={colors.mutedForeground}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </ScrollView>
                        )}

                        <View style={styles.modalFooter}>
                            <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.saveBtn} onPress={handleUpdateStatus}>
                                <Send size={16} color={colors.white} />
                                <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Update'}</Text>
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
    scrollView: { flex: 1 },
    scrollContent: { padding: 12, paddingBottom: 40 },
    statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
    statValue: { fontSize: 24, fontWeight: '700' },
    statLabel: { fontSize: 10, color: colors.mutedForeground, marginTop: 2 },
    filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
    filterScroll: { flex: 1 },
    filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card, marginRight: 8, borderWidth: 1, borderColor: colors.border },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 12, fontWeight: '600', color: colors.foreground },
    feedbackCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    typeTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    typeIcon: { fontSize: 14 },
    typeLabel: { fontSize: 12, fontWeight: '600', color: colors.foreground },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
    statusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
    feedbackSubject: { fontSize: 15, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
    feedbackMessage: { fontSize: 13, color: colors.mutedForeground, marginBottom: 10, lineHeight: 18 },
    feedbackFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    userName: { fontSize: 11, color: colors.primary, fontWeight: '600' },
    feedbackDate: { fontSize: 11, color: colors.mutedForeground },
    responseIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
    responseIndicatorText: { fontSize: 11, color: colors.success },
    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 15, color: colors.mutedForeground, marginTop: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
    modalBody: { padding: 16 },
    modalFooter: { flexDirection: 'row', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
    userInfoCard: { backgroundColor: colors.secondary, borderRadius: 10, padding: 12, marginBottom: 16 },
    userInfoName: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    userInfoEmail: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    userInfoDate: { fontSize: 11, color: colors.mutedForeground, marginTop: 4 },
    detailLabel: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground, marginBottom: 6, marginTop: 12 },
    detailText: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
    typeDisplay: { backgroundColor: colors.secondary, padding: 10, borderRadius: 8 },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statusOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 2 },
    statusOptionText: { fontSize: 12, fontWeight: '600', color: colors.foreground },
    responseInput: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, minHeight: 100 },
    cancelBtn: { flex: 1, backgroundColor: colors.muted, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    cancelBtnText: { color: colors.foreground, fontSize: 15, fontWeight: '600' },
    saveBtn: { flex: 1, flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
    saveBtnText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});
