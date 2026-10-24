import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

// Ponytail reusable: debounced search with loading flag
export function useDebouncedSearch<T>(searchFn: (q: string) => Promise<T>, delay = 300) {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, delay);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    let active = true;
    if (!debouncedQuery.trim()) { setData(null); return; }
    setLoading(true);
    searchFn(debouncedQuery).then(res => { if (active) setData(res); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debouncedQuery, searchFn]);

  const setQ = useCallback((v: string) => setQuery(v), []);
  return { query, setQuery: setQ, debouncedQuery, loading, data, setData };
}
