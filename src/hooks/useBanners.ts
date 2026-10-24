import { useState, useEffect, useCallback } from 'react'
import { getBannersAdmin, Banner, Pagination } from '../lib/api'

export function useBanners(page: number, search: string, statusFilter: 'all'|'active'|'inactive') {
  const [banners, setBanners] = useState<Banner[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchBanners = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getBannersAdmin({ page, limit: 10, search, status: statusFilter })
      if (r.success) { setBanners(r.response.banners); setPagination(r.response.pagination); }
    } catch {} finally { setLoading(false) }
  }, [page, search, statusFilter])
  useEffect(() => { fetchBanners(); }, [fetchBanners])
  return { banners, pagination, loading, fetchBanners, setBanners }
}
