import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { Search, X, Printer, Plus, User, Edit2, Trash2, Power, Users, UserPlus } from 'lucide-react-native';

// Ponytail reusable — Load More type pagination 10 properly
export function PurchaseFarmerTab(props:any){
  const { s, colors, t, isDark, farmerTabSearch, setFarmerTabSearch, farmerSearchLoading, customers, farmerHasMore, farmerLoadingMore, handleLoadMoreFarmers, handleExportFarmersPdf, setEditingCustomer, setShowAddCustomer, handleEditCustomer, handleDeleteCustomer, handleRestoreCustomer } = (props as any).ctx || props;
  return (
        <View>
            {/* Search + Print + Add */}
            <View style={s.farmerTopRow}>
                <View style={s.farmerSearchBox}>
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={s.farmerSearchInput}
                        value={farmerTabSearch}
                        onChangeText={setFarmerTabSearch}
                        placeholder="Search farmers..."
                        placeholderTextColor={colors.mutedForeground}
                    />
                    {farmerTabSearch.length > 0 && (
                        <Pressable onPress={() => setFarmerTabSearch('')}><X size={13} color={colors.mutedForeground} /></Pressable>
                    )}
                </View>
                <Pressable style={s.farmerActionBtn} onPress={handleExportFarmersPdf}>
                    <Printer size={14} color="#fff" />
                </Pressable>
                <Pressable style={s.farmerActionBtn} onPress={() => { setEditingCustomer(null); setShowAddCustomer(true); }}>
                    <Plus size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Add</Text>
                </Pressable>
            </View>

            {/* Farmer Management Title */}
            <Text style={s.farmerSectionTitle}>Farmer Management</Text>
            <Text style={[s.farmerSubtitle, { color: colors.mutedForeground }]}>farmer list ({customers.length})</Text>

            {/* Farmer Table */}
            {farmerSearchLoading ? (
                <View style={s.emptyBox}><ActivityIndicator color={colors.primary} /></View>
            ) : customers.length === 0 ? (
                farmerTabSearch?.trim() ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 }}>
                        <Search size={36} color={colors.mutedForeground} opacity={0.4} />
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.mutedForeground }}>No farmers found</Text>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>No results for “{farmerTabSearch.trim()}”</Text>
                    </View>
                ) : (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 72, paddingHorizontal: 24, gap: 18, minHeight: 420 }}>
                        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={44} color="#9CA3AF" />
                        </View>
                        <View style={{ alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.foreground, textAlign: 'center' }}>Add First Farmer</Text>
                            <Text style={{ fontSize: 15, fontWeight: '500', color: colors.mutedForeground, textAlign: 'center' }}>No farmers added yet</Text>
                        </View>
                        <Pressable
                            onPress={() => { setEditingCustomer(null); setShowAddCustomer(true); }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2563EB', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 28, marginTop: 4, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 }}
                        >
                            <UserPlus size={18} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Add Farmer</Text>
                        </Pressable>
                    </View>
                )
            ) : (
                <View style={s.tableWrap}>
                    <View style={[s.tHead, { backgroundColor: colors.primary }]}>
                        <Text style={[s.tHeadText, { flex: 0.5, color: '#fff', textAlign: 'center' }]}>{t.common.code}</Text>
                        <Text style={[s.tHeadText, { flex: 1.2, color: '#fff', textAlign: 'center' }]}>{t.common.name}</Text>
                        <Text style={[s.tHeadText, { flex: 0.8, color: '#fff', textAlign: 'center' }]}>Based On</Text>
                        <Text style={[s.tHeadText, { flex: 0.6, color: '#fff', textAlign: 'center' }]}>Status</Text>
                        <View style={{ flex: 0.6 }} />
                    </View>
                    {customers.map((item, index) => {
                        const isInactive = item.isActive === false;
                        return (
                            <View key={item._id} style={[
                                s.entryRow,
                                index % 2 !== 0 && { backgroundColor: isDark ? colors.muted + '30' : '#f8fafc' },
                                isInactive && { opacity: 0.45 }
                            ]}>
                                <Text style={[s.entryCellText, { flex: 0.5, color: isInactive ? colors.mutedForeground : colors.primary, fontWeight: '700', textAlign: 'center' }]}>{item.code}</Text>
                                <Text style={[s.entryCellText, { flex: 1.2, textAlign: 'center', color: isInactive ? colors.mutedForeground : colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                                <Text style={[s.entryCellText, { flex: 0.8, textAlign: 'center', fontSize: 10, color: isInactive ? colors.mutedForeground : colors.foreground }]}>{item.priceBasis || '-'}</Text>
                                <View style={{ flex: 0.6, alignItems: 'center' }}>
                                    <View style={[s.statusBadge, { backgroundColor: isInactive ? colors.destructive + '20' : colors.primary + '20' }]}>
                                        <Text style={[s.statusBadgeText, { color: isInactive ? colors.destructive : colors.primary }]}>
                                            {isInactive ? 'Off' : 'On'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ flex: 0.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                    <Pressable style={s.miniIconBtn} onPress={() => handleEditCustomer(item)}>
                                        <Edit2 size={12} color={colors.primary} />
                                    </Pressable>
                                    {!isInactive ? (
                                        <Pressable style={s.miniIconBtn} onPress={() => handleDeleteCustomer(item._id)}>
                                            <Trash2 size={12} color={colors.destructive} />
                                        </Pressable>
                                    ) : (
                                        <Pressable style={[s.miniIconBtn, { backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '30' }]} onPress={() => handleRestoreCustomer(item._id)}>
                                            <Power size={12} color={colors.primary} />
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                    {farmerHasMore && (
                        <Pressable
                            style={{ margin: 8, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent:'center' }}
                            onPress={handleLoadMoreFarmers}
                            disabled={farmerLoadingMore}
                        >
                            {farmerLoadingMore ? <ActivityIndicator color="#fff" /> : <Text style={{ color:'#fff', fontWeight:'700', fontSize:13}}>Load More</Text>}
                        </Pressable>
                    )}
                </View>
            )}
        </View>
  );
}
