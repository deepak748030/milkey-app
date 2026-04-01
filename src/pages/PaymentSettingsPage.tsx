import { useState, useEffect } from 'react'
import { Banknote, Wifi, Loader2 } from 'lucide-react'
import { getPaymentSettings, updatePaymentSettings } from '../lib/api'

export function PaymentSettingsPage() {
    const [codEnabled, setCodEnabled] = useState(false)
    const [onlineEnabled, setOnlineEnabled] = useState(true)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await getPaymentSettings()
            if (res.success && res.response) {
                setCodEnabled(res.response.codEnabled)
                setOnlineEnabled(res.response.onlineEnabled)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = async (type: 'cod' | 'online') => {
        setSaving(true)
        setMessage('')
        const newCod = type === 'cod' ? !codEnabled : codEnabled
        const newOnline = type === 'online' ? !onlineEnabled : onlineEnabled

        try {
            const res = await updatePaymentSettings({ codEnabled: newCod, onlineEnabled: newOnline })
            if (res.success) {
                setCodEnabled(newCod)
                setOnlineEnabled(newOnline)
                setMessage('Settings updated successfully')
                setTimeout(() => setMessage(''), 3000)
            }
        } catch (err) {
            setMessage('Failed to update settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Payment Settings</h1>
                <p className="text-muted-foreground mt-1">Control which payment methods are available for customers</p>
            </div>

            {message && (
                <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.includes('success')
                        ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                        : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                    {message}
                </div>
            )}

            <div className="space-y-4">
                {/* Online Payment */}
                <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${onlineEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                            <Wifi className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">Online Payment (UPI)</h3>
                            <p className="text-sm text-muted-foreground">
                                Customers pay online via UPI - GPay, PhonePe, Paytm
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleToggle('online')}
                        disabled={saving}
                        className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${onlineEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                            }`}
                    >
                        <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${onlineEnabled ? 'translate-x-7' : 'translate-x-0.5'
                            }`} />
                    </button>
                </div>

                {/* Cash on Delivery */}
                <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${codEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                            <Banknote className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">Cash on Delivery (COD)</h3>
                            <p className="text-sm text-muted-foreground">
                                Customers pay cash when they receive the product
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleToggle('cod')}
                        disabled={saving}
                        className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${codEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                            }`}
                    >
                        <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${codEnabled ? 'translate-x-7' : 'translate-x-0.5'
                            }`} />
                    </button>
                </div>
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border">
                <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> At least one payment method should be enabled.
                    Currently Online Payment is {onlineEnabled ? 'ON' : 'OFF'} and COD is {codEnabled ? 'ON' : 'OFF'}.
                </p>
            </div>
        </div>
    )
}
