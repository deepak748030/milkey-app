import { useEffect, useMemo, useState } from 'react'
import {
    Bell, Send, RefreshCw, Trash2, Search, Users, Phone, Radio,
    CheckCircle2, XCircle, Clock, AlertCircle, Loader2, X, History as HistoryIcon,
    ChevronRight,
} from 'lucide-react'
import {
    lookupUserByPhone,
    sendNotification,
    listNotificationCampaigns,
    resendNotificationCampaign,
    deleteNotificationCampaign,
    getNotificationCampaign,
    type NotificationCampaign,
} from '../lib/api'

type Audience = 'all' | 'phone' | 'users'
type Tab = 'compose' | 'history'

interface SelectedUser { id: string; name: string; phone: string; email?: string; hasPushToken?: boolean }

const statusStyles: Record<string, { bg: string; text: string; icon: any }> = {
    completed: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-500', icon: CheckCircle2 },
    partial: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-500', icon: AlertCircle },
    failed: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-500', icon: XCircle },
    sending: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-500', icon: Loader2 },
    pending: { bg: 'bg-muted border-border', text: 'text-muted-foreground', icon: Clock },
}

function StatusBadge({ status }: { status: string }) {
    const s = statusStyles[status] || statusStyles.pending
    const Icon = s.icon
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text}`}>
            <Icon className={`w-3 h-3 ${status === 'sending' ? 'animate-spin' : ''}`} />
            {status}
        </span>
    )
}

export function NotificationsPage() {
    const [tab, setTab] = useState<Tab>('compose')

    // ─── Compose state ───
    const [audience, setAudience] = useState<Audience>('all')
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)

    // Phone lookup
    const [phoneQuery, setPhoneQuery] = useState('')
    const [phoneResults, setPhoneResults] = useState<SelectedUser[]>([])
    const [lookingUp, setLookingUp] = useState(false)
    const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([])

    // ─── History state ───
    const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyQ, setHistoryQ] = useState('')
    const [historyAudience, setHistoryAudience] = useState<string>('')
    const [historyStatus, setHistoryStatus] = useState<string>('')
    const [historyPage, setHistoryPage] = useState(1)
    const [historyPages, setHistoryPages] = useState(1)
    const [detailCampaign, setDetailCampaign] = useState<any>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    // ─── Flash message ───
    const [flash, setFlash] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
    const showFlash = (type: 'ok' | 'err', text: string) => {
        setFlash({ type, text })
        setTimeout(() => setFlash(null), 4000)
    }

    // ─── Load history ───
    const loadHistory = async (page = historyPage) => {
        setHistoryLoading(true)
        try {
            const res = await listNotificationCampaigns({
                page, limit: 20,
                q: historyQ.trim() || undefined,
                audience: historyAudience || undefined,
                status: historyStatus || undefined,
            })
            if (res.success) {
                setCampaigns(res.response || [])
                setHistoryPages(res.pagination?.pages || 1)
                setHistoryPage(res.pagination?.page || 1)
            }
        } catch (e: any) {
            showFlash('err', e?.response?.data?.message || 'Failed to load history')
        } finally {
            setHistoryLoading(false)
        }
    }

    useEffect(() => {
        if (tab === 'history') loadHistory(1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab])

    // ─── Debounced phone lookup ───
    useEffect(() => {
        if (audience !== 'users') return
        const q = phoneQuery.trim()
        if (q.length < 4) { setPhoneResults([]); return }
        const t = setTimeout(async () => {
            setLookingUp(true)
            try {
                const res = await lookupUserByPhone(q)
                if (res.success) setPhoneResults(res.response || [])
            } catch { setPhoneResults([]) }
            finally { setLookingUp(false) }
        }, 350)
        return () => clearTimeout(t)
    }, [phoneQuery, audience])

    const selectedIds = useMemo(() => new Set(selectedUsers.map(u => u.id)), [selectedUsers])
    const toggleUser = (u: SelectedUser) => {
        setSelectedUsers(prev => prev.find(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u])
    }

    // ─── Send handler ───
    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            showFlash('err', 'Title and message are required')
            return
        }

        let payload: any = { title: title.trim(), message: message.trim(), audience }
        if (audience === 'phone') {
            const phones = phoneQuery.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean)
            if (phones.length === 0) { showFlash('err', 'Enter at least one phone number'); return }
            payload.phones = phones
        } else if (audience === 'users') {
            if (selectedUsers.length === 0) { showFlash('err', 'Select at least one user'); return }
            payload.userIds = selectedUsers.map(u => u.id)
        } else if (audience === 'all') {
            if (!window.confirm('Broadcast this message to ALL users?')) return
        }

        setSending(true)
        try {
            const res = await sendNotification(payload)
            if (res.success) {
                const r = res.response
                showFlash('ok', `Sent to ${r?.successful ?? 0}/${r?.totalTargets ?? 0} users`)
                setTitle(''); setMessage(''); setPhoneQuery(''); setSelectedUsers([]); setPhoneResults([])
            } else {
                showFlash('err', res.message || 'Failed to send')
            }
        } catch (e: any) {
            showFlash('err', e?.response?.data?.message || 'Failed to send')
        } finally {
            setSending(false)
        }
    }

    // ─── History actions ───
    const handleResend = async (id: string) => {
        if (!window.confirm('Resend this notification to the same audience?')) return
        try {
            const res = await resendNotificationCampaign(id)
            if (res.success) { showFlash('ok', 'Resent successfully'); loadHistory() }
            else showFlash('err', res.message || 'Failed to resend')
        } catch (e: any) {
            showFlash('err', e?.response?.data?.message || 'Failed to resend')
        }
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this campaign from history?')) return
        try {
            const res = await deleteNotificationCampaign(id)
            if (res.success) { showFlash('ok', 'Deleted'); loadHistory() }
            else showFlash('err', res.message || 'Failed to delete')
        } catch (e: any) {
            showFlash('err', e?.response?.data?.message || 'Failed to delete')
        }
    }

    const openDetail = async (id: string) => {
        setDetailLoading(true)
        setDetailCampaign({ _id: id })
        try {
            const res = await getNotificationCampaign(id)
            if (res.success) setDetailCampaign(res.response)
        } catch { /* noop */ }
        finally { setDetailLoading(false) }
    }

    return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-8">
            {/* ─── Header ─── */}
            <div className="mb-4 sm:mb-6 flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Notifications</h1>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Broadcast messages, target users by phone, and review full history.</p>
                </div>
            </div>

            {/* ─── Flash ─── */}
            {flash && (
                <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium border ${flash.type === 'ok'
                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                    {flash.text}
                </div>
            )}

            {/* ─── Tabs ─── */}
            <div className="flex gap-2 mb-4 bg-card border border-border rounded-lg p-1 sticky top-0 z-10">
                <button
                    onClick={() => setTab('compose')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition ${tab === 'compose' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Send className="w-4 h-4" /> <span className="hidden xs:inline">Compose</span>
                </button>
                <button
                    onClick={() => setTab('history')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition ${tab === 'history' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <HistoryIcon className="w-4 h-4" /> History
                </button>
            </div>

            {tab === 'compose' ? (
                <div className="space-y-4">
                    {/* Audience selector */}
                    <div className="rounded-xl border bg-card p-4 shadow-soft sm:p-5">
                        <label className="block text-sm font-semibold text-foreground mb-3">Audience</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {[
                                { key: 'all', icon: Radio, label: 'Broadcast All', desc: 'Every registered user' },
                                { key: 'phone', icon: Phone, label: 'By Phone', desc: 'Enter phone numbers' },
                                { key: 'users', icon: Users, label: 'Pick Users', desc: 'Search & select' },
                            ].map(opt => {
                                const Icon = opt.icon
                                const active = audience === opt.key
                                return (
                                    <button
                                        key={opt.key}
                                        onClick={() => setAudience(opt.key as Audience)}
                                        className={`p-3 rounded-lg border-2 text-left transition ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                                            <span className="font-semibold text-sm text-foreground">{opt.label}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Audience-specific inputs */}
                    {audience === 'phone' && (
                        <div className="rounded-xl border bg-card p-4 shadow-soft sm:p-5">
                            <label className="block text-sm font-semibold text-foreground mb-1.5">Phone Numbers</label>
                            <textarea
                                value={phoneQuery}
                                onChange={e => setPhoneQuery(e.target.value)}
                                rows={3}
                                placeholder="Enter one or more phone numbers (comma, space, or newline separated)&#10;e.g. 9876543210, 9123456780"
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <p className="text-xs text-muted-foreground mt-1.5">Users matching these phones will be looked up automatically when sending.</p>
                        </div>
                    )}

                    {audience === 'users' && (
                        <div className="rounded-xl border bg-card p-4 shadow-soft sm:p-5">
                            <label className="block text-sm font-semibold text-foreground mb-1.5">Search Users by Phone</label>
                            <div className="relative">
                                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="tel"
                                    value={phoneQuery}
                                    onChange={e => setPhoneQuery(e.target.value)}
                                    placeholder="Type last 4+ digits of a phone number..."
                                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                                {lookingUp && (
                                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                                )}
                            </div>

                            {phoneResults.length > 0 && (
                                <div className="mt-3 space-y-1 max-h-56 overflow-y-auto">
                                    {phoneResults.map(u => (
                                        <button
                                            key={u.id}
                                            onClick={() => toggleUser(u)}
                                            className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition text-left ${selectedIds.has(u.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                                                }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-foreground truncate">{u.name || 'Unnamed'}</p>
                                                <p className="text-xs text-muted-foreground">{u.phone}</p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {!u.hasPushToken && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 border border-yellow-500/30">
                                                        No push
                                                    </span>
                                                )}
                                                {selectedIds.has(u.id) && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {selectedUsers.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border">
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Selected ({selectedUsers.length})</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedUsers.map(u => (
                                            <span key={u.id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                                                {u.name || u.phone}
                                                <button onClick={() => toggleUser(u)} className="hover:bg-primary/20 rounded-full">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Message editor */}
                    <div className="rounded-xl border bg-card p-4 shadow-soft sm:p-5 space-y-3">
                        <div>
                            <label className="block text-sm font-semibold text-foreground mb-1.5">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                maxLength={200}
                                placeholder="Notification title"
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <p className="text-xs text-muted-foreground mt-1">{title.length}/200</p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-foreground mb-1.5">Message</label>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                rows={5}
                                maxLength={500}
                                placeholder="Message body..."
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <p className="text-xs text-muted-foreground mt-1">{message.length}/500</p>
                        </div>
                        <div className="flex justify-end pt-1">
                            <button
                                onClick={handleSend}
                                disabled={sending}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg shadow-sm text-sm font-semibold hover:opacity-90 disabled:opacity-50 w-full sm:w-auto justify-center"
                            >
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {sending ? 'Sending...' : 'Send Notification'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="rounded-xl border bg-card p-4 shadow-soft sm:p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <div className="relative sm:col-span-2">
                                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={historyQ}
                                    onChange={e => setHistoryQ(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && loadHistory(1)}
                                    placeholder="Search title or message..."
                                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                            </div>
                            <select
                                value={historyAudience}
                                onChange={e => setHistoryAudience(e.target.value)}
                                className="px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            >
                                <option value="">All audiences</option>
                                <option value="all">Broadcast All</option>
                                <option value="phone">By Phone</option>
                                <option value="users">Pick Users</option>
                            </select>
                            <select
                                value={historyStatus}
                                onChange={e => setHistoryStatus(e.target.value)}
                                className="px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            >
                                <option value="">All statuses</option>
                                <option value="completed">Completed</option>
                                <option value="partial">Partial</option>
                                <option value="failed">Failed</option>
                                <option value="sending">Sending</option>
                            </select>
                        </div>
                        <div className="flex justify-end mt-2">
                            <button
                                onClick={() => loadHistory(1)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                            >
                                <RefreshCw className="w-3 h-3" /> Apply / Refresh
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    {historyLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="bg-card border border-border rounded-lg p-8 text-center">
                            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                            <p className="text-sm text-muted-foreground">No notifications sent yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {campaigns.map(c => (
                                <div key={c._id} className="rounded-xl border bg-card p-4 shadow-soft sm:p-4 hover:border-primary/50 transition">
                                    <div className="flex items-start justify-between gap-3">
                                        <button
                                            onClick={() => openDetail(c._id)}
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <div className="flex items-center flex-wrap gap-2 mb-1">
                                                <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{c.title}</h3>
                                                <StatusBadge status={c.status || 'pending'} />
                                                {c.resendOf && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                                        <RefreshCw className="w-2.5 h-2.5" /> resend
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2">{c.message}</p>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                                <span className="inline-flex items-center gap-1">
                                                    {c.audience === 'all' && <Radio className="w-3 h-3" />}
                                                    {c.audience === 'phone' && <Phone className="w-3 h-3" />}
                                                    {c.audience === 'users' && <Users className="w-3 h-3" />}
                                                    {c.audience}
                                                </span>
                                                <span>{c.successful ?? 0}/{c.totalTargets ?? 0} sent</span>
                                                {(c.pushDelivered ?? 0) > 0 && <span>{c.pushDelivered} push</span>}
                                                {(c.failed ?? 0) > 0 && <span className="text-red-500">{c.failed} failed</span>}
                                                <span>{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</span>
                                            </div>
                                        </button>
                                        <div className="flex flex-col sm:flex-row gap-1.5 flex-shrink-0">
                                            <button
                                                onClick={() => handleResend(c._id)}
                                                title="Resend"
                                                className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(c._id)}
                                                title="Delete"
                                                className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {historyPages > 1 && (
                        <div className="flex justify-center items-center gap-2 pt-2">
                            <button
                                disabled={historyPage <= 1}
                                onClick={() => loadHistory(historyPage - 1)}
                                className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40"
                            >
                                Prev
                            </button>
                            <span className="text-sm text-muted-foreground">
                                Page {historyPage} / {historyPages}
                            </span>
                            <button
                                disabled={historyPage >= historyPages}
                                onClick={() => loadHistory(historyPage + 1)}
                                className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Detail modal ─── */}
            {detailCampaign && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
                    onClick={() => setDetailCampaign(null)}
                >
                    <div
                        className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="font-bold text-foreground">Campaign Details</h3>
                            <button onClick={() => setDetailCampaign(null)} className="p-2 rounded-lg hover:bg-muted border border-transparent hover:border-border hover:shadow-sm">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {detailLoading ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="p-4 overflow-y-auto space-y-4 text-sm">
                                <div>
                                    <h4 className="font-semibold text-foreground mb-1">{detailCampaign.title}</h4>
                                    <p className="text-muted-foreground whitespace-pre-wrap">{detailCampaign.message}</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { label: 'Targets', value: detailCampaign.totalTargets ?? 0 },
                                        { label: 'Sent', value: detailCampaign.successful ?? 0, color: 'text-green-500' },
                                        { label: 'Push', value: detailCampaign.pushDelivered ?? 0, color: 'text-blue-500' },
                                        { label: 'Failed', value: detailCampaign.failed ?? 0, color: 'text-red-500' },
                                    ].map(s => (
                                        <div key={s.label} className="bg-muted/30 rounded-lg p-2 text-center">
                                            <p className={`text-lg font-bold ${s.color || 'text-foreground'}`}>{s.value}</p>
                                            <p className="text-[10px] uppercase text-muted-foreground">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    <StatusBadge status={detailCampaign.status || 'pending'} />
                                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                        Audience: {detailCampaign.audience}
                                    </span>
                                    {detailCampaign.sentBy?.name && (
                                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                            By: {detailCampaign.sentBy.name}
                                        </span>
                                    )}
                                </div>
                                {detailCampaign.error && (
                                    <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-xs">
                                        {detailCampaign.error}
                                    </div>
                                )}
                                {detailCampaign.targetPhones?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">Target Phones</p>
                                        <div className="flex flex-wrap gap-1">
                                            {detailCampaign.targetPhones.map((p: string, i: number) => (
                                                <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs">{p}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {detailCampaign.targets?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">Recipients ({detailCampaign.targets.length})</p>
                                        <div className="max-h-60 overflow-y-auto space-y-1">
                                            {detailCampaign.targets.map((u: any) => (
                                                <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-medium text-foreground truncate">{u.name || 'Unnamed'}</p>
                                                        <p className="text-muted-foreground">{u.phone}</p>
                                                    </div>
                                                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="pt-2 border-t border-border flex flex-col sm:flex-row gap-2">
                                    <button
                                        onClick={() => { handleResend(detailCampaign._id); setDetailCampaign(null) }}
                                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-sm text-sm font-semibold hover:opacity-90"
                                    >
                                        <RefreshCw className="w-4 h-4" /> Resend
                                    </button>
                                    <button
                                        onClick={() => { handleDelete(detailCampaign._id); setDetailCampaign(null) }}
                                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-sm font-semibold hover:bg-red-500/20"
                                    >
                                        <Trash2 className="w-4 h-4" /> Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}


