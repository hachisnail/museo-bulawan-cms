import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { ArrowLeft, User, Activity, Database, Clock } from 'lucide-react';

export default function AuditLogView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { apiFetch } = useAuth();

    const [log, setLog] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLog = async () => {
            try {
                const res = await apiFetch(`/api/v1/audit-logs/${id}`);
                const data = await res.json();
                if (data.status === 'success') {
                    setLog(data.data);
                }
            } catch (err) {
                console.error('Failed to fetch audit log', err);
            } finally {
                setLoading(false);
            }
        };
        fetchLog();
    }, [id, apiFetch]);

    if (loading) {
        return <div className="p-8 text-center text-zinc-500">Loading audit log details...</div>;
    }

    if (!log) {
        return (
            <div className="p-8 text-center text-zinc-500">
                <p>Audit log not found.</p>
                <button onClick={() => navigate('/audit-logs')} className="mt-4 text-zinc-650 hover:text-black hover:underline underline">Return to Logs</button>
            </div>
        );
    }

    const parseSafe = (val) => {
        if (!val) return null;
        if (typeof val === 'object') return val;
        try {
            return JSON.parse(val);
        } catch (e) {
            return null;
        }
    };

    const beforeState = parseSafe(log.before_state);
    const afterState = parseSafe(log.after_state);
    const details = parseSafe(log.details);

    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 animate-in fade-in duration-300">
            <section className="flex items-start border-b border-gray-100 pb-4 mb-4">
                <div className="flex-1">
                    <button 
                        onClick={() => navigate('/audit-logs')}
                        className="text-xs text-zinc-500 hover:text-black transition-colors flex items-center gap-2 mb-4 font-bold uppercase tracking-widest"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Audit Logs
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-black tracking-tight">Audit Log Details</h1>
                        <p className="text-sm text-gray-500 mt-1 font-mono">ID: {log.id}</p>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-50 p-6 rounded-sm border border-zinc-200 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                        <User className="w-4 h-4" /> Actor Information
                    </h3>
                    <div className="space-y-2">
                        <div><span className="text-[10px] text-zinc-400 font-bold">NAME:</span> <span className="text-sm font-semibold">{log.fname ? `${log.fname} ${log.lname}` : 'System Agent'}</span></div>
                        <div><span className="text-[10px] text-zinc-400 font-bold">EMAIL:</span> <span className="text-sm font-mono">{log.user_email || 'N/A'}</span></div>
                        <div><span className="text-[10px] text-zinc-400 font-bold">IP/FINGERPRINT:</span> <span className="text-sm font-mono text-zinc-600">{log.ip_address || 'Internal'}</span></div>
                    </div>
                </div>

                <div className="bg-zinc-50 p-6 rounded-sm border border-zinc-200 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Action Details
                    </h3>
                    <div className="space-y-2">
                        <div><span className="text-[10px] text-zinc-400 font-bold">ACTION:</span> <span className="text-sm font-bold bg-black text-white px-2 py-0.5 rounded ml-2 uppercase text-[10px]">{log.action}</span></div>
                        <div><span className="text-[10px] text-zinc-400 font-bold">RESOURCE:</span> <span className="text-sm font-mono ml-2">{log.resource}</span></div>
                        <div><span className="text-[10px] text-zinc-400 font-bold">TIMESTAMP:</span> <span className="text-sm ml-2">{new Date(log.created_at).toLocaleString()}</span></div>
                    </div>
                </div>
            </div>

            {details && details.message && (
                <div className="bg-zinc-100 p-4 border border-zinc-200 rounded-sm">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Message</h4>
                    <p className="text-sm text-black">{details.message}</p>
                </div>
            )}

            <div className="space-y-6 mt-4">
                <h3 className="text-lg font-serif text-black uppercase tracking-widest border-b border-zinc-100 pb-2 flex items-center gap-2">
                    <Database className="w-5 h-5" /> State Changes
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Before</h4>
                        <pre className="bg-zinc-900 text-zinc-300 p-4 rounded-sm text-xs font-mono overflow-auto max-h-96">
                            {beforeState ? JSON.stringify(beforeState, null, 2) : 'No previous state'}
                        </pre>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">After</h4>
                        <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-sm text-xs font-mono overflow-auto max-h-96">
                            {afterState ? JSON.stringify(afterState, null, 2) : 'No new state'}
                        </pre>
                    </div>
                </div>
            </div>
            
        </div>
    );
}
