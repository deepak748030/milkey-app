import { useState, useCallback } from 'react';

// Generic paginated list hook - ponytail reusable for Farmers/Members/Payments/Advances/Collections
export type ListState<T> = { items: T[]; total: number; page: number; hasMore: boolean; loading: boolean; refreshing: boolean };
export function useCrudList<T>(fetchFn: (opts: { page: number; search?: string; limit?: number }) => Promise<{ items: T[]; total: number }>, limit = 20) {
  const [state, setState] = useState<ListState<T>>({ items: [], total: 0, page: 1, hasMore: true, loading: false, refreshing: false });
  const [search, setSearch] = useState('');

  const fetch = useCallback(async (page: number, isRefresh = false) => {
    if (!isRefresh && state.loading) return;
    setState(s => ({ ...s, loading: true, refreshing: isRefresh }));
    try {
      const res = await fetchFn({ page, search, limit });
      setState(s => ({
        ...s,
        items: isRefresh || page === 1 ? res.items : [...s.items, ...res.items],
        total: res.total,
        page,
        hasMore: res.items.length >= limit,
        loading: false,
        refreshing: false,
      }));
    } catch { setState(s => ({ ...s, loading: false, refreshing: false })); }
  }, [search, limit, fetchFn, state.loading]);

  const onSearch = useCallback((q: string) => { setSearch(q); setState(s => ({ ...s, page: 1 })); }, []);
  const refresh = useCallback(() => fetch(1, true), [fetch]);
  const loadMore = useCallback(() => { if (state.hasMore && !state.loading) fetch(state.page + 1); }, [state.hasMore, state.loading, state.page, fetch]);

  return { ...state, search, setSearch: onSearch, fetch, refresh, loadMore };
}
