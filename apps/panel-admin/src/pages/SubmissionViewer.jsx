// apps/panel-admin/src/pages/SubmissionViewer.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { 
    FileText, Calendar, Database, ArrowLeft, Download, 
    ExternalLink, ChevronRight, User
} from 'lucide-react';

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
        <div className="flex flex-col gap-y-8 bg-white min-h-screen pb-12 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <div className="py-32 text-center text-zinc-500">
                <div className="w-8 h-8 border-2 border-zinc-200 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
                <span className="text-sm font-semibold tracking-widest uppercase">Loading Submission Details...</span>
            </div>
        </div>
    );

    if (!submission) return (
        <div className="flex flex-col gap-y-8 bg-white min-h-screen pb-12 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <div className="flex flex-col items-center justify-center py-32 text-gray-500 border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                <div className="text-4xl mb-4">🚫</div>
                <h2 className="text-xl font-bold text-gray-900">Record Not Found</h2>
                <p className="mt-2 text-sm">The requested submission ID does not exist.</p>
                <button onClick={() => navigate('/forms')} className="mt-8 px-6 py-2.5 bg-black text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-all">Back to Forms Manager</button>
            </div>
        </div>
    );

    const data = (typeof submission.data === 'string' ? JSON.parse(submission.data) : submission.data) || {};
    const formTitle = submission.expand?.form_id?.title || 'Standard Submission';

    return (
        <div className="flex flex-col gap-y-8 bg-white min-h-screen pb-12 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 animate-in fade-in duration-500">
            
            {/* Header & Breadcrumb */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-6">
                <div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 mb-3 uppercase tracking-widest">
                        <Link to="/forms" className="hover:text-black transition-colors flex items-center gap-1">
                            <ArrowLeft className="w-3.5 h-3.5" /> Forms Manager
                        </Link>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        <span className="text-amber-600 truncate max-w-[150px] sm:max-w-none">{formTitle}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        <span className="text-gray-900">Submission View</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Submission Record</h1>
                    <p className="text-sm text-gray-500 mt-1">Reviewing response data and attached documentation.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => window.print()}
                        className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Download className="w-4 h-4" /> Print / Export
                    </button>
                </div>
            </div>

            {/* Info Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col justify-center shadow-sm">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Submitter Email</span>
                    <span className="text-sm font-bold text-gray-900 flex items-center gap-2 truncate">
                        <User className="w-4 h-4 text-gray-400 shrink-0" /> {submission.submitted_email || 'Anonymous'}
                    </span>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col justify-center shadow-sm">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Date Submitted</span>
                    <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400 shrink-0" /> {new Date(submission.created_at || submission.created).toLocaleString()}
                    </span>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col justify-center shadow-sm">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">System Ref ID</span>
                    <span className="text-sm font-bold text-gray-900 flex items-center gap-2 font-mono truncate">
                        <Database className="w-4 h-4 text-gray-400 shrink-0" /> {submission.id}
                    </span>
                </div>
            </div>

            {/* Data Grid */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-gray-50/50 border-b border-gray-100 px-8 py-5">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest">Form Responses</h3>
                </div>
                <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                        {Object.entries(data || {}).map(([key, value]) => (
                            <div key={key} className="space-y-1 pb-4 border-b border-gray-100 last:border-0 md:[&:nth-last-child(-n+2)]:border-0">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    {key.replace(/_/g, ' ')}
                                </label>
                                <div className="text-sm font-medium text-gray-900 mt-1">
                                    {Array.isArray(value) ? (
                                        <div className="space-y-1 mt-1">
                                            {value.map((v, i) => <div key={i} className="p-2 bg-gray-50 rounded-lg text-xs border border-gray-100">{v}</div>)}
                                        </div>
                                    ) : typeof value === 'object' && value !== null ? (
                                        <pre className="text-[10px] font-mono bg-gray-50 p-3 rounded-lg border border-gray-100 mt-1 overflow-auto max-h-40">{JSON.stringify(value, null, 2)}</pre>
                                    ) : (
                                        String(value) || <span className="text-gray-400 italic font-normal">No entry provided</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Attachments Section */}
            {media.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-gray-50/50 border-b border-gray-100 px-8 py-5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-500" /> Uploaded Attachments ({media.length})
                        </h3>
                    </div>
                    <div className="p-8">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {media.map((m) => (
                                <div key={m.id} className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shadow-sm block">
                                    <img 
                                        src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/form_submissions/${id}/${m.file_name}`}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        alt="Attachment preview"
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
                    </div>
                </div>
            )}
        </div>
    );
}   