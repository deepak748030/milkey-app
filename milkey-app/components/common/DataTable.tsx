import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Pagination } from './Pagination';

export type Column<T> = { key: string; title: string; flex?: number; render?: (item: T, idx: number) => React.ReactNode };
export const DataTable = memo(function DataTable<T>({
  columns,
  data,
  loading,
  emptyText = 'No data',
  onRowPress,
  pagination,
  page,
  onPageChange,
}: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  onRowPress?: (item: T) => void;
  pagination?: { page: number; pages: number; total: number; limit: number };
  page?: number;
  onPageChange?: (p: number) => void;
}) {
  const { colors } = useTheme();
  if (loading) return <View style={[styles.wrap, { borderColor: colors.border }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!data.length) return <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{emptyText}</Text></View>;
  return (
    <View style={{ gap: 0 }}>
      <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={[styles.header, { backgroundColor: colors.muted + '40' }]}>{columns.map(c => <Text key={c.key} style={[styles.hcell, { flex: c.flex || 1, color: colors.mutedForeground }]}>{c.title}</Text>)}</View>
        {data.map((item, idx) => (
          <Pressable key={idx} onPress={() => onRowPress?.(item)} style={[styles.row, { borderTopColor: colors.border }]}>{columns.map(c => <View key={c.key} style={{ flex: c.flex || 1 }}>{c.render ? c.render(item, idx) : <Text style={{ color: colors.foreground, fontSize: 12 }}>{String((item as any)[c.key] ?? '')}</Text>}</View>)}</Pressable>
        ))}
      </View>
      {pagination && pagination.pages > 1 && onPageChange ? (
        <Pagination page={pagination.page ?? page!} totalPages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={onPageChange} />
      ) : null}
    </View>
  );
});
const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  hcell: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' as any },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderTopWidth: 1 },
  empty: { borderWidth: 1, borderStyle: 'dashed' as any, borderRadius: 12, padding: 20, alignItems: 'center' },
});
