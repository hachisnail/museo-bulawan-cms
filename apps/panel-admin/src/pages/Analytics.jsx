import { useState, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
    TrendingUp, ArrowUpRight, Activity, 
    Layers, Inbox, FileCheck, Database, Filter, Download,
    Heart, Shield, DollarSign, Hammer, History
} from 'lucide-react';

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

export default function Analytics() {
    const { apiFetch } = useAuth();
    const [data, setData] = useState(null);
    const [health, setHealth] = useState(null);
    const [valuations, setValuations] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ startDate: '', endDate: '' });

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams(filters).toString();
            const [acqRes, healthRes, valRes] = await Promise.all([
                apiFetch(`/api/v1/analytics/acquisitions?${query}`),
                apiFetch(`/api/v1/analytics/collection-health`),
                apiFetch(`/api/v1/analytics/valuations`)
            ]);
            
            const acqJson = await acqRes.json();
            const healthJson = await healthRes.json();
            const valJson = await valRes.json();

            if (acqJson.status === 'success') setData(acqJson.data);
            if (healthJson.status === 'success') setHealth(healthJson.data);
            if (valJson.status === 'success') setValuations(valJson.data);
            
        } catch (err) {
            console.error("Failed to fetch analytics", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [filters]);

    if (loading && !data) return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Header */}
            <header className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-2 text-indigo-400 mb-2">
                        <Activity className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Institutional Dashboard</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white">Curatorial Intelligence</h1>
                    <p className="text-zinc-500 mt-1 font-medium italic">Comprehensive health metrics and acquisition performance monitoring.</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-2">
                        <Filter className="w-4 h-4 text-zinc-500 ml-2" />
                        <input 
                            type="date" 
                            value={filters.startDate}
                            onChange={e => setFilters({...filters, startDate: e.target.value})}
                            className="bg-transparent border-none text-xs text-white focus:outline-none px-2" 
                        />
                        <span className="text-zinc-700">to</span>
                        <input 
                            type="date" 
                            value={filters.endDate}
                            onChange={e => setFilters({...filters, endDate: e.target.value})}
                            className="bg-transparent border-none text-xs text-white focus:outline-none px-2" 
                        />
                    </div>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <KPICard title="Total Assets" value={data?.totals.inventory} icon={<Database />} trend="+8%" color="indigo" />
                <KPICard title="Collection Health" value={`${health?.healthPercentage}%`} icon={<Heart />} trend="Stable" color="emerald" />
                <KPICard title="Maintenace Needed" value={health?.maintenanceRequired} icon={<Hammer />} trend="Priority" color="rose" />
                <KPICard 
                    title="Total Value" 
                    value={valuations?.totalValue?.[0]?.total ? `${new Intl.NumberFormat().format(valuations.totalValue[0].total)} ${valuations.totalValue[0].currency}` : 'N/A'} 
                    icon={<DollarSign />} 
                    trend="Appraised" 
                    color="amber" 
                />
            </div>

            {/* Row 1: Growth & Health Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 glass-panel rounded-[40px] p-8 border border-white/5 shadow-2xl relative group overflow-hidden">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-8 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-400" /> Catalog Growth Trend
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.trends.monthlyGrowth}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="month" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                                <YAxis stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0a0a0c', border: '1px solid #ffffff10', borderRadius: '16px', fontSize: '10px', color: '#fff' }} />
                                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-4 glass-panel rounded-[40px] p-8 border border-white/5 shadow-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-8 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-400" /> Physical Condition Distribution
                    </h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={health?.healthDistribution}
                                    cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}
                                    dataKey="count" nameKey="state"
                                >
                                    {health?.healthDistribution?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#0a0a0c', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                        {health?.healthDistribution?.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                    <span className="text-zinc-500">{item.state}</span>
                                </div>
                                <span className="text-white">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Row 2: Recent Conservation & Workflow */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-5 glass-panel rounded-[40px] p-8 border border-white/5 shadow-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-8 flex items-center gap-2">
                        <History className="w-4 h-4 text-purple-400" /> Recent Conservation Efforts
                    </h3>
                    <div className="space-y-4">
                        {health?.recentTreatments?.length === 0 ? (
                            <p className="text-xs text-zinc-600 italic">No recent conservation records.</p>
                        ) : health?.recentTreatments?.map((t, i) => (
                            <div key={i} className="flex items-start gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs">
                                    {i+1}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white">#{t.catalog_number}</div>
                                    <p className="text-[10px] text-zinc-500 line-clamp-1">{t.treatment_details}</p>
                                    <div className="text-[9px] text-zinc-700 font-mono mt-1">{new Date(t.created_at).toLocaleDateString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-7 glass-panel rounded-[40px] p-8 border border-white/5 shadow-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-8 flex items-center gap-2">
                        <Inbox className="w-4 h-4 text-orange-400" /> Acquisition Pipeline Efficiency
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.distributions.intakeStatus}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="status" stroke="#52525b" fontSize={8} axisLine={false} tickLine={false} />
                                <YAxis stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0a0a0c', border: '1px solid #ffffff10', borderRadius: '16px', fontSize: '10px' }} />
                                <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KPICard({ title, value, icon, trend, color }) {
    const colorMap = {
        indigo: 'from-indigo-500/20 to-indigo-500/5 text-indigo-400 border-indigo-500/20 shadow-indigo-500/5',
        purple: 'from-purple-500/20 to-purple-500/5 text-purple-400 border-purple-500/20 shadow-purple-500/5',
        emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5',
        rose: 'from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/20 shadow-rose-500/5',
        amber: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20 shadow-amber-500/5',
    };

    return (
        <div className={`glass-panel rounded-[32px] p-8 border ${colorMap[color]} shadow-2xl relative overflow-hidden group`}>
            <div className="flex justify-between items-start relative z-10">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform">
                    {icon}
                </div>
                <div className="flex items-center gap-1 text-[9px] font-black uppercase bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    {trend}
                </div>
            </div>
            <div className="mt-8 relative z-10">
                <div className="text-2xl font-black text-white tracking-tighter mb-1 line-clamp-1">{value}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{title}</div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
        </div>
    );
}
