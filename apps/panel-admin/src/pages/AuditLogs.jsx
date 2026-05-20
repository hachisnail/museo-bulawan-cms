import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/authContext';
import { 
    Search, 
    Filter, 
    Download, 
    Clock, 
    User, 
    Shield, 
    Activity,
    ChevronLeft,
    ChevronRight,
    ExternalLink
} from 'lucide-react';
import Modal from '../components/Modal';

export default function AuditLogs() {
    const { apiFetch } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`/api/v1/audit-logs?page=${page}&limit=20&search=${searchTerm}&action=${actionFilter === 'all' ? '' : actionFilter}`);
            const data = await res.json();
            if (data.status === 'success') {
                setLogs(data.data.items || []);
                setTotalPages(data.data.totalPages || 1);
            }
        } catch (err) {
            console.error("Failed to fetch audit logs", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch, page, searchTerm, actionFilter]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExport = async () => {
        try {
            const res = await apiFetch('/api/v1/audit-logs/export');
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Export Failed', message: 'Could not generate audit report.', type: 'alert', variant: 'error' });
        }
    };

    const getActionColor = (action) => {
        if (action.includes('delete') || action.includes('deaccession')) return 'text-rose-600 bg-rose-50 border-rose-100';
        if (action.includes('create') || action.includes('add')) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
        if (action.includes('update') || action.includes('edit')) return 'text-blue-600 bg-blue-50 border-blue-100';
        return 'text-zinc-600 bg-zinc-50 border-zinc-200';
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-300 pb-10">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#D4AF37]">
                        <Shield className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">System Integrity Audit</span>
                    </div>
                    <h1 className="text-4xl font-serif text-black tracking-tight uppercase">Immutable Logs</h1>
                    <p className="text-xs text-zinc-400 max-w-md font-light italic">Trace every curatorial action, security event, and system transition across the permanent archive.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-black transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search by ID or Actor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-zinc-50 border border-zinc-300 rounded-sm pl-12 pr-6 py-3 text-sm text-black focus:outline-none focus:border-black w-64 transition-all"
                        />
                    </div>
                    <button 
                        onClick={handleExport}
                        className="bg-white border border-zinc-300 text-black px-6 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 transition-all"
                    >
                        <Download className="w-4 h-4" /> Export Report
                    </button>
                </div>
            </header>

            {/* Filter Bar */}
            <div className="flex gap-4 items-center">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mr-2">Filter by Action:</div>
                {['all', 'create', 'update', 'delete', 'security'].map(f => (
                    <button
                        key={f}
                        onClick={() => { setActionFilter(f); setPage(1); }}
                        className={`px-4 py-1.5 rounded-sm text-[9px] font-bold uppercase tracking-widest border transition-all ${
                            actionFilter === f ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-zinc-400 border-zinc-300 hover:border-zinc-400'
                        }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Logs Table */}
            <div className="bg-white border border-zinc-300 rounded-sm overflow-hidden shadow-sm min-h-[600px] flex flex-col">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-50 text-[9px] uppercase font-black text-zinc-500 tracking-widest border-b border-zinc-300">
                            <th className="px-8 py-5">Timestamp</th>
                            <th className="px-8 py-5">Actor</th>
                            <th className="px-8 py-5">Action Type</th>
                            <th className="px-8 py-5">Resource ID</th>
                            <th className="px-8 py-5">Summary</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="px-8 py-32 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-6 h-6 border-2 border-zinc-200 border-t-black rounded-full animate-spin" />
                                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Verifying Audit Chain...</div>
                                    </div>
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-8 py-32 text-center text-zinc-400 font-serif italic text-lg">No security events found matching your criteria.</td>
                            </tr>
                        ) : logs.map((log) => (
                            <tr key={log.id} className="group hover:bg-zinc-50/50 transition-colors">
                                <td className="px-8 py-5">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-bold text-black">{new Date(log.created_at).toLocaleDateString()}</span>
                                        <span className="text-[9px] font-mono text-zinc-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-sm bg-zinc-100 flex items-center justify-center text-zinc-400 text-[10px] font-black uppercase border border-zinc-200">
                                            {log.actor_name?.[0] || <User className="w-3.5 h-3.5" />}
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-black">{log.actor_name || 'System Agent'}</div>
                                            <div className="text-[9px] text-zinc-400 uppercase tracking-tighter">{log.actor_role || 'MB-SERVER'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`px-2.5 py-1 rounded-sm text-[8px] font-black uppercase tracking-widest border ${getActionColor(log.action)}`}>
                                        {log.action.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-zinc-400 group-hover:text-black transition-colors">{log.resource_id?.substring(0, 8)}...</span>
                                        <ExternalLink className="w-3 h-3 text-zinc-200 group-hover:text-[#D4AF37] cursor-pointer" />
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <p className="text-[11px] text-zinc-500 font-light italic line-clamp-1">"{log.description || 'Action captured by archival state machine.'}"</p>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="mt-auto border-t border-zinc-100 p-6 bg-zinc-50/30 flex justify-between items-center">
                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Page {page} of {totalPages}</div>
                    <div className="flex gap-2">
                        <button 
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 border border-zinc-200 rounded-sm disabled:opacity-30 hover:bg-white transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button 
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 border border-zinc-200 rounded-sm disabled:opacity-30 hover:bg-white transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <Modal 
                {...modal} 
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
}
