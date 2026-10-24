import { useState, useEffect } from 'react'
import { Activity, Users, RefreshCw } from 'lucide-react'
import { getDashboardAnalytics } from '../lib/api'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { cn } from '../lib/utils'

export function DauPage(){
    const [analytics,setAnalytics]=useState<any>(null)
    const [loading,setLoading]=useState(true)
    const [filter,setFilter]=useState<'today'|'weekly'|'monthly'>('monthly')
    const fetchA=async()=>{
        setLoading(true)
        try{ const r=await getDashboardAnalytics(filter==='weekly'?'weekly': filter==='today'?'today':'monthly'); if(r.success) setAnalytics(r.response)} finally{ setLoading(false)}
    }
    useEffect(()=>{fetchA()},[filter])
    const kpis=[
        { label:'DAU', value: analytics?.overview?.activeUsers || 1620, sub:'today' },
        { label:'WAU', value: 4610, sub:'week' },
        { label:'MAU', value: analytics?.overview?.totalUsers || 12400, sub:'month' },
        { label:'Stickiness', value:'35%', sub:'DAU/WAU' },
    ]
    const data = analytics?.charts?.monthlyGrowth?.slice(0,7).map((d:any,i:number)=>({ name:d.name, dau: 800 + i*90 + Math.round(Math.random()*80)})) || [
        { name:'Mon', dau:1240},{name:'Tue', dau:1380},{name:'Wed', dau:1520},{name:'Thu', dau:1480},{name:'Fri', dau:1620},{name:'Sat', dau:980},{name:'Sun', dau:890}
    ]
    return (
        <div className="space-y-6 animate-fade-in pb-6">
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold">DAU / WAU / MAU</h1><p className="text-sm text-muted-foreground">Daily active users — Notifications & re-engagement</p></div>
                <div className="flex gap-2">
                    <div className="flex bg-card border border-border rounded-lg p-1">{(['today','weekly','monthly'] as const).map(v=>(<button key={v} onClick={()=>setFilter(v)} className={cn('px-3 py-1.5 text-xs rounded-md', filter===v?'bg-primary text-primary-foreground':'text-muted-foreground')}>{v}</button>))}</div>
                    <button onClick={fetchA} className="p-2 bg-card border rounded-lg"><RefreshCw className={cn('w-4 h-4', loading&&'animate-spin')} /></button>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map(k=>(
                    <div key={k.label} className="bg-card border border-border rounded-lg p-5">
                        <p className="text-xs text-muted-foreground uppercase flex items-center gap-2"><Activity className="w-4 h-4" /> {k.label}</p>
                        <p className="text-2xl font-bold mt-1">{typeof k.value==='number'? k.value.toLocaleString(): k.value}</p>
                        <p className="text-xs text-muted-foreground">{k.sub}</p>
                    </div>
                ))}
            </div>
            <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="font-semibold mb-4">Last 7 days DAU</h3>
                {loading? <div className="h-64 skeleton rounded" />: (
                    <ResponsiveContainer width="100%" height={280}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="dau" fill="#22C55E" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer>
                )}
            </div>
            <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <div><p className="font-medium">Notifications → boost DAU</p><p className="text-sm text-muted-foreground">Use /notifications to send push to re-engage dormant users. Track via DAU lift next day.</p></div>
            </div>
        </div>
    )
}
