import { useState, useEffect, useCallback } from 'react'

export function useAdminFetch<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try { const res: any = await fetcher(); if (res?.success) setData(res.response ?? res); else setData(res as any) } catch (e: any) { setError(e?.response?.data?.message || 'Failed') } finally { setLoading(false) }
  }, deps)
  useEffect(() => { refresh() }, [refresh])
  return { data, loading, error, refresh, setData }
}
