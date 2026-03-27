import { useState, useEffect } from 'react'
import { Save, RefreshCw, Smartphone, ExternalLink, AlertTriangle, Shield } from 'lucide-react'
import { getAppVersion, updateAppVersion } from '@/lib/api'

export function AppVersionPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [form, setForm] = useState({
        latestVersion: '1.0.0',
        minVersion: '1.0.0',
        playStoreLink: '',
        appStoreLink: '',
        forceUpdate: false,
        updateMessage: 'A new version is available. Please update for the best experience.',
        forceUpdateMessage: 'This version is no longer supported. Please update to continue using the app.',
    })

    const fetchVersion = async () => {
        setLoading(true)
        try {
            const res = await getAppVersion()
            if (res.success && res.response) {
                setForm({
                    latestVersion: res.response.latestVersion || '1.0.0',
                    minVersion: res.response.minVersion || '1.0.0',
                    playStoreLink: res.response.playStoreLink || '',
                    appStoreLink: res.response.appStoreLink || '',
                    forceUpdate: res.response.forceUpdate || false,
                    updateMessage: res.response.updateMessage || '',
                    forceUpdateMessage: res.response.forceUpdateMessage || '',
                })
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchVersion() }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await updateAppVersion(form)
            if (res.success) {
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
            }
        } catch (e) { console.error(e) }
        finally { setSaving(false) }
    }

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="h-8 w-48 bg-muted rounded animate-pulse" />
                <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Smartphone className="w-6 h-6 text-primary" /> App Version Management
                    </h1>
                    <p className="text-muted-foreground">Manage app updates, store links, and force update settings</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchVersion} className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                        <Save className="w-4 h-4" /> {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
                    </button>
                </div>
            </div>

            {saved && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center gap-3 text-primary">
                    <Shield className="w-5 h-5" /> Settings saved successfully! Changes will reflect immediately for app users.
                </div>
            )}

            {/* Version Section */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Version Settings
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Latest Version</label>
                        <input
                            type="text"
                            value={form.latestVersion}
                            onChange={e => setForm(f => ({ ...f, latestVersion: e.target.value }))}
                            placeholder="e.g. 2.1.0"
                            className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                        />
                        <p className="text-xs text-muted-foreground">Users below this version will see optional update</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Minimum Version (Force)</label>
                        <input
                            type="text"
                            value={form.minVersion}
                            onChange={e => setForm(f => ({ ...f, minVersion: e.target.value }))}
                            placeholder="e.g. 1.5.0"
                            className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                        />
                        <p className="text-xs text-muted-foreground">Users below this version MUST update (can't skip)</p>
                    </div>
                </div>
            </div>

            {/* Store Links Section */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-primary" /> Store Links
                </h2>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Play Store Link (Android)</label>
                        <input
                            type="url"
                            value={form.playStoreLink}
                            onChange={e => setForm(f => ({ ...f, playStoreLink: e.target.value }))}
                            placeholder="https://play.google.com/store/apps/details?id=..."
                            className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">App Store Link (iOS)</label>
                        <input
                            type="url"
                            value={form.appStoreLink}
                            onChange={e => setForm(f => ({ ...f, appStoreLink: e.target.value }))}
                            placeholder="https://apps.apple.com/app/..."
                            className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                        />
                    </div>
                </div>
            </div>

            {/* Force Update Section */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-warning" /> Update Behavior
                </h2>
                <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
                    <div>
                        <p className="font-medium text-foreground">Force Update Enabled</p>
                        <p className="text-sm text-muted-foreground">When ON, users below min version cannot skip the update</p>
                    </div>
                    <button
                        onClick={() => setForm(f => ({ ...f, forceUpdate: !f.forceUpdate }))}
                        className={`relative w-14 h-7 rounded-full transition-colors ${form.forceUpdate ? 'bg-primary' : 'bg-muted'}`}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.forceUpdate ? 'translate-x-7' : ''}`} />
                    </button>
                </div>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Optional Update Message</label>
                        <textarea
                            value={form.updateMessage}
                            onChange={e => setForm(f => ({ ...f, updateMessage: e.target.value }))}
                            rows={2}
                            className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground resize-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Force Update Message</label>
                        <textarea
                            value={form.forceUpdateMessage}
                            onChange={e => setForm(f => ({ ...f, forceUpdateMessage: e.target.value }))}
                            rows={2}
                            className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Preview */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Current Configuration Preview</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-background rounded-lg p-3 border border-border text-center">
                        <p className="text-xs text-muted-foreground">Latest</p>
                        <p className="text-lg font-bold text-primary">{form.latestVersion}</p>
                    </div>
                    <div className="bg-background rounded-lg p-3 border border-border text-center">
                        <p className="text-xs text-muted-foreground">Min Version</p>
                        <p className="text-lg font-bold text-destructive">{form.minVersion}</p>
                    </div>
                    <div className="bg-background rounded-lg p-3 border border-border text-center">
                        <p className="text-xs text-muted-foreground">Force Update</p>
                        <p className={`text-lg font-bold ${form.forceUpdate ? 'text-destructive' : 'text-green-500'}`}>
                            {form.forceUpdate ? 'ON' : 'OFF'}
                        </p>
                    </div>
                    <div className="bg-background rounded-lg p-3 border border-border text-center">
                        <p className="text-xs text-muted-foreground">Store Links</p>
                        <p className="text-lg font-bold text-primary">
                            {[form.playStoreLink, form.appStoreLink].filter(Boolean).length}/2
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
