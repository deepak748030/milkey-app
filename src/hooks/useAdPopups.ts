import { useState, useEffect, useCallback } from 'react'
import { getAdPopupsAdmin, AdPopupAdmin } from '../lib/api'

export function useAdPopups(page: number, search: string, statusFilter: 'all'|'active'|'inactive') {
  const [adPopups, setAdPopups] = useState<AdPopupAdmin[]>([])
  const [pagination, setPagination] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const fetchAdPopups = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getAdPopupsAdmin({ page, limit: 10, search, status: statusFilter })
      if (r.success) { setAdPopups(r.response.adPopups); setPagination(r.response.pagination); }
    } catch {} finally { setLoading(false) }
  }, [page, search, statusFilter])
  useEffect(() => { fetchAdPopups(); }, [fetchAdPopups])
  return { adPopups, pagination, loading, fetchAdPopups }
}
