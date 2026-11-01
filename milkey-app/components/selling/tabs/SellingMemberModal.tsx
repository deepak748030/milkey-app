import React from 'react';
import { View, Text, ScrollView, Modal, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { User, X } from 'lucide-react-native';

// Ponytail reusable — single source, no duplication, no UI change
export function SellingMemberModal(props:any){
  const { s, styles, colors, showMemberModal, setShowMemberModal, editingMember, memberName, setMemberName, memberMobile, setMemberMobile, memberAddress, setMemberAddress, memberRate, setMemberRate, handleSaveMember, savingMember } = (props as any).ctx || props;
  return (
        <Modal
            visible={showMemberModal}
            animationType="fade"
            transparent
            onRequestClose={() => setShowMemberModal(false)}
        >
            <View style={styles.centeredModalOverlay}>
                {/* Tap outside to close */}
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowMemberModal(false)} />

                <View style={styles.centeredModalContainer}>
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        {/* Header */}
                        <View style={styles.memberModalHeader}>
                            <View style={styles.memberModalHeaderLeft}>
                                <View style={styles.memberModalIcon}>
                                    <User size={20} color={colors.white} />
                                </View>
                                <Text style={styles.memberModalTitle}>{editingMember ? 'Edit Member' : 'Add New Member'}</Text>
                            </View>
                            <Pressable style={styles.memberModalCloseBtn} onPress={() => setShowMemberModal(false)}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        {/* Body */}
                        <ScrollView
                            style={styles.memberModalBody}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.memberModalBodyContent}
                        >
                            <View style={styles.memberFormCard}>
                                <View style={styles.modalInputGroup}>
                                    <Text style={styles.label}>Rate Per Liter (₹) <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="50"
                                        value={memberRatePerLiter}
                                        onChangeText={setMemberRatePerLiter}
                                        keyboardType="decimal-pad"
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>
                                <View style={styles.modalInputGroup}>
                                    <Text style={styles.label}>Name <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Full Name"
                                        value={memberName}
                                        onChangeText={setMemberName}
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>
                                <View style={styles.modalInputGroup}>
                                    <Text style={styles.label}>Mobile <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="10-digit number"
                                        value={memberMobile}
                                        onChangeText={setMemberMobile}
                                        keyboardType="phone-pad"
                                        placeholderTextColor={colors.mutedForeground}
                                    />
                                </View>
                                <View style={styles.modalInputGroup}>
                                    <Text style={styles.label}>Address</Text>
                                    <TextInput
                                        style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                                        placeholder="Village/City"
                                        value={memberAddress}
                                        onChangeText={setMemberAddress}
                                        placeholderTextColor={colors.mutedForeground}
                                        multiline
                                    />
                                </View>

                                {/* Daily Auto Entry toggle + defaults for bulk/quick session entry */}
                                <View style={styles.autoEntryRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.label}>Daily Auto Entry</Text>
                                        <Text style={styles.autoEntryHint}>
                                            ON karne par ye member Bulk Entry (session) list me automatically aayega
                                        </Text>
                                    </View>
                                    <Pressable
                                        style={[styles.toggleTrack, memberDailyAutoEntry && styles.toggleTrackOn]}
                                        onPress={() => setMemberDailyAutoEntry(v => !v)}
                                    >
                                        <View style={[styles.toggleThumb, memberDailyAutoEntry && styles.toggleThumbOn]} />
                                    </Pressable>
                                </View>

                                {memberDailyAutoEntry && (
                                    <>
                                        <View style={styles.row}>
                                            <View style={[styles.modalInputGroup, { flex: 1 }]}>
                                                <Text style={styles.label}>Default Morning (L)</Text>
                                                <TextInput
                                                    style={styles.modalInput}
                                                    placeholder="0"
                                                    value={memberDefaultMorning}
                                                    onChangeText={setMemberDefaultMorning}
                                                    keyboardType="decimal-pad"
                                                    placeholderTextColor={colors.mutedForeground}
                                                />
                                            </View>
                                            <View style={[styles.modalInputGroup, { flex: 1 }]}>
                                                <Text style={styles.label}>Default Evening (L)</Text>
                                                <TextInput
                                                    style={styles.modalInput}
                                                    placeholder="0"
                                                    value={memberDefaultEvening}
                                                    onChangeText={setMemberDefaultEvening}
                                                    keyboardType="decimal-pad"
                                                    placeholderTextColor={colors.mutedForeground}
                                                />
                                            </View>
                                        </View>
                                        <View style={styles.modalInputGroup}>
                                            <Text style={styles.label}>Default Note (optional)</Text>
                                            <TextInput
                                                style={styles.modalInput}
                                                placeholder="Entry details / note"
                                                value={memberDefaultNotes}
                                                onChangeText={setMemberDefaultNotes}
                                                placeholderTextColor={colors.mutedForeground}
                                            />
                                        </View>
                                    </>
                                )}
                            </View>
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.memberModalFooter}>
                            <Pressable style={styles.memberModalCancelBtn} onPress={() => setShowMemberModal(false)}>
                                <Text style={styles.memberModalCancelBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.memberModalSaveBtn} onPress={handleSaveMember} disabled={isLoading}>
                                {isLoading ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <Text style={styles.memberModalSaveBtnText}>{editingMember ? 'Update Member' : 'Save Member'}</Text>
                                )}
                            </Pressable>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </View>
        </Modal>
  );
}
