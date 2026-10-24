import { useState, useCallback } from 'react';

// Generic report logic reuse for purchase/selling/register reports - ponytail DRY
export function useReport<T>(fetchFn: (opts: { page: number; limit: number; startDate?: string; endDate?: string; search?: string }) => Promise<{ data: T[]; total: number }>, limit = 10) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const fetch = useCallback(async (opts: { startDate?: string; endDate?: string; search?: string; page?: number }) => {
    setLoading(true);
    try {
      const p = opts.page || 1;
      const res = await fetchFn({ page: p, limit, ...opts });
      setData(prev => p === 1 ? res.data : [...prev, ...res.data]);
      setTotal(res.total);
      setPage(p);
    } finally { setLoading(false); }
  }, [fetchFn, limit]);
  const reset = useCallback(() => { setData([]); setTotal(0); setPage(1); }, []);
  return { data, total, page, loading, fetch, reset, setData };
}
