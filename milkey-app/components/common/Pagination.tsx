import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  page: number;
  totalPages: number;
  total?: number;
  limit?: number;
  onPageChange: (p: number) => void;
};

export const Pagination = memo(function Pagination({ page, totalPages, total, limit, onPageChange }: Props) {
  const { colors, isDark } = useTheme();
  if (!totalPages || totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  const maxVisible = 5;
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (page <= 3) pages.push(1, 2, 3, 4, '...', totalPages);
    else if (page >= totalPages - 2) pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    else pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
  }

  const Btn = ({ children, active, disabled, onPress }: any) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text style={[styles.btnText, { color: active ? '#fff' : colors.foreground, fontWeight: active ? '800' : '600' }]}>{children}</Text>
    </Pressable>
  );

  const IconBtn = ({ disabled, onPress, children }: any) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.iconBtn,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );

  return (
    <View style={[styles.wrap, { backgroundColor: isDark ? colors.card : '#fff', borderColor: colors.border }]}>
      {total !== undefined && limit !== undefined ? (
        <Text style={[styles.info, { color: colors.mutedForeground }]}>
          {total === 0 ? '0' : `${(page - 1) * limit + 1}-${Math.min(page * limit, total)} of ${total}`}
        </Text>
      ) : null}
      <View style={styles.row}>
        <IconBtn disabled={page <= 1} onPress={() => onPageChange(1)}>
          <ChevronsLeft size={14} color={colors.foreground} />
        </IconBtn>
        <IconBtn disabled={page <= 1} onPress={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} color={colors.foreground} />
        </IconBtn>

        {pages.map((p, i) =>
          typeof p === 'number' ? (
            <Btn key={i} active={p === page} onPress={() => onPageChange(p)}>
              {p}
            </Btn>
          ) : (
            <View key={i} style={styles.dots}>
              <Text style={{ color: colors.mutedForeground, fontWeight: '700' }}>…</Text>
            </View>
          )
        )}

        <IconBtn disabled={page >= totalPages} onPress={() => onPageChange(page + 1)}>
          <ChevronRight size={16} color={colors.foreground} />
        </IconBtn>
        <IconBtn disabled={page >= totalPages} onPress={() => onPageChange(totalPages)}>
          <ChevronsRight size={14} color={colors.foreground} />
        </IconBtn>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  info: { fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  btn: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 12 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    minWidth: 24,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
