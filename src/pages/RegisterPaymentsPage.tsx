// File: src/pages/RegisterPaymentsPage.tsx
import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, ChevronDown, X, Calendar } from 'lucide-react'
import { cn } from '../lib/utils'
import { getRegisterPayments, getAdminUsersList, RegisterPayment } from '../lib/api'
import { TableSkeleton } from '../components/TableSkeleton'
import { Pagination } from '../components/Pagination'

interface OwnerOption {
    _id: string
    name: string
    email: string
    phone: string
}

export function RegisterPaymentsPage() {
    const [payments, setPayments] = useState<RegisterPayment[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [owners, setOwners] = useState<OwnerOption[]>([])
    const [selectedOwner, setSelectedOwner] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const limit = 20

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
            setPage(1)
        }, 400)
        return () => clearTimeout(timer)
    }, [search])

    // Fetch owners for filter
    useEffect(() => {
        const fetchOwners = async () => {
            try {
                const res = await getAdminUsersList()
                if (res.success) {
                    setOwners(res.response || [])
                }
            } catch (err) {
                console.error('Failed to fetch owners:', err)
            }
        }
        fetchOwners()
    }, [])

    // Fetch payments
    const fetchPayments = useCallback(async () => {
        setLoading(true)
        try {
            const res = await getRegisterPayments({
                page,
                limit,
                search: debouncedSearch,
                userId: selectedOwner,
                startDate,
                endDate
            })
            if (res.success) {
                setPayments(res.response.data || [])
                setTotalPages(res.response.pagination?.pages || 1)
                setTotal(res.response.pagination?.total || 0)
            }
        } catch (err) {
            console.error('Failed to fetch payments:', err)
        } finally {
            setLoading(false)
        }
    }, [page, limit, debouncedSearch, selectedOwner, startDate, endDate])

    useEffect(() => {
        fetchPayments()
    }, [fetchPayments])

    const handleClearFilters = () => {
        setSelectedOwner('')
        setStartDate('')
        setEndDate('')
        setPage(1)
    }

    const hasActiveFilters = selectedOwner || startDate || endDate

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    const formatPeriod = (start: string, end: string) => {
        if (!start && !end) return '-'
        const s = start ? new Date(start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''
        const e = end ? new Date(end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : ''
        return `${s} - ${e}`
    }

    const formatAmount = (amount: number | undefined) => {
        return `₹${(amount || 0).toLocaleString('en-IN')}`
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Register Payments</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {total} total payment{total !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by code or name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    />
                </div>

                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors',
                        hasActiveFilters
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-foreground hover:bg-muted'
                    )}
                >
                    <Filter className="w-4 h-4" />
                    <span>Filters</span>
                    {hasActiveFilters && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                            {[selectedOwner, startDate, endDate].filter(Boolean).length}
                        </span>
                    )}
                    <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
                </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="p-4 bg-card border border-border rounded-xl space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Owner Filter */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Owner</label>
                            <select
                                value={selectedOwner}
                                onChange={(e) => { setSelectedOwner(e.target.value); setPage(1) }}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="">All Owners</option>
                                {owners.map((o) => (
                                    <option key={o._id} value={o._id}>{o.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Start Date */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Start Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>

                        {/* End Date */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">End Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={handleClearFilters}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                            Clear all filters
                        </button>
                    )}
                </div>
            )}

            {/* Table */}
            {loading ? (
                <TableSkeleton rows={10} columns={9} />
            ) : payments.length === 0 ? (
                <div className="text-center py-16 bg-card border border-border rounded-xl">
                    <p className="text-muted-foreground">No payments found</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Code</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Name</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Period</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Created</th>
                                    <th className="px-3 py-3 text-right text-xs font-semibold text-foreground whitespace-nowrap">Milk Amt</th>
                                    <th className="px-3 py-3 text-right text-xs font-semibold text-foreground whitespace-nowrap">Advance</th>
                                    <th className="px-3 py-3 text-right text-xs font-semibold text-foreground whitespace-nowrap">Total Payable</th>
                                    <th className="px-3 py-3 text-right text-xs font-semibold text-foreground whitespace-nowrap">Paid</th>
                                    <th className="px-3 py-3 text-right text-xs font-semibold text-foreground whitespace-nowrap">Closing Bal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {payments.map((payment) => (
                                    <tr key={payment._id} className="bg-card hover:bg-muted/30 transition-colors">
                                        <td className="px-3 py-3">
                                            <span className="font-mono text-sm text-foreground">
                                                {payment.farmer?.code || '-'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-sm text-foreground whitespace-nowrap">
                                                {payment.farmer?.name || '-'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatPeriod(payment.periodStart, payment.periodEnd)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDate(payment.createdAt)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <span className="text-sm text-foreground whitespace-nowrap">
                                                {formatAmount(payment.totalMilkAmount)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <span className="text-sm text-destructive whitespace-nowrap">
                                                {formatAmount(payment.totalAdvanceDeduction)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <span className="text-sm font-medium text-foreground whitespace-nowrap">
                                                {formatAmount(payment.netPayable)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <span className="text-sm font-semibold text-green-600 whitespace-nowrap">
                                                {formatAmount(payment.amount)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <span className={cn(
                                                'text-sm font-medium whitespace-nowrap',
                                                (payment.closingBalance || 0) < 0 ? 'text-destructive' : 'text-foreground'
                                            )}>
                                                {formatAmount(payment.closingBalance)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                />
            )}
        </div>
    )
}