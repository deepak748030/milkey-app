import { useEffect, useState } from 'react'
import { Loader2, MessageCircle, Send, AlertCircle } from 'lucide-react'
import { getWhatsappSettings, updateWhatsappSettings, sendWhatsappTest } from '../lib/api'

export function WhatsappSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const [enabled, setEnabled] = useState(true)
    const [welcomeMessage, setWelcomeMessage] = useState('')
    const [memberWelcomeMessage, setMemberWelcomeMessage] = useState('')
    const [paymentSuccessMessage, setPaymentSuccessMessage] = useState('')
    const [paymentFailedMessage, setPaymentFailedMessage] = useState('')
    const [connectionId, setConnectionId] = useState<number>(0)
    const [apiKeyConfigured, setApiKeyConfigured] = useState(false)

    const [testPhone, setTestPhone] = useState('')
    const [testName, setTestName] = useState('')

    useEffect(() => { fetchSettings() }, [])

    const fetchSettings = async () => {
        try {
            const res = await getWhatsappSettings()
            if (res.success && res.response) {
                setEnabled(res.response.enabled)
                setWelcomeMessage(res.response.welcomeMessage || '')
                setMemberWelcomeMessage(res.response.memberWelcomeMessage || '')
                setPaymentSuccessMessage(res.response.paymentSuccessMessage || '')
                setPaymentFailedMessage(res.response.paymentFailedMessage || '')
                setConnectionId(res.response.connectionId || 0)
                setApiKeyConfigured(!!res.response.apiKeyConfigured)
            }
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Failed to load settings')
        } finally {
            setLoading(false)
        }
    }

    const flash = (msg: string, isErr = false) => {
        if (isErr) { setError(msg); setMessage('') } else { setMessage(msg); setError('') }
        setTimeout(() => { setMessage(''); setError('') }, 4000)
    }

    const handleSave = async () => {
        if (!welcomeMessage.trim()) { flash('Welcome message cannot be empty', true); return }
        if (!memberWelcomeMessage.trim()) { flash('Member welcome message cannot be empty', true); return }
        if (!paymentSuccessMessage.trim()) { flash('Payment success message cannot be empty', true); return }
        if (!paymentFailedMessage.trim()) { flash('Payment failed message cannot be empty', true); return }
        setSaving(true)
        try {
            const res = await updateWhatsappSettings({
                enabled,
                welcomeMessage,
                memberWelcomeMessage,
                paymentSuccessMessage,
                paymentFailedMessage,
                connectionId
            })
            if (res.success) flash('Settings saved successfully')
            else flash(res.message || 'Failed to save', true)
        } catch (e: any) {
            flash(e?.response?.data?.message || 'Failed to save', true)
        } finally {
            setSaving(false)
        }
    }

    const handleTest = async () => {
        if (!testPhone.trim()) { flash('Enter a phone number to test', true); return }
        setTesting(true)
        try {
            const res = await sendWhatsappTest({ phone: testPhone.trim(), name: testName.trim() || undefined })
            if (res.success) flash('Test message sent successfully')
            else flash(res.message || 'Failed to send test', true)
        } catch (e: any) {
            flash(e?.response?.data?.message || 'Failed to send test', true)
        } finally {
            setTesting(false)
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
        <div className="max-w-3xl mx-auto animate-fade-in">
            <div className="mb-6 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">WhatsApp Automation</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Automatic WhatsApp messages for new users, new members and payment success/failed events. Powered by Zyptos.
                    </p>
                </div>
            </div>

            {!apiKeyConfigured && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-600 text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span><strong>ZYPTOS_API_KEY</strong> is not set on the server. Add it in <code>server/.env</code> to start sending messages.</span>
                </div>
            )}

            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/25 rounded-lg text-blue-600 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                    Phone can be entered as <code>7489301982</code> or <code>+917489301982</code>; the server converts it to E.164. If Zyptos returns <strong>Public API access is currently disabled</strong>, enable Public API access in Zyptos Developer settings or regenerate a live key with WhatsApp API permissions.
                </span>
            </div>

            {message && (
                <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                    {message}
                </div>
            )}
            {error && (
                <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                    {error}
                </div>
            )}

            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-foreground">Send on new registration</h3>
                        <p className="text-sm text-muted-foreground">Automatically send welcome message to new users.</p>
                    </div>
                    <button
                        onClick={() => setEnabled(v => !v)}
                        className={`relative w-[52px] h-[28px] rounded-full transition-all duration-300 ${enabled ? 'bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.4)]' : 'bg-muted-foreground/20'}`}
                    >
                        <span className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-md transition-all duration-300 ${enabled ? 'translate-x-[24px]' : 'translate-x-0'}`} />
                    </button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Welcome Message (New User Registration)</label>
                    <textarea
                        value={welcomeMessage}
                        onChange={e => setWelcomeMessage(e.target.value)}
                        rows={6}
                        maxLength={4096}
                        placeholder="Hi {{name}}, welcome to Milkey!"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                        Available variables: <code>{'{{name}}'}</code>, <code>{'{{phone}}'}</code>, <code>{'{{referralCode}}'}</code>, <code>{'{{email}}'}</code>
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Member Welcome Message (New Member Added)</label>
                    <textarea
                        value={memberWelcomeMessage}
                        onChange={e => setMemberWelcomeMessage(e.target.value)}
                        rows={4}
                        maxLength={4096}
                        placeholder="Hi {{name}}, you have been added as a member on Milkey."
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                        Sent to the member's WhatsApp when a new member/customer is added. Variables: <code>{'{{name}}'}</code>, <code>{'{{phone}}'}</code>
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Payment Success Message</label>
                    <textarea
                        value={paymentSuccessMessage}
                        onChange={e => setPaymentSuccessMessage(e.target.value)}
                        rows={4}
                        maxLength={4096}
                        placeholder="Hi {{name}}, your payment of ₹{{amount}} for {{plan}} was successful."
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                        Sent when a payment/subscription transaction succeeds. Variables: <code>{'{{name}}'}</code>, <code>{'{{phone}}'}</code>, <code>{'{{amount}}'}</code>, <code>{'{{plan}}'}</code>, <code>{'{{transactionId}}'}</code>, <code>{'{{date}}'}</code>
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Payment Failed Message</label>
                    <textarea
                        value={paymentFailedMessage}
                        onChange={e => setPaymentFailedMessage(e.target.value)}
                        rows={4}
                        maxLength={4096}
                        placeholder="Hi {{name}}, your payment could not be completed. Please try again."
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                        Sent when a payment/subscription transaction fails. Variables: <code>{'{{name}}'}</code>, <code>{'{{phone}}'}</code>, <code>{'{{amount}}'}</code>, <code>{'{{plan}}'}</code>, <code>{'{{transactionId}}'}</code>, <code>{'{{date}}'}</code>
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Zyptos Connection ID (optional)</label>
                    <input
                        type="number"
                        value={connectionId || ''}
                        onChange={e => setConnectionId(Number(e.target.value) || 0)}
                        placeholder="Leave empty to use the default WABA connection"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Settings
                    </button>
                </div>
            </div>

            <div className="mt-6 bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-1">Send a test message</h3>
                <p className="text-sm text-muted-foreground mb-4">Sends the current welcome message to any phone number.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                        type="tel"
                        value={testPhone}
                        onChange={e => setTestPhone(e.target.value)}
                        placeholder="Phone (e.g. 9876543210 or +919876543210)"
                        className="px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <input
                        type="text"
                        value={testName}
                        onChange={e => setTestName(e.target.value)}
                        placeholder="Name (optional)"
                        className="px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                </div>
                <div className="flex justify-end mt-4">
                    <button
                        onClick={handleTest}
                        disabled={testing}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send Test
                    </button>
                </div>
            </div>
        </div>
    )
}
