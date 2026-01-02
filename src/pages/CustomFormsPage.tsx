import { useState, useEffect } from 'react'
import { FileText, Trash2, Eye, Search, Filter, X, User, Mail, Phone, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { TableSkeleton } from '../components/TableSkeleton'
import { Pagination } from '../components/Pagination'

interface FormField {
    label: string
    value: string
}

interface CustomForm {
    _id: string
    formName: string
    fields: FormField[]
    status: 'pending' | 'reviewed' | 'approved' | 'rejected'
    adminNotes: string
    createdAt: string
    user: {
        _id: string
        name: string
        email: string
        phone: string
    }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export function CustomFormsPage() {
    const [forms, setForms] = useState<CustomForm[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [selectedForm, setSelectedForm] = useState<CustomForm | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [formToDelete, setFormToDelete] = useState<CustomForm | null>(null)
    const [updating, setUpdating] = useState(false)
    const [adminNotes, setAdminNotes] = useState('')
    const [newStatus, setNewStatus] = useState<string>('')

    const limit = 10

    const fetchForms = async () => {
        try {
            setLoading(true)
            const token = localStorage.getItem('admin_token')
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            })
            if (statusFilter) params.append('status', statusFilter)

            const response = await fetch(`${API_URL}/custom-forms/admin?${params}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
            const data = await response.json()
            if (data.success) {
                setForms(data.response.data)
                setTotalCount(data.response.count)
                setTotalPages(Math.ceil(data.response.count / limit))
            }
        } catch (error) {
            console.error('Error fetching forms:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchForms()
    }, [page, statusFilter])

    const handleViewForm = (form: CustomForm) => {
        setSelectedForm(form)
        setAdminNotes(form.adminNotes || '')
        setNewStatus(form.status)
        setShowModal(true)
    }

    const handleUpdateStatus = async () => {
        if (!selectedForm) return
        try {
            setUpdating(true)
            const token = localStorage.getItem('admin_token')
            const response = await fetch(`${API_URL}/custom-forms/${selectedForm._id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    status: newStatus,
                    adminNotes,
                }),
            })
            const data = await response.json()
            if (data.success) {
                setShowModal(false)
                fetchForms()
            }
        } catch (error) {
            console.error('Error updating form:', error)
        } finally {
            setUpdating(false)
        }
    }

    const handleDeleteClick = (form: CustomForm) => {
        setFormToDelete(form)
        setShowDeleteModal(true)
    }

    const handleDeleteConfirm = async () => {
        if (!formToDelete) return
        try {
            setUpdating(true)
            const token = localStorage.getItem('admin_token')
            const response = await fetch(`${API_URL}/custom-forms/admin/${formToDelete._id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
            const data = await response.json()
            if (data.success) {
                setShowDeleteModal(false)
                setFormToDelete(null)
                fetchForms()
            }
        } catch (error) {
            console.error('Error deleting form:', error)
        } finally {
            setUpdating(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            reviewed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        }
        return styles[status] || styles.pending
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircle className="w-4 h-4" />
            case 'rejected':
                return <XCircle className="w-4 h-4" />
            case 'reviewed':
                return <Eye className="w-4 h-4" />
            default:
                return <AlertCircle className="w-4 h-4" />
        }
    }

    const filteredForms = forms.filter(form =>
        form.formName.toLowerCase().includes(search.toLowerCase()) ||
        form.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        form.user?.email?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Custom Forms</h1>
                <p className="text-muted-foreground mt-1">View and manage forms submitted from the app</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by form name, user name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value)
                            setPage(1)
                        }}
                        className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-2xl font-bold text-foreground">{totalCount}</div>
                    <div className="text-sm text-muted-foreground">Total Forms</div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                        {forms.filter(f => f.status === 'pending').length}
                    </div>
                    <div className="text-sm text-yellow-600 dark:text-yellow-500">Pending</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                        {forms.filter(f => f.status === 'approved').length}
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-500">Approved</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                        {forms.filter(f => f.status === 'rejected').length}
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-500">Rejected</div>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <TableSkeleton rows={5} columns={6} />
            ) : filteredForms.length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-8 text-center">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No forms found</h3>
                    <p className="text-muted-foreground">No custom forms have been submitted yet.</p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Form Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">User</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Fields</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredForms.map((form) => (
                                    <tr key={form._id} className="hover:bg-muted/30">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-primary" />
                                                <span className="font-medium text-foreground">{form.formName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm">
                                                <div className="font-medium text-foreground">{form.user?.name || 'Unknown'}</div>
                                                <div className="text-muted-foreground">{form.user?.email || '-'}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-muted-foreground">{form.fields.length} fields</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(form.status)}`}>
                                                {getStatusIcon(form.status)}
                                                {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-muted-foreground">
                                                {new Date(form.createdAt).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleViewForm(form)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(form)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
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
                <div className="mt-4">
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                    />
                </div>
            )}

            {/* View Form Modal */}
            {showModal && selectedForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-lg font-semibold text-foreground">Form Details</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                            {/* Form Name */}
                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-foreground">{selectedForm.formName}</h3>
                                <p className="text-sm text-muted-foreground">
                                    Submitted on {new Date(selectedForm.createdAt).toLocaleString()}
                                </p>
                            </div>

                            {/* User Info */}
                            <div className="bg-muted/30 rounded-lg p-4 mb-4">
                                <h4 className="font-medium text-foreground mb-3">User Information</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-foreground">{selectedForm.user?.name || 'Unknown'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-foreground">{selectedForm.user?.email || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-foreground">{selectedForm.user?.phone || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Clock className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-foreground">{new Date(selectedForm.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Form Fields */}
                            <div className="mb-4">
                                <h4 className="font-medium text-foreground mb-3">Form Fields</h4>
                                <div className="space-y-3">
                                    {selectedForm.fields.map((field, index) => (
                                        <div key={index} className="bg-muted/30 rounded-lg p-3">
                                            <div className="text-sm font-medium text-muted-foreground">{field.label}</div>
                                            <div className="text-foreground mt-1">{field.value || '-'}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Status Update */}
                            <div className="border-t border-border pt-4">
                                <h4 className="font-medium text-foreground mb-3">Update Status</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                                    {['pending', 'reviewed', 'approved', 'rejected'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => setNewStatus(status)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${newStatus === status
                                                    ? getStatusBadge(status)
                                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                }`}
                                        >
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-foreground mb-2">Admin Notes</label>
                                    <textarea
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        placeholder="Add notes about this form..."
                                        rows={3}
                                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-4 border-t border-border">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateStatus}
                                disabled={updating}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {updating ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && formToDelete && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-xl w-full max-w-md p-6">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Form</h3>
                            <p className="text-muted-foreground mb-6">
                                Are you sure you want to delete "{formToDelete.formName}"? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false)
                                        setFormToDelete(null)
                                    }}
                                    className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    disabled={updating}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                    {updating ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
