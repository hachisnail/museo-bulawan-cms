// apps/panel-admin/src/pages/audit-logs/pages/AuditLogsIndex.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/authContext';
import { DataTable } from '../../../components';
import Modal from '../../../components/Modal';
import { User, Download } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  Badge Colors
// ─────────────────────────────────────────────────────────────────────────────
const getActionColor = (action) => {
    const act = action.toLowerCase();
    if (act.includes('delete') || act.includes('deactivate') || act.includes('deaccession')) {
        return 'text-rose-600 bg-rose-50 border-rose-100';
    }
    if (act.includes('create') || act.includes('add') || act.includes('invite') || act.includes('onboard')) {
        return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    }
    if (act.includes('update') || act.includes('edit')) {
        return 'text-blue-600 bg-blue-50 border-blue-100';
    }
    if (act.includes('login') || act.includes('logout') || act.includes('force_logout') || act.includes('change_password')) {
        return 'text-[#A68A27] bg-[#D4AF37]/10 border-[#D4AF37]/30';
    }
    return 'text-zinc-600 bg-zinc-50 border-zinc-200';
};

// ─────────────────────────────────────────────────────────────────────────────
//  Main Page Component
// ─────────────────────────────────────────────────────────────────────────────
export default function AuditLogsIndex() {
    const { apiFetch } = useAuth();

    // --- Modal ---
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });

    // --- Data ---
    const [logs, setLogs] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);

    // --- Table & Search ---
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    // ─────────────────────────────────────────────────────────────────────────────
    //  Data Fetching
    // ─────────────────────────────────────────────────────────────────────────────
    const fetchLogs = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await apiFetch(
                `/api/v1/audit-logs?page=${currentPage}&limit=20&search=${searchTerm}`
            );
            const data = await res.json();
            if (data.status === 'success') {
                setLogs(data.data.items || []);
                setTotalPages(data.data.totalPages || 1);
            }
        } catch (err) {
            console.error('Failed to fetch audit trail logs', err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch, currentPage, searchTerm]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Reset pagination page on search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // ─────────────────────────────────────────────────────────────────────────────
    //  Handlers
    // ─────────────────────────────────────────────────────────────────────────────
    const handleQueryChange = useCallback((filters) => {
        setSearchTerm(filters.search || '');
    }, []);

    const handleExport = async () => {
        try {
            const res = await apiFetch('/api/v1/audit-logs/export?format=csv');
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                setModal({ isOpen: true, title: 'Export Failed', message: 'The audit report could not be generated.', type: 'alert', variant: 'error' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Export server communication error.', type: 'alert', variant: 'error' });
        }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    //  Columns definitions
    // ─────────────────────────────────────────────────────────────────────────────
    const columns = useMemo(() => [
        {
            key: 'created_at',
            label: 'Timestamp',
            isBold: true,
            render: (val) => (
                <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-black">{new Date(val).toLocaleDateString()}</span>
                    <span className="text-[9px] font-mono text-zinc-400">{new Date(val).toLocaleTimeString()}</span>
                </div>
            )
        },
        {
            key: 'actor',
            label: 'Actor',
            render: (val, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-sm bg-zinc-100 flex items-center justify-center text-zinc-400 text-[10px] font-black uppercase border border-zinc-200">
                        {row.fname?.[0] || <User className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-black">{row.fname ? `${row.fname} ${row.lname}` : 'System Agent'}</div>
                        <div className="text-[9px] text-zinc-400 uppercase tracking-tighter">{row.user_email || 'MB-SERVER'}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'action',
            label: 'Action Type',
            render: (val) => (
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${getActionColor(val)}`}>
                    {val ? val.replace(/_/g, ' ') : 'SYSTEM'}
                </span>
            )
        },
        {
            key: 'resource',
            label: 'Resource',
            render: (val) => <span className="font-mono text-xs text-zinc-600">{val || 'system'}</span>
        },
        {
            key: 'details',
            label: 'Summary',
            render: (val) => {
                let parsed = {};
                try { parsed = typeof val === 'string' ? JSON.parse(val) : val; } catch (e) {}
                return (
                    <p className="text-[11px] text-zinc-500 font-light italic max-w-xs truncate">
                        "{parsed?.message || parsed?.description || 'Action captured by system trail.'}"
                    </p>
                );
            }
        }
    ], []);

    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <section className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-black tracking-tight">Audit Logs</h1>
                    <p className="text-sm text-gray-500 mt-1">Trace immutable security operations and record modifications.</p>
                </div>
                <button 
                    onClick={handleExport}
                    className="bg-black hover:bg-zinc-900 text-[#D4AF37] px-6 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-md"
                >
                    <Download className="w-4 h-4" /> Export Report
                </button>
            </section>

            <div className="w-full min-w-0 animate-in fade-in duration-300">
                <DataTable
                    columns={columns}
                    data={logs}
                    onQueryChange={handleQueryChange}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    showExtraActions={false}
                    isExpandable={false}
                    isLoading={loading}
                />
            </div>

            <Modal 
                {...modal}
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
}
