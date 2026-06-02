import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../../components';
import { useAuth } from '../../../context/authContext';
import { useSSE } from '../../../hooks/useSSE';
import { 
    Plus, Eye, Trash2, FileText, CheckCircle, ClipboardList, AlertCircle, 
    BarChart3, Edit2
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

const CHART_COLORS = ['#d97706', '#b45309', '#78350f', '#f59e0b', '#fbbf24'];

export default function FormsIndex() {
    const { apiFetch } = useAuth();
    const navigate = useNavigate();
    const { events } = useSSE('form_definitions');

    const [activeTab, setActiveTab] = useState('forms');
    const [definitions, setDefinitions] = useState([]);
    const [loadingDefinitions, setLoadingDefinitions] = useState(true);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });

    // New form modal state
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newSlug, setNewSlug] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchDefinitions = useCallback(async () => {
        setLoadingDefinitions(true);
        try {
            const res = await apiFetch('/api/v1/forms/admin/definitions');
            const json = await res.json();
            if (json.status === 'success') {
                setDefinitions(json.data || []);
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Save Error', message: err.message, type: 'alert', variant: 'error' });
        } finally {  
            setLoadingDefinitions(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchDefinitions();
    }, [fetchDefinitions]);

    useEffect(() => {
        if (events.length > 0) fetchDefinitions();
    }, [events, fetchDefinitions]);

    const customDefinitions = useMemo(() => {
        return definitions.filter(d => d.type === 'custom');
    }, [definitions]);

    const feedbackDefinition = useMemo(() => {
        return definitions.find(d => d.type === 'feedback' || d.id === '01KQEFB1FEEDBACKFORMSEED00');
    }, [definitions]);

    const handleDeleteForm = (id) => {
        setModal({
            isOpen: true,
            title: 'Confirm Deletion',
            message: 'Are you sure you want to delete this custom form definition? This will permanently delete all associated submissions.',
            type: 'confirm',
            variant: 'warning',
            onConfirm: async () => {
                setModal(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await apiFetch(`/api/v1/forms/admin/definitions/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        fetchDefinitions();
                    } else {
                        const json = await res.json();
                        setModal({ isOpen: true, title: 'Deletion Failed', message: json.error || 'Failed to delete form definition.', type: 'alert', variant: 'error' });
                    }
                } catch (err) {
                    setModal({ isOpen: true, title: 'Error', message: err.message, type: 'alert', variant: 'error' });
                }
            }
        });
    };

    const handleCreateForm = async (e) => {
        e.preventDefault();
        if (!newTitle.trim() || !newSlug.trim()) return;

        setCreating(true);
        try {
            const payload = {
                title: newTitle.trim(),
                slug: newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                type: 'custom',
                otp: false,
                schema_data: { 
                    type: "object", 
                    properties: {
                        email: { title: "Email Address", type: "string", format: "email" }
                    }, 
                    required: ["email"] 
                },
                settings: { allow_attachments: false, description: "", layout: "single_column", step_groups: [] }
            };

            const res = await apiFetch(`/api/v1/forms/admin/definitions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to create form definition.');

            setCreateModalOpen(false);
            setNewTitle('');
            setNewSlug('');
            
            // Navigate to the newly created form's builder page
            navigate(`/forms/builder/${json.data.id}`);

        } catch (err) {
            alert(err.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="flex flex-col gap-y-8 bg-white min-h-fit max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Forms Manager</h1>
                    <p className="text-sm text-zinc-500 mt-1">Manage custom forms, view submissions, and analyze feedback.</p>
                </div>
            </div>

            {/* Horizontal Tabs */}
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('forms')}
                        className={`px-5 py-2 text-sm font-semibold rounded-md border transition-colors flex items-center gap-2 ${
                            activeTab === 'forms' ? 'bg-black text-white border-black shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <FileText className="w-4 h-4" /> Custom Forms
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`px-5 py-2 text-sm font-semibold rounded-md border transition-colors flex items-center gap-2 ${
                            activeTab === 'analytics' ? 'bg-black text-white border-black shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <BarChart3 className="w-4 h-4" /> Feedback Analytics
                    </button>
                </div>
            </div>

            {/* Tab Views */}
            <div>
                {activeTab === 'forms' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-zinc-950">My Forms</h2>
                            <button
                                onClick={() => setCreateModalOpen(true)}
                                className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-md hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" /> Create New Form
                            </button>
                        </div>

                        {loadingDefinitions ? (
                            <div className="py-20 text-center text-zinc-500">
                                <div className="w-8 h-8 border-2 border-zinc-200 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
                                <span className="text-sm">Loading forms...</span>
                            </div>
                        ) : customDefinitions.length === 0 ? (
                            <div className="border border-dashed border-gray-300 rounded-lg p-16 text-center text-zinc-400 bg-zinc-50/50">
                                <FileText className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                                <p className="text-sm font-medium">No custom forms created yet. Click "Create New Form" to get started.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {customDefinitions.map(form => (
                                    <div key={form.id} className="group border border-gray-200 rounded-xl bg-white p-5 flex flex-col hover:border-gray-300 hover:shadow-md transition-all min-h-[200px]">
                                        
                                        {/* Badges Container */}
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest bg-gray-100 text-gray-600 rounded-md">
                                                {form.settings?.layout || 'SINGLE_COLUMN'}
                                            </span>
                                            {form.otp && (
                                                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest bg-amber-100 text-amber-800 rounded-md">
                                                    OTP Required
                                                </span>
                                            )}
                                        </div>

                                        {/* Body Content - flex-1 pushes the footer to the bottom */}
                                        <div className="flex-1 mb-4">
                                            <h3 className="text-xl font-bold text-gray-900 mb-1 leading-tight line-clamp-1" title={form.title}>
                                                {form.title}
                                            </h3>
                                            <div className="flex items-center text-sm text-gray-500 font-mono mb-3">
                                                <span className="text-gray-400 mr-0.5">/</span>
                                                <span className="truncate">{form.slug}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 font-normal line-clamp-2 leading-relaxed">
                                                {form.settings?.description || 'No description provided.'}
                                            </p>
                                        </div>

                                        {/* Action Footer */}
                                        <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-auto">
                                            <a
                                                href={`/forms/${form.id.toLowerCase()}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 hover:text-amber-800 transition-colors"
                                            >
                                                <Eye className="w-4 h-4" /> Preview
                                            </a>

                                            <div className="flex items-center gap-2">
                                                {/* Button flex classes ensure icon and text sit perfectly inline */}
                                                <button
                                                    onClick={() => navigate(`/forms/builder/${form.id}`)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-100 rounded-md transition-colors"
                                                    title="Manage Form"
                                                >
                                                    <Edit2 className="w-4 h-4" /> Manage
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteForm(form.id)}
                                                    className="flex items-center justify-center p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Delete Form"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <FeedbackAnalyticsTab feedbackDefinition={feedbackDefinition} apiFetch={apiFetch} />
                )}
            </div>

            {/* Create Form Modal */}
            {createModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                            <h3 className="text-lg font-bold text-zinc-900">Create New Form</h3>
                        </div>
                        <form onSubmit={handleCreateForm} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Form Title</label>
                                <input 
                                    type="text" 
                                    required
                                    value={newTitle}
                                    onChange={e => {
                                        setNewTitle(e.target.value);
                                        setNewSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                                    }}
                                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                                    placeholder="e.g. Visitor Feedback"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">URL Slug</label>
                                <input 
                                    type="text" 
                                    required
                                    value={newSlug}
                                    onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                                    placeholder="visitor-feedback"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:text-black">Cancel</button>
                                <button type="submit" disabled={creating} className="px-5 py-2 bg-black text-white text-sm font-bold rounded-md hover:bg-zinc-800 disabled:opacity-50">
                                    {creating ? 'Creating...' : 'Create Form'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Modal {...modal} onClose={() => setModal(prev => ({ ...prev, isOpen: false }))} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK ANALYTICS TAB
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackAnalyticsTab({ feedbackDefinition, apiFetch }) {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchSubmissions = useCallback(async () => {
        if (!feedbackDefinition) return;
        setLoading(true);
        try {
            const res = await apiFetch(`/api/v1/forms/${feedbackDefinition.id}/submissions`);
            const json = await res.json();
            if (json.status === 'success') {
                setSubmissions(json.data.items || []);
            }
        } catch (err) {
            console.error("Failed to load feedback submissions", err);
        } finally {
            setLoading(false);
        }
    }, [feedbackDefinition, apiFetch]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const analyticsData = useMemo(() => {
        if (submissions.length === 0) {
            return { averageRating: 0, ratingDistribution: [], categoryDistribution: [], recentComments: [] };
        }

        let ratingSum = 0;
        const ratingsCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const categoriesCount = {};
        const comments = [];

        submissions.forEach(sub => {
            let data = {};
            try {
                data = typeof sub.data === 'string' ? JSON.parse(sub.data) : (sub.data || {});
            } catch (e) {
                data = sub.data || {};
            }

            const rating = Number(data.rating || 0);
            if (rating >= 1 && rating <= 5) {
                ratingsCount[rating] += 1;
                ratingSum += rating;
            }

            if (data.category) {
                categoriesCount[data.category] = (categoriesCount[data.category] || 0) + 1;
            }

            if (data.comments && data.comments.trim() !== '') {
                comments.push({ id: sub.id, date: sub.created_at || sub.created, text: data.comments });
            }
        });

        const totalRatings = Object.values(ratingsCount).reduce((a, b) => a + b, 0);
        const avg = totalRatings > 0 ? (ratingSum / totalRatings).toFixed(1) : 0;

        const ratingDist = Object.keys(ratingsCount).map(k => ({ star: `${k} Star`, count: ratingsCount[k] })).reverse();
        const categoryDist = Object.keys(categoriesCount).map((k, i) => ({ name: k, value: categoriesCount[k] }));

        return { averageRating: avg, ratingDistribution: ratingDist, categoryDistribution: categoryDist, recentComments: comments.slice(0, 10) };
    }, [submissions]);

    if (!feedbackDefinition) {
        return (
            <div className="border border-gray-200 rounded-xl bg-white p-16 text-center text-zinc-400 shadow-sm animate-in fade-in">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                <p className="text-sm font-medium">No Feedback form definition found.</p>
                <p className="text-xs mt-1">Make sure you have a form with type "feedback" or ID "01KQEFB1FEEDBACKFORMSEED00".</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="py-20 text-center text-zinc-500 animate-in fade-in">
                <div className="w-8 h-8 border-2 border-zinc-200 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
                <span className="text-sm">Loading analytics...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* ... Global Analytics view ... */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="col-span-1 lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Total Feedback</p>
                        <p className="text-4xl font-black text-gray-900">{submissions.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Average Rating</p>
                        <div className="flex items-center gap-2">
                            <p className="text-4xl font-black text-amber-600">{analyticsData.averageRating}</p>
                            <span className="text-lg text-amber-600">/ 5</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Categories Logged</p>
                        <p className="text-4xl font-black text-gray-900">{analyticsData.categoryDistribution.length}</p>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-6 uppercase tracking-widest">Rating Distribution</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData.ratingDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="star" type="category" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }} />
                                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="count" fill="#fbbf24" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-6 uppercase tracking-widest">Feedback Categories</h3>
                    {analyticsData.categoryDistribution.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-sm text-gray-400 italic">No category data available</div>
                    ) : (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={analyticsData.categoryDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {analyticsData.categoryDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="mt-4 flex flex-wrap gap-2 justify-center">
                                {analyticsData.categoryDistribution.map((entry, index) => (
                                    <div key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></div>
                                        {entry.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}