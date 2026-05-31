// apps/panel-admin/src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';
import { Shield, RefreshCw } from 'lucide-react';

export default function Dashboard() {
    const { user, apiFetch } = useAuth();
    const { events, status } = useSSE('intakes');
    const [initialData, setInitialData] = useState([]);
    const [statsData, setStatsData] = useState({ intakes: 0, accessions: 0, inventory: 0 });
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        apiFetch('/api/v1/acquisitions/intakes')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') setInitialData(data.data.items);
            })
            .catch(err => console.error("Failed to fetch intakes", err));
    }, [apiFetch]);

    useEffect(() => {
        apiFetch('/api/v1/analytics/acquisitions')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.data && data.data.totals) {
                    setStatsData(data.data.totals);
                }
            })
            .catch(err => console.error("Failed to fetch acquisition stats", err))
            .finally(() => setStatsLoading(false));
    }, [apiFetch]);

    const displayList = [...events.map(e => e.record).filter(Boolean), ...initialData]
        .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
        .slice(0, 10);

    return (
        <div className="max-w-6xl mx-auto space-y-10 px-4 sm:px-6 lg:px-8">
            
            {/* --- Header --- */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-gray-150 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-black tracking-tight">Archive Overview</h1>
                    <p className="text-sm text-zinc-500 mt-1 font-light">
                        Curator access granted for <span className="font-semibold text-black">{user?.fname} {user?.lname}</span>.
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-zinc-400">
                        SSE Pulse
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 bg-zinc-50/50 rounded-sm text-xs font-semibold uppercase tracking-wider text-zinc-600 shadow-sm">
                        <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500 animate-pulse'}`}></span>
                        {status}
                    </div>
                </div>
            </header>

            {/* --- Key Metrics --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border border-zinc-300 bg-white p-6 rounded-sm shadow-sm flex flex-col justify-between min-h-[140px]">
                    <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 mb-4">
                        Pending Reviews
                    </div>
                    <div className="text-4xl font-serif text-black">
                        {statsLoading ? '...' : statsData.intakes}
                    </div>
                </div>
                
                <div className="border border-zinc-300 bg-white p-6 rounded-sm shadow-sm flex flex-col justify-between min-h-[140px]">
                    <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 mb-4">
                        Active Accessions
                    </div>
                    <div className="text-4xl font-serif text-black">
                        {statsLoading ? '...' : statsData.accessions}
                    </div>
                </div>
                
                {/* Highlighted Metric Card */}
                <div className="border border-zinc-300 bg-white p-6 rounded-sm shadow-sm flex flex-col justify-between min-h-[140px] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]"></div>
                    <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 mb-4 ml-2">
                        Cataloged Items
                    </div>
                    <div className="text-4xl font-serif text-[#A68A27] ml-2">
                        {statsLoading ? '...' : statsData.inventory.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* --- Real-time Activity Feed --- */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-serif font-bold uppercase tracking-widest text-black">
                        Intake Activity Ledger
                    </h2>
                </div>
                
                <div className="border border-zinc-350 bg-white rounded-sm shadow-sm">
                    {displayList.length === 0 ? (
                        <div className="p-16 text-center flex flex-col items-center justify-center">
                            <svg className="w-8 h-8 text-zinc-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                                No active imports
                            </span>
                            <span className="text-xs text-zinc-400 mt-1 font-light">
                                Waiting for incoming artifact data...
                            </span>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-200">
                            {displayList.map((item, idx) => (
                                <div key={idx} className="p-4 hover:bg-zinc-50 transition-colors flex justify-between items-center group">
                                    <div className="flex flex-col gap-1">
                                        <div className="font-semibold text-sm text-black group-hover:text-[#D4AF37] transition-colors">
                                            {item?.proposed_item_name || 'Unnamed Artifact'}
                                        </div>
                                        <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-medium">
                                            Ref: {item?.id || 'PENDING'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-2.5 py-1 rounded-sm text-[9px] font-bold uppercase tracking-widest border ${
                                            item?.status === 'under_review' 
                                                ? 'border-[#D4AF37]/30 text-[#A68A27] bg-[#D4AF37]/10' 
                                                : 'border-zinc-200 text-zinc-650 bg-zinc-50'
                                        }`}>
                                            {item?.status?.replace('_', ' ') || 'UNKNOWN'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}