import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { User, X } from 'lucide-react-native';

// Ponytail reusable — single source, no duplication, no UI change
export function RegisterFarmerModal(props:any){
  const { s, styles, colors, showFarmerModal, setShowFarmerModal, editingFarmer, farmerName, setFarmerName, farmerMobile, setFarmerMobile, farmerAddress, setFarmerAddress, handleSaveFarmer, savingFarmer } = (props as any).ctx || props;
  return (
        <Modal
            visible={showFarmerModal}
            animationType="fade"
            transparent
            onRequestClose={() => setShowFarmerModal(false)}
        >
            <View style={styles.centeredModalOverlay}>
                {/* Tap outside to close */}
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowFarmerModal(false)} />

                <View style={styles.centeredModalContainer}>
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        {/* Header */}
                        <View style={styles.farmerModalHeader}>
                            <View style={styles.farmerModalHeaderLeft}>
                                <View style={styles.farmerModalIcon}>
                                    <User size={20} color={colors.white} />
                                </View>
                                <Text style={styles.farmerModalTitle}>{editingFarmer ? 'Edit Farmer' : 'Add New Farmer'}</Text>
                            </View>
                            <Pressable style={styles.farmerModalCloseBtn} onPress={() => setShowFarmerModal(false)}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        {/* Body */}
                        <ScrollView
                            style={styles.farmerModalBody}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.farmerModalBodyContent}
                        >
                            <View style={styles.farmerFormCard}>
                                <View style={styles.farmerModalInputGroup}>
                                    <Text style={styles.label}>Code <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.farmerModalInput}
                                        placeholder="Enter code (numbers only)"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={newCode}
                                        onChangeText={setNewCode}
                                        keyboardType="numeric"
                                    />
                                </View>

                                <View style={styles.farmerModalInputGroup}>
                                    <Text style={styles.label}>Name <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.farmerModalInput}
                                        placeholder="Enter farmer name"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={newName}
                                        onChangeText={setNewName}
                                    />
                                </View>

                                <View style={styles.farmerModalInputGroup}>
                                    <Text style={styles.label}>Mobile <Text style={{ color: colors.destructive }}>*</Text></Text>
                                    <TextInput
                                        style={styles.farmerModalInput}
                                        placeholder="Enter mobile number"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={newMobile}
                                        onChangeText={setNewMobile}
                                        keyboardType="phone-pad"
                                    />
                                </View>

                                <View style={styles.farmerModalInputGroup}>
                                    <Text style={styles.label}>Address</Text>
                                    <TextInput
                                        style={styles.farmerModalInput}
                                        placeholder="Enter address (optional)"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={newAddress}
                                        onChangeText={setNewAddress}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.farmerModalFooter}>
                            <Pressable style={styles.farmerModalCancelBtn} onPress={() => setShowFarmerModal(false)}>
                                <Text style={styles.farmerModalCancelBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={styles.farmerModalSaveBtn}
                                onPress={editingFarmer ? handleUpdateFarmer : handleAddFarmer}
                                disabled={loading}
                            >
                                <Text style={styles.farmerModalSaveBtnText}>
                                    {loading ? 'Saving...' : (editingFarmer ? 'Update' : 'Save')}
                                </Text>
                            </Pressable>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </View>
        </Modal>
  );
}
