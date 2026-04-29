import { useState, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';

export default function Dashboard() {
    const { user, apiFetch } = useAuth();
    const { events, status } = useSSE('intakes');
    const [initialData, setInitialData] = useState([]);

    useEffect(() => {
        apiFetch('/api/v1/acquisitions/intakes')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') setInitialData(data.data.items);
            })
            .catch(err => console.error("Failed to fetch intakes", err));
    }, []);

    const displayList = [...events.map(e => e.data), ...initialData]
        .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
        .slice(0, 50);

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-[var(--text-secondary)] mt-1">
                        Welcome back, <strong>{user?.username}</strong>. 
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-secondary)]">Live Status</span>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel text-sm">
                        <span className={`w-2 h-2 rounded-full ${status === 'open' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse' : 'bg-red-500'}`}></span>
                        <span className="capitalize">{status}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl">
                    <div className="text-[var(--text-secondary)] text-sm mb-2">Pending Reviews</div>
                    <div className="text-4xl font-light">12</div>
                </div>
                <div className="glass-panel p-6 rounded-2xl">
                    <div className="text-[var(--text-secondary)] text-sm mb-2">Active Accessions</div>
                    <div className="text-4xl font-light">4</div>
                </div>
                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-brand-600)] to-purple-600 opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <div className="relative z-10">
                        <div className="text-[var(--text-secondary)] text-sm mb-2 group-hover:text-white transition-colors">Cataloged Items</div>
                        <div className="text-4xl font-light text-white">1,204</div>
                    </div>
                </div>
            </div>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold tracking-tight">Real-time Intake Activity</h2>
                    <button className="text-sm text-[var(--color-brand-500)] hover:text-white transition-colors">View All →</button>
                </div>
                <div className="glass-panel rounded-2xl overflow-hidden">
                    {displayList.length === 0 ? (
                        <div className="p-12 text-center text-[var(--text-secondary)]">
                            <div className="text-4xl mb-3 opacity-20">📡</div>
                            Waiting for live events...
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--color-glass-border)]">
                            {displayList.map((item, idx) => (
                                <div key={idx} className="p-4 hover:bg-[var(--color-glass)] transition-colors flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <div className="font-medium text-white">{item?.proposed_item_name || 'Unknown Item'}</div>
                                        <div className="text-xs text-[var(--text-secondary)]">ID: {item?.id}</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                            item?.status === 'under_review' ? 'border-yellow-500/20 text-yellow-400 bg-yellow-500/10' : 
                                            'border-blue-500/20 text-blue-400 bg-blue-500/10'
                                        }`}>
                                            {item?.status?.toUpperCase() || 'UNKNOWN'}
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