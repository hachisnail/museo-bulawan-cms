import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/authContext';
import { 
    Eye, Users, RefreshCw, AlertCircle, Calendar, Newspaper, 
    DollarSign, Archive, Laptop, Globe, FileText, HeartPulse, 
    Activity, ChevronRight, TrendingUp, Award
} from 'lucide-react';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
    CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, Legend 
} from 'recharts';

export default function Analytics() {
    const { apiFetch } = useAuth();
    
    // Tab states: 'traffic' (Visitor Traffic) or 'collection' (Collection Stats)
    const [activeTab, setActiveTab] = useState('traffic');
    const [period, setPeriod] = useState('7d'); // '24h', '7d', '30d'

    // Data States
    const [overviewData, setOverviewData] = useState(null);
    const [umamiData, setUmamiData] = useState(null);
    const [acquisitionsData, setAcquisitionsData] = useState(null);
    const [healthData, setHealthData] = useState(null);
    const [valuationData, setValuationData] = useState(null);

    // Status States
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const fetchAllData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setIsRefreshing(true);
        else setIsLoading(true);
        setError(null);

        try {
            // Fetch everything in parallel
            const [overviewRes, umamiRes, acquisitionsRes, healthRes, valuationRes] = await Promise.all([
                apiFetch('/api/v1/analytics/overview'),
                apiFetch(`/api/v1/analytics/umami?period=${period}`),
                apiFetch('/api/v1/analytics/acquisitions'),
                apiFetch('/api/v1/analytics/collection-health'),
                apiFetch('/api/v1/analytics/valuations')
            ]);

            if (!overviewRes.ok || !umamiRes.ok || !acquisitionsRes.ok || !healthRes.ok || !valuationRes.ok) {
                throw new Error('Some analytics modules failed to load.');
            }

            const [overview, umami, acquisitions, health, valuation] = await Promise.all([
                overviewRes.json(),
                umamiRes.json(),
                acquisitionsRes.json(),
                healthRes.json(),
                valuationRes.json()
            ]);

            setOverviewData(overview.data);
            setUmamiData(umami.data);
            setAcquisitionsData(acquisitions.data);
            setHealthData(health.data);
            setValuationData(valuation.data);
        } catch (err) {
            console.error('Analytics load error:', err);
            setError(err.message || 'Failed to fetch dashboard intelligence.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [apiFetch, period]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP',
            maximumFractionDigits: 0
        }).format(value);
    };

    // Color Palette for Pie/Bar charts (Zinc gray / Gold Theme)
    const COLORS = ['#D4AF37', '#7A40F2', '#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF'];
    const HEALTH_COLORS = {
        'Excellent': '#10B981', // green
        'Good': '#3B82F6',      // blue
        'Fair': '#F59E0B',      // yellow/amber
        'Poor': '#EF4444',      // red
        'Critical': '#7F1D1D'   // dark red
    };

    if (error) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="bg-red-50/50 border border-red-200/60 rounded-2xl p-6 text-center max-w-xl mx-auto mt-20 animate-in fade-in zoom-in-95 duration-300">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-zinc-900 mb-1">Intelligence Offline</h2>
                    <p className="text-zinc-500 text-sm mb-6">{error}</p>
                    <button 
                        onClick={() => fetchAllData()} 
                        className="px-5 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors shadow-sm"
                    >
                        Try Reconnecting
                    </button>
                </div>
            </div>
        );
    }

    // Helper loading skeletons
    const renderCardSkeleton = () => (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm animate-pulse">
            <div className="flex items-center justify-between mb-4">
                <div className="h-4 w-24 bg-zinc-200 rounded"></div>
                <div className="w-10 h-10 bg-zinc-200 rounded-full"></div>
            </div>
            <div className="h-8 w-20 bg-zinc-200 rounded mb-2"></div>
            <div className="h-3 w-32 bg-zinc-200 rounded"></div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight flex items-center gap-3">
                        Curatorial Intelligence
                        <span className="px-2.5 py-1 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 text-[10px] uppercase font-bold tracking-widest rounded">
                            Live Panel
                        </span>
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        Comprehensive visitor telemetry, curation growth, and collection health statistics.
                    </p>
                </div>
                <div className="flex items-center gap-3 self-end md:self-center">
                    {/* Period Switcher (only shows for traffic tab) */}
                    {activeTab === 'traffic' && (
                        <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-xs font-semibold">
                            {[
                                { label: '24h', value: '24h' },
                                { label: '7d', value: '7d' },
                                { label: '30d', value: '30d' }
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setPeriod(opt.value)}
                                    className={`px-3 py-1.5 rounded-md transition-all ${
                                        period === opt.value 
                                            ? 'bg-white text-zinc-950 shadow-sm' 
                                            : 'text-zinc-500 hover:text-zinc-800'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => fetchAllData(true)}
                        disabled={isRefreshing}
                        className="p-2 bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-950 rounded-lg hover:bg-zinc-50 transition-all shadow-sm disabled:opacity-50"
                        title="Refresh metrics"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#D4AF37]' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-zinc-200 mb-8 font-semibold text-sm">
                <button
                    onClick={() => setActiveTab('traffic')}
                    className={`pb-4 px-4 transition-all relative ${
                        activeTab === 'traffic' 
                            ? 'text-zinc-950' 
                            : 'text-zinc-400 hover:text-zinc-700'
                    }`}
                >
                    Visitor Telemetry
                    {activeTab === 'traffic' && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]"></span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('collection')}
                    className={`pb-4 px-4 transition-all relative ${
                        activeTab === 'collection' 
                            ? 'text-zinc-950' 
                            : 'text-zinc-400 hover:text-zinc-700'
                    }`}
                >
                    Collection Analytics
                    {activeTab === 'collection' && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]"></span>
                    )}
                </button>
            </div>

            {/* KPI Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {isLoading ? (
                    Array(4).fill(0).map((_, i) => <React.Fragment key={i}>{renderCardSkeleton()}</React.Fragment>)
                ) : (
                    activeTab === 'traffic' ? (
                        <>
                            {/* Pageviews */}
                            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Page Views</span>
                                    <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/5 transition-colors">
                                        <Eye className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-extrabold text-zinc-950 tracking-tight">
                                    {umamiData?.stats?.pageviews?.value ?? 0}
                                </div>
                                <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1">
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                                    Total page reads across visitor channels
                                </p>
                            </div>

                            {/* Visitors */}
                            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Unique Visitors</span>
                                    <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/5 transition-colors">
                                        <Users className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-extrabold text-zinc-950 tracking-tight">
                                    {umamiData?.stats?.visitors?.value ?? 0}
                                </div>
                                <p className="text-xs text-zinc-400 mt-2">
                                    Individuals visiting the museum digital sites
                                </p>
                            </div>

                            {/* Bounce Rate */}
                            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Bounce Rate</span>
                                    <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/5 transition-colors">
                                        <Activity className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-extrabold text-zinc-950 tracking-tight">
                                    {umamiData?.stats?.bounces?.value !== undefined 
                                        ? `${Math.round(umamiData?.stats?.bounces?.value)}%` 
                                        : '0%'}
                                </div>
                                <p className="text-xs text-zinc-400 mt-2">
                                    Visits ending after reading a single page
                                </p>
                            </div>

                            {/* Avg Session Duration */}
                            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Avg Time / Session</span>
                                    <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/5 transition-colors">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-extrabold text-zinc-950 tracking-tight">
                                    {umamiData?.stats?.totaltime?.value 
                                        ? `${Math.round(umamiData?.stats?.totaltime?.value / 60)}m` 
                                        : '0m'}
                                </div>
                                <p className="text-xs text-zinc-400 mt-2">
                                    Average continuous duration of visits
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Inventory count */}
                            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Inventory Items</span>
                                    <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/5 transition-colors">
                                        <Archive className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-extrabold text-zinc-950 tracking-tight">
                                    {overviewData?.totals?.inventory ?? 0}
                                </div>
                                <p className="text-xs text-zinc-400 mt-2">
                                    Registered physical artifacts & holdings
                                </p>
                            </div>

                            {/* Estimated Value */}
                            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Curation Valuation</span>
                                    <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/5 transition-colors">
                                        <DollarSign className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-extrabold text-zinc-950 tracking-tight">
                                    {formatCurrency(overviewData?.totals?.estimatedValue ?? 0)}
                                </div>
                                <p className="text-xs text-zinc-400 mt-2">
                                    Estimated sum of active item valuations
                                </p>
                            </div>

                            {/* CMS Articles count */}
                            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">CMS Publications</span>
                                    <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/5 transition-colors">
                                        <Newspaper className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-extrabold text-zinc-950 tracking-tight">
                                    {overviewData?.totals?.articles ?? 0}
                                </div>
                                <p className="text-xs text-zinc-400 mt-2">
                                    Published news & articles in Payload CMS
                                </p>
                            </div>

                            {/* Appointments count */}
                            <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Appointments</span>
                                    <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/5 transition-colors">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-extrabold text-zinc-950 tracking-tight">
                                    {overviewData?.totals?.appointments ?? 0}
                                </div>
                                <p className="text-xs text-zinc-400 mt-2">
                                    Scheduled visits & museum entries
                                </p>
                            </div>
                        </>
                    )
                )}
            </div>

            {/* Main Visualizations Section */}
            {isLoading ? (
                <div className="bg-white p-8 rounded-3xl border border-zinc-200/80 shadow-sm h-[400px] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-zinc-200 border-t-[#D4AF37] rounded-full animate-spin"></div>
                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Parsing Dashboard Metrics...</p>
                    </div>
                </div>
            ) : (
                activeTab === 'traffic' ? (
                    <div className="space-y-8">
                        {/* Area Chart: Views & Sessions */}
                        <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-sm">
                            <h3 className="text-base font-bold text-zinc-950 mb-6 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-[#D4AF37]" />
                                Traffic Growth Trend
                            </h3>
                            <div className="h-80 w-full font-mono text-xs">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart 
                                        data={umamiData?.pageviews?.pageviews?.map((pv, i) => ({
                                            date: pv.x,
                                            views: pv.y,
                                            sessions: umamiData?.pageviews?.sessions?.[i]?.y || 0
                                        })) || []}
                                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#7A40F2" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#7A40F2" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F1F1" vertical={false} />
                                        <XAxis 
                                            dataKey="date" 
                                            stroke="#A1A1AA" 
                                            fontSize={10} 
                                            tickLine={false} 
                                            axisLine={false} 
                                            tickFormatter={(val) => {
                                                if (period === '24h') {
                                                    // Display hour format e.g. "14:00"
                                                    return val.substring(11, 16);
                                                }
                                                // Display short date format e.g. "Jun 04"
                                                const d = new Date(val);
                                                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                            }}
                                        />
                                        <YAxis stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E4E4E7', fontSize: '12px', color: '#18181B' }}
                                            labelFormatter={(label) => {
                                                const d = new Date(label);
                                                return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: period === '24h' ? '2-digit' : undefined });
                                            }}
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle" />
                                        <Area name="Pageviews" type="monotone" dataKey="views" stroke="#D4AF37" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" />
                                        <Area name="Sessions" type="monotone" dataKey="sessions" stroke="#7A40F2" strokeWidth={2} fillOpacity={1} fill="url(#colorSessions)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Referrers & URLs */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Top Pages */}
                            <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-sm lg:col-span-2">
                                <h3 className="text-base font-bold text-zinc-950 mb-4 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-zinc-400" />
                                    Top Pages
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-zinc-100 text-zinc-400 font-bold uppercase tracking-wider">
                                                <th className="pb-3 pl-2">Page URL</th>
                                                <th className="pb-3 text-right pr-2">Views</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-50 font-medium">
                                            {umamiData?.urls?.length === 0 ? (
                                                <tr>
                                                    <td colSpan="2" className="py-8 text-center text-zinc-400">No URL stats available.</td>
                                                </tr>
                                            ) : (
                                                umamiData?.urls?.map((url, index) => (
                                                    <tr key={index} className="hover:bg-zinc-50/50 transition-colors">
                                                        <td className="py-3.5 pl-2 font-mono text-[11px] text-zinc-600 truncate max-w-[200px] sm:max-w-md">
                                                            {url.x}
                                                        </td>
                                                        <td className="py-3.5 text-right pr-2 font-semibold text-zinc-900">
                                                            {url.y}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Devices Distribution */}
                            <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-sm">
                                <h3 className="text-base font-bold text-zinc-950 mb-4 flex items-center gap-2">
                                    <Laptop className="w-4 h-4 text-zinc-400" />
                                    Devices
                                </h3>
                                {umamiData?.devices?.length === 0 ? (
                                    <div className="h-60 flex items-center justify-center text-zinc-400 text-xs">No Device stats available.</div>
                                ) : (
                                    <div className="flex flex-col gap-4 mt-6">
                                        {umamiData?.devices?.map((device, index) => {
                                            const total = umamiData.devices.reduce((acc, d) => acc + d.y, 0);
                                            const percent = total > 0 ? Math.round((device.y / total) * 100) : 0;
                                            return (
                                                <div key={index} className="flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between text-xs font-semibold">
                                                        <span className="text-zinc-700 capitalize">{device.x || 'Unknown'}</span>
                                                        <span className="text-zinc-500">{percent}% ({device.y})</span>
                                                    </div>
                                                    <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{ 
                                                                width: `${percent}%`, 
                                                                backgroundColor: COLORS[index % COLORS.length] 
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top Referrers */}
                        <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-sm">
                            <h3 className="text-base font-bold text-zinc-950 mb-4 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-zinc-400" />
                                Top Referrers
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-zinc-100 text-zinc-400 font-bold uppercase tracking-wider">
                                            <th className="pb-3 pl-2">Source</th>
                                            <th className="pb-3 text-right pr-2">Referrals</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-50 font-medium">
                                        {umamiData?.referrers?.length === 0 ? (
                                            <tr>
                                                <td colSpan="2" className="py-8 text-center text-zinc-400">No referral traffic recorded.</td>
                                            </tr>
                                        ) : (
                                            umamiData?.referrers?.map((ref, index) => (
                                                <tr key={index} className="hover:bg-zinc-50/50 transition-colors">
                                                    <td className="py-3.5 pl-2 text-zinc-700 flex items-center gap-2 font-semibold">
                                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                                        {ref.x === 'direct' ? 'Direct Navigation' : ref.x}
                                                    </td>
                                                    <td className="py-3.5 text-right pr-2 font-bold text-zinc-900">
                                                        {ref.y}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        {/* Collection growth Trend */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Monthly Growth of inventory */}
                            <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-sm lg:col-span-2">
                                <h3 className="text-base font-bold text-zinc-950 mb-6 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
                                    Collection Growth Trend (Last 6 Months)
                                </h3>
                                <div className="h-72 w-full font-mono text-xs">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={acquisitionsData?.trends?.monthlyGrowth || []}
                                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F1F1" vertical={false} />
                                            <XAxis dataKey="month" stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E4E4E7' }} />
                                            <Bar name="New Artifacts" dataKey="count" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Condition health Pie chart */}
                            <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-zinc-950 mb-4 flex items-center gap-2">
                                        <HeartPulse className="w-4 h-4 text-emerald-500" />
                                        Collection Health
                                    </h3>
                                    {healthData?.healthDistribution?.length === 0 ? (
                                        <div className="h-44 flex items-center justify-center text-zinc-400 text-xs">No condition reports available.</div>
                                    ) : (
                                        <div className="h-44 w-full relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={healthData?.healthDistribution || []}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={50}
                                                        outerRadius={70}
                                                        paddingAngle={4}
                                                        dataKey="count"
                                                        nameKey="state"
                                                    >
                                                        {healthData?.healthDistribution?.map((entry, index) => (
                                                            <Cell 
                                                                key={`cell-${index}`} 
                                                                fill={HEALTH_COLORS[entry.state] || COLORS[index % COLORS.length]} 
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-2xl font-black text-zinc-900">{healthData?.healthPercentage || 100}%</span>
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Health Rating</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs justify-center">
                                    {healthData?.healthDistribution?.map((entry, index) => (
                                        <div key={index} className="flex items-center gap-1.5 font-semibold">
                                            <span 
                                                className="w-2.5 h-2.5 rounded-full" 
                                                style={{ backgroundColor: HEALTH_COLORS[entry.state] || COLORS[index % COLORS.length] }}
                                            ></span>
                                            <span className="text-zinc-600">{entry.state}: {entry.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Object types from Accession */}
                            <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-sm">
                                <h3 className="text-base font-bold text-zinc-950 mb-4 flex items-center gap-2">
                                    <Award className="w-4 h-4 text-purple-500" />
                                    Artifact Categories
                                </h3>
                                {acquisitionsData?.distributions?.categories?.length === 0 ? (
                                    <div className="h-56 flex items-center justify-center text-zinc-400 text-xs">No catalog categories cataloged.</div>
                                ) : (
                                    <div className="h-56 w-full font-mono text-xs">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={acquisitionsData?.distributions?.categories || []}
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={65}
                                                    dataKey="count"
                                                    nameKey="object_type"
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                >
                                                    {acquisitionsData?.distributions?.categories?.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>

                            {/* Valuations Distribution */}
                            <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-sm">
                                <h3 className="text-base font-bold text-zinc-950 mb-4 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-[#D4AF37]" />
                                    Valuation Reasons
                                </h3>
                                {valuationData?.reasonDistribution?.length === 0 ? (
                                    <div className="h-56 flex items-center justify-center text-zinc-400 text-xs">No valuation metrics recorded.</div>
                                ) : (
                                    <div className="h-56 w-full font-mono text-xs">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={valuationData?.reasonDistribution || []}
                                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F1F1" vertical={false} />
                                                <XAxis dataKey="reason" stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E4E4E7' }} />
                                                <Bar name="Assessments" dataKey="count" fill="#7A40F2" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
