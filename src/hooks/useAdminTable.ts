import { useState, useEffect, useCallback, useRef } from 'react'

export type AdminTableState<T> = { data: T[]; pagination: any; loading: boolean; page: number; search: string; status: string }
export function useAdminTable<T>(
  fetcher: (opts: { page: number; limit: number; search: string; status: string }) => Promise<{ response: { data?: T[]; items?: T[]; banners?: T[]; users?: T[]; pagination: any } | T[] }>,
  initialStatus = 'all',
  initialLimit = 10
) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(initialStatus)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(initialLimit)
  const [data, setData] = useState<T[]>([])
  const [pagination, setPagination] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetcherRef = useRef(fetcher)
  useEffect(() => { fetcherRef.current = fetcher }, [fetcher])

  // keep limit in sync if initialLimit changes externally (e.g. pageSize)
  useEffect(() => { setLimit(initialLimit) }, [initialLimit])

  // debounce search 400ms
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const prevSearchRef = useRef(debouncedSearch)
  const prevStatusRef = useRef(status)
  const prevLimitRef = useRef(limit)

  const fetch = useCallback(async (overrides?: { page?: number; search?: string; status?: string; limit?: number }) => {
    const p = overrides?.page ?? page
    const s = overrides?.search ?? debouncedSearch
    const st = overrides?.status ?? status
    const l = overrides?.limit ?? limit
    setLoading(true)
    try {
      const r: any = await fetcherRef.current({ page: p, limit: l, search: s, status: st })
      if (r?.success) {
        const resp = r.response
        setData(resp.data || resp.items || resp.banners || resp.users || resp || [])
        setPagination(resp.pagination || null)
      }
    } catch (e) {
      // silent
    } finally { setLoading(false) }
  }, [page, debouncedSearch, status, limit])

  // main effect: page / debouncedSearch / status / limit
  useEffect(() => {
    const searchChanged = prevSearchRef.current !== debouncedSearch
    const statusChanged = prevStatusRef.current !== status
    const limitChanged = prevLimitRef.current !== limit
    prevSearchRef.current = debouncedSearch
    prevStatusRef.current = status
    prevLimitRef.current = limit

    // if filter changed and we are not on page 1, reset to 1 and skip this fetch (next effect will fetch)
    if ((searchChanged || statusChanged || limitChanged) && page !== 1) {
      setPage(1)
      return
    }
    fetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, status, limit])

  // refresh function for manual calls (bypass debounce)
  const refresh = useCallback(() => fetch(), [fetch])

  return { data, pagination, loading, page, setPage, search, setSearch, status, setStatus, refresh, setData, limit, setLimit }
}
