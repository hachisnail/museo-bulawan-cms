import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { FileText, Calendar, User, Database, ArrowLeft, Download, ExternalLink } from 'lucide-react';

export default function SubmissionViewer() {
    const { id } = useParams();
    const { apiFetch } = useAuth();
    const navigate = useNavigate();
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [media, setMedia] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await apiFetch(`/api/v1/forms/admin/submissions/${id}?expand=form_id`);
                const json = await res.json();
                if (json.status === 'success') {
                    const subData = json.data.submission || json.data;
                    setSubmission(subData);
                    
                    // Fetch media
                    const mRes = await apiFetch(`/api/v1/media/form_submissions/${id}`);
                    const mData = await mRes.json();
                    if (mData.status === 'success') {
                        setMedia(mData.data.items || []);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch submission proof", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, apiFetch]);

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-black">
            <div className="animate-pulse text-indigo-400 font-black tracking-widest uppercase text-xs">Scanning Digital Archive...</div>
        </div>
    );

    if (!submission) return (
        <div className="flex flex-col items-center justify-center h-screen bg-black text-zinc-500">
            <div className="text-4xl mb-4">🚫</div>
            <h2 className="text-xl font-bold text-white">Submission Record Not Found</h2>
            <p className="mt-2 text-sm">The requested reference ID does not exist in the curatorial registry.</p>
            <button onClick={() => navigate(-1)} className="mt-8 px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all">Go Back</button>
        </div>
    );

    const data = (typeof submission.data === 'string' ? JSON.parse(submission.data) : submission.data) || {};
    const formTitle = submission.expand?.form_id?.title || 'Standard Submission';

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-200 p-8 font-sans selection:bg-indigo-500/30">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Back Link */}
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Curatorial View
                </button>

                {/* Main Certificate / Proof */}
                <div className="glass-panel rounded-[40px] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.3)] overflow-hidden">
                    {/* Header: Institutional Branding */}
                    <header className="p-12 border-b border-white/5 bg-gradient-to-br from-indigo-500/10 to-transparent flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                                    <FileText className="text-white w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Formal Documentation Proof</span>
                            </div>
                            <h1 className="text-4xl font-black text-white tracking-tighter leading-tight">
                                {formTitle}
                            </h1>
                            <div className="mt-4 flex items-center gap-6 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                                <span className="flex items-center gap-2"><Calendar className="w-3 h-3" /> {new Date(submission.created_at || submission.created).toLocaleString()}</span>
                                <span className="flex items-center gap-2"><Database className="w-3 h-3" /> REF: {submission.id}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-zinc-800 tracking-tighter mb-1 select-none">MUSEO BULAWAN</div>
                            <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Digital Registry Archive</div>
                        </div>
                    </header>

                    {/* Content Body */}
                    <div className="p-12 space-y-12">
                        {/* Data Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-10 gap-x-16">
                            {Object.entries(data || {}).map(([key, value]) => (
                                <div key={key} className="space-y-1 border-b border-white/5 pb-4 group">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-indigo-500 transition-colors">
                                        {key.replace(/_/g, ' ')}
                                    </label>
                                    <div className="text-sm font-bold text-zinc-200">
                                        {Array.isArray(value) ? (
                                            <div className="space-y-1 mt-1">
                                                {value.map((v, i) => <div key={i} className="p-2 bg-white/5 rounded-lg text-xs">{v}</div>)}
                                            </div>
                                        ) : typeof value === 'object' ? (
                                            <pre className="text-[10px] font-mono bg-black/40 p-3 rounded-xl mt-1 overflow-auto max-h-40">{JSON.stringify(value, null, 2)}</pre>
                                        ) : (
                                            String(value) || <span className="text-zinc-800 italic">No entry</span>
                                        )
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Media Section */}
                        {media.length > 0 && (
                            <section className="pt-8 border-t border-white/5 space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                    Documentary Evidence ({media.length})
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {media.map((m) => (
                                        <div key={m.id} className="group relative aspect-square rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                                            <img 
                                                src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/form_submissions/${id}/${m.file_name}`}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                                            />
                                            <a 
                                                href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/form_submissions/${id}/${m.file_name}`}
                                                target="_blank" rel="noreferrer"
                                                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <ExternalLink className="text-white w-6 h-6" />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Footer: Security Seal */}
                    <footer className="p-12 bg-white/[0.02] border-t border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full border border-indigo-500/40 animate-pulse"></div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Registry Integrity Verified</div>
                                <div className="text-[9px] text-zinc-600 font-mono">HASH: {id.substring(0, 16)}...</div>
                            </div>
                        </div>
                        <button 
                            onClick={() => window.print()}
                            className="px-8 py-3 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" /> Export Proof
                        </button>
                    </footer>
                </div>

                {/* Meta Info */}
                <div className="flex justify-center gap-12 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700">
                    <span>Audit Status: Logged</span>
                    <span>System State: Immutable</span>
                    <span>Access Level: Curatorial</span>
                </div>
            </div>
        </div>
    );
}
