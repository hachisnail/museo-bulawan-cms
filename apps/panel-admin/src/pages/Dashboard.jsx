// apps/panel-admin/src/pages/Dashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';
import { 
    ArrowUpRight, FileText, Paperclip, ChevronRight, 
    Search, Calendar, RefreshCw, AlertCircle 
} from 'lucide-react';

export default function Dashboard() {
    const { user, apiFetch } = useAuth();
    const navigate = useNavigate();

    // Data and UI states
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchDashboardStats = useCallback(async (isRefresh = false) => {
        if (isRefresh) setIsRefreshing(true);
        else setIsLoading(true);
        setError(null);

        try {
            const res = await apiFetch('/api/v1/analytics/dashboard-stats');
            if (!res.ok) {
                throw new Error('Failed to fetch dashboard intelligence statistics.');
            }
            const payload = await res.json();
            if (payload.status === 'success') {
                setDashboardData(payload.data);
            } else {
                throw new Error(payload.error || 'Server returned an error.');
            }
        } catch (err) {
            console.error('Failed to load dashboard:', err);
            setError(err.message || 'Error fetching stats.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchDashboardStats();
    }, [fetchDashboardStats]);

    // Live refresh when database changes are broadcast via SSE
    useSSE({
        'db_change': (data) => {
            console.log('[Dashboard] Live database change event detected. Refreshing data...', data);
            fetchDashboardStats(true);
        }
    });

    // Filtering unread queries by search term
    const filteredQueries = dashboardData?.unreadQueries?.filter(q => {
        if (!searchQuery) return true;
        const term = searchQuery.toLowerCase();
        return (
            q.title?.toLowerCase().includes(term) ||
            q.type?.toLowerCase().includes(term) ||
            q.name?.toLowerCase().includes(term) ||
            q.email?.toLowerCase().includes(term)
        );
    }) || [];

    // Helper loading skeletons
    const renderSkeleton = () => (
        <div className="bg-white p-6 rounded-[28px] border border-zinc-200/80 shadow-sm animate-pulse h-40">
            <div className="h-4 w-24 bg-zinc-200 rounded mb-4"></div>
            <div className="h-10 w-16 bg-zinc-200 rounded mb-2"></div>
            <div className="h-3 w-32 bg-zinc-200 rounded"></div>
        </div>
    );

    if (error) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="bg-red-50/50 border border-red-200/60 rounded-2xl p-6 text-center max-w-xl mx-auto mt-20 animate-in fade-in duration-300">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-zinc-900 mb-1">Intelligence Offline</h2>
                    <p className="text-zinc-500 text-sm mb-6">{error}</p>
                    <button 
                        onClick={() => fetchDashboardStats()} 
                        className="px-5 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors shadow-sm"
                    >
                        Try Reconnecting
                    </button>
                </div>
            </div>
        );
    }

    // Thermometer values for Visitor Quota
    const percentage = dashboardData?.visitorQuota?.percentage || 0;
    const todayCount = dashboardData?.visitorQuota?.todayCount || 0;
    const limit = dashboardData?.visitorQuota?.limit || 1000;
    const fillHeight = Math.round(110 * (percentage / 100));
    const fillY = 120 - fillHeight;

    // Donut values for Artifacts in Display
    const totalArtifacts = dashboardData?.totals?.artifacts || 0;
    const displayedArtifacts = dashboardData?.totals?.displayed || 0;
    const displayPercent = totalArtifacts > 0 ? Math.round((displayedArtifacts / totalArtifacts) * 100) : 0;
    const r = 50;
    const sw = 10;
    const circ = 2 * Math.PI * r;
    const offset = circ - (displayPercent / 100) * circ;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500 space-y-8">
            
            {/* Header & Global Keyword Search */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200/80 pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight flex items-center gap-3">
                        Dashboard
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1 font-light">
                        Curator access granted for <span className="font-semibold text-black">{user?.fname} {user?.lname}</span>.
                    </p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                    {/* Keyword search bar filtering queries */}
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Enter keyword"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-zinc-200 bg-white rounded-lg text-xs font-medium w-56 focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] shadow-sm transition-all"
                        />
                    </div>
                    
                    <button
                        onClick={() => fetchDashboardStats(true)}
                        disabled={isRefreshing}
                        className="p-2 bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-950 rounded-lg hover:bg-zinc-50 transition-all shadow-sm disabled:opacity-50"
                        title="Refresh dashboard stats"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#D4AF37]' : ''}`} />
                    </button>
                </div>
            </div>

            {/* KPI Cards (Top Row) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {isLoading ? (
                    Array(4).fill(0).map((_, i) => <React.Fragment key={i}>{renderSkeleton()}</React.Fragment>)
                ) : (
                    <>
                        {/* Total Artifacts (Dark Brown) */}
                        <div className="bg-[#2b1b11] text-white p-6 rounded-[28px] shadow-sm border border-[#3e271a] flex flex-col justify-between h-40 relative group hover:border-[#D4AF37]/50 transition-all duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]">Total Artifacts</span>
                                <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-[#D4AF37] group-hover:text-black transition-colors duration-300">
                                    <ArrowUpRight className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-5xl font-extrabold font-sans leading-none tracking-tight">
                                {totalArtifacts}
                            </div>
                            <p className="text-[10px] text-zinc-400 font-medium tracking-wide">
                                Total Artifacts
                            </p>
                        </div>

                        {/* Acquired Artifacts (White) */}
                        <div className="bg-white text-zinc-950 p-6 rounded-[28px] shadow-sm border border-zinc-250/70 flex flex-col justify-between h-40 relative group hover:border-[#D4AF37]/50 transition-all duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Acquired Artifacts</span>
                                <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-[#D4AF37] group-hover:text-black transition-colors duration-300">
                                    <ArrowUpRight className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-5xl font-extrabold text-zinc-900 leading-none tracking-tight">
                                {dashboardData?.totals?.acquired || 0}
                            </div>
                            <p className="text-[10px] text-zinc-450 font-medium tracking-wide">
                                Total Artifacts
                            </p>
                        </div>

                        {/* Borrowed Artifacts (White) */}
                        <div className="bg-white text-zinc-950 p-6 rounded-[28px] shadow-sm border border-zinc-255/70 flex flex-col justify-between h-40 relative group hover:border-[#D4AF37]/50 transition-all duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Borrowed Artifacts</span>
                                <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-[#D4AF37] group-hover:text-black transition-colors duration-300">
                                    <ArrowUpRight className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-5xl font-extrabold text-zinc-900 leading-none tracking-tight">
                                {dashboardData?.totals?.borrowed || 0}
                            </div>
                            <p className="text-[10px] text-zinc-455 font-medium tracking-wide">
                                Total Artifacts
                            </p>
                        </div>

                        {/* Displayed Artifacts (White) */}
                        <div className="bg-white text-zinc-950 p-6 rounded-[28px] shadow-sm border border-zinc-260/70 flex flex-col justify-between h-40 relative group hover:border-[#D4AF37]/50 transition-all duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Displayed Artifacts</span>
                                <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-[#D4AF37] group-hover:text-black transition-colors duration-300">
                                    <ArrowUpRight className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-5xl font-extrabold text-zinc-900 leading-none tracking-tight">
                                {displayedArtifacts}
                            </div>
                            <p className="text-[10px] text-zinc-460 font-medium tracking-wide">
                                Total Artifacts
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Walk-ins & Active Exhibitions (Middle Row) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {isLoading ? (
                    <>
                        <div className="bg-white p-6 rounded-[28px] border border-zinc-200 shadow-sm animate-pulse h-40"></div>
                        <div className="bg-[#2b1b11] p-6 rounded-[28px] shadow-sm animate-pulse h-40"></div>
                    </>
                ) : (
                    <>
                        {/* Walk-ins Card */}
                        <div className="bg-white p-8 rounded-[28px] border border-zinc-200/80 shadow-sm flex items-center justify-between h-40">
                            <div>
                                <h2 className="text-4xl font-extrabold text-zinc-900 tracking-tight font-sans">
                                    Walk-ins
                                </h2>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={() => navigate('/appointments/walk-in')}
                                    className="flex items-center justify-between gap-4 px-5 py-2.5 bg-[#2b1b11] text-white hover:bg-[#3d2719] rounded-full text-xs font-bold tracking-wide transition-all shadow-sm w-44 group"
                                >
                                    <span>Appointment</span>
                                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs group-hover:bg-[#D4AF37] group-hover:text-black transition-colors">+</span>
                                </button>
                                <button 
                                    onClick={() => navigate('/intakes/new')}
                                    className="flex items-center justify-between gap-4 px-5 py-2.5 border border-[#2b1b11] text-[#2b1b11] hover:bg-zinc-50 rounded-full text-xs font-bold tracking-wide transition-all shadow-sm w-44 group"
                                >
                                    <span>Donation</span>
                                    <span className="w-5 h-5 rounded-full border border-[#2b1b11] flex items-center justify-center font-bold text-xs group-hover:bg-[#2b1b11] group-hover:text-white transition-colors">+</span>
                                </button>
                            </div>
                        </div>

                        {/* Active Exhibition Card (Dark Brown block next to Walk-ins) */}
                        <div className="bg-[#2b1b11] text-white p-6 rounded-[28px] shadow-sm border border-[#3e271a] flex flex-col justify-between h-40 relative overflow-hidden">
                            {dashboardData?.activeExhibition ? (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/20">
                                            Active Exhibition
                                        </span>
                                        <Calendar className="w-4 h-4 text-zinc-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white leading-tight truncate">
                                            {dashboardData.activeExhibition.title}
                                        </h3>
                                        <p className="text-[11px] text-zinc-350 mt-1 truncate">
                                            Venue: {dashboardData.activeExhibition.venue}
                                        </p>
                                    </div>
                                    <p className="text-[10px] text-[#D4AF37] font-semibold mt-1 font-mono uppercase tracking-wider">
                                        {new Date(dashboardData.activeExhibition.start_date).toLocaleDateString()} - {dashboardData.activeExhibition.end_date ? new Date(dashboardData.activeExhibition.end_date).toLocaleDateString() : 'Present'}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                            Museum Status
                                        </span>
                                        <Calendar className="w-4 h-4 text-zinc-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white leading-tight">
                                            No Active Public Exhibitions
                                        </h3>
                                        <p className="text-[11px] text-zinc-400 mt-1">
                                            Exhibitions can be scheduled and artifacts cataloged inside the curation panel.
                                        </p>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 font-semibold mt-1 uppercase tracking-wider">
                                        All assets in storage/maintenance
                                    </p>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Bottom Row Visualizations */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 items-start">
                
                {/* Visitor Quota Card */}
                {isLoading ? (
                    <div className="bg-[#2b1b11] p-6 rounded-[28px] border border-[#3e271a] h-64 animate-pulse"></div>
                ) : (
                    <div className="bg-[#2b1b11] text-white p-6 rounded-[28px] border border-[#3e271a] shadow-sm flex flex-col justify-between h-64 relative">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]">Visitor Quota</span>
                            <span className="text-[11px] font-bold text-zinc-400">{percentage}%</span>
                        </div>

                        <div className="flex items-end justify-between gap-4 mt-2">
                            {/* Thermometer Values */}
                            <div className="text-left text-zinc-400 font-mono text-[10px] flex flex-col justify-between h-36 pb-3">
                                <div className="font-bold text-white">{limit}</div>
                                <div className="text-[#FFA726] font-bold text-[13px]" style={{ transform: `translateY(${Math.max(0, 110 - fillHeight - 12)}px)`, transition: 'transform 0.5s ease-out' }}>
                                    {todayCount}
                                </div>
                                <div className="text-zinc-500">0</div>
                            </div>
                            
                            {/* Thermometer Graphic */}
                            <div className="relative pr-4">
                                <svg width="50" height="150" viewBox="0 0 50 150">
                                    {/* Tube Track */}
                                    <path 
                                        d="M 17 12 A 8 8 0 0 1 33 12 L 33 115 A 15 15 0 1 1 17 115 Z" 
                                        fill="#3e271a" 
                                        stroke="#5d4037" 
                                        strokeWidth="2" 
                                    />
                                    {/* Filled Liquid Bulb */}
                                    <circle cx="25" cy="124" r="11" fill="#FFA726" />
                                    {/* Filled Liquid Tube */}
                                    <rect 
                                        x="19" 
                                        y={fillY} 
                                        width="12" 
                                        height={fillHeight + 8} 
                                        fill="#FFA726" 
                                        rx="3" 
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}

                {/* Artifacts in Display (Donut Card) */}
                {isLoading ? (
                    <div className="bg-white p-6 rounded-[28px] border border-zinc-200 h-64 animate-pulse"></div>
                ) : (
                    <div className="bg-white p-6 rounded-[28px] border border-zinc-200/85 shadow-sm flex flex-col justify-between h-64">
                        <div className="text-left w-full text-zinc-400 font-mono text-xs font-bold leading-none">
                            {totalArtifacts}
                        </div>

                        {/* Radial Donut Progress */}
                        <div className="relative w-36 h-36 flex items-center justify-center mx-auto my-1">
                            <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
                                <circle
                                    cx="70"
                                    cy="70"
                                    r={r}
                                    fill="transparent"
                                    stroke="#F5F5F5"
                                    strokeWidth={sw}
                                />
                                <circle
                                    cx="70"
                                    cy="70"
                                    r={r}
                                    fill="transparent"
                                    stroke="#3E2723"
                                    strokeWidth={sw}
                                    strokeDasharray={circ}
                                    strokeDashoffset={offset}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                                <span className="text-3xl font-extrabold text-[#3E2723]">{displayPercent}%</span>
                                <span className="text-[9px] text-zinc-450 uppercase font-bold tracking-wider mt-0.5">In Display</span>
                            </div>
                        </div>

                        <div className="text-center">
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                Artifacts in Display
                            </p>
                        </div>
                    </div>
                )}

                {/* Unread Queries (Pending Submissions) */}
                {isLoading ? (
                    <div className="bg-white p-6 rounded-[28px] border border-zinc-200 h-64 md:col-span-1 lg:col-span-2 animate-pulse"></div>
                ) : (
                    <div className="bg-white p-6 rounded-[28px] border border-zinc-200/85 shadow-sm flex flex-col min-h-64 md:col-span-1 lg:col-span-2">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                            <h3 className="text-base font-bold text-zinc-950">
                                Unread Queries
                            </h3>
                            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 text-[10px] font-bold rounded-full">
                                {dashboardData?.unreadQueries?.length || 0} Pending
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 max-h-48 scrollbar-hide">
                            {filteredQueries.length === 0 ? (
                                <div className="text-center py-10 text-zinc-450 flex flex-col items-center justify-center">
                                    <svg className="w-8 h-8 text-zinc-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                                        No unread queries
                                    </span>
                                </div>
                            ) : (
                                filteredQueries.map((query) => (
                                    <div 
                                        key={query.id}
                                        onClick={() => navigate(`/forms/submissions/${query.id}`)}
                                        className="flex items-center justify-between p-3 hover:bg-zinc-50 rounded-2xl cursor-pointer border border-transparent hover:border-zinc-200/60 transition-all duration-300 group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-600 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/5 transition-colors duration-300">
                                                {query.type === 'appointment' ? <FileText className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[#D4AF37] transition-colors duration-300 capitalize truncate">
                                                    {query.type === 'appointment' ? 'Appointment' : 'Donation'}
                                                </h4>
                                                <p className="text-[9px] text-zinc-450 font-medium font-mono truncate mt-0.5">
                                                    {query.name ? `${query.name} • ` : ''}
                                                    {new Date(query.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()} 
                                                    {' '}
                                                    {new Date(query.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="w-6 h-6 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-[#D4AF37] group-hover:text-black group-hover:border-[#D4AF37] transition-all duration-300">
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

            </div>

        </div>
    );
}