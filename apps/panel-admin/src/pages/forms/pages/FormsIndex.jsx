import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/authContext';
import { useSSE } from '../../../hooks/useSSE';
import { 
    Settings, Plus, LayoutGrid, Eye, Trash2, Edit, Save, X, 
    FileText, CheckCircle, ClipboardList, Database, AlertCircle, 
    ArrowRight, Upload, Calendar, Copy, ExternalLink, BarChart3, Star, MessageSquare, Edit2   // <-- Added Copy and ExternalLink
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

const CHART_COLORS = ['#d97706', '#b45309', '#78350f', '#f59e0b', '#fbbf24'];

export default function FormsIndex() {
    const { apiFetch } = useAuth();
    const { events } = useSSE('form_definitions');

    // Horizontal Tabs: Submissions, Builder, Analytics
    const [activeTab, setActiveTab] = useState('submissions');

    // State for all definitions & submissions
    const [definitions, setDefinitions] = useState([]);
    const [loadingDefinitions, setLoadingDefinitions] = useState(true);

    // ── Load Definitions ──
    const fetchDefinitions = useCallback(async () => {
        setLoadingDefinitions(true);
        try {
            const res = await apiFetch('/api/v1/forms/admin/definitions');
            const json = await res.json();
            if (json.status === 'success') {
                setDefinitions(json.data || []);
            }
        } catch (err) {
            console.error("Failed to load definitions", err);
        } finally {
            setLoadingDefinitions(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchDefinitions();
    }, [fetchDefinitions]);

    // Live update on definitions changes
    useEffect(() => {
        if (events.length > 0) fetchDefinitions();
    }, [events, fetchDefinitions]);

    // Filter Custom definitions for Submissions selector and Form Builder listing
    const customDefinitions = useMemo(() => {
        return definitions.filter(d => d.type === 'custom');
    }, [definitions]);

    // Find the user-feedback definition
    const feedbackDefinition = useMemo(() => {
        return definitions.find(d => d.type === 'feedback' || d.slug === 'user-feedback');
    }, [definitions]);

    return (
        <div className="flex flex-col gap-y-8 bg-white min-h-screen pb-12 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Forms Manager</h1>
                    <p className="text-sm text-zinc-500 mt-1">Design external forms, view user submissions, and inspect feedback analytics.</p>
                </div>
            </div>

            {/* Horizontal Tabs */}
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('submissions')}
                        className={`px-5 py-2 text-sm font-semibold rounded-md border transition-colors flex items-center gap-2 ${
                            activeTab === 'submissions' 
                                ? 'bg-black text-white border-black shadow-sm' 
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <ClipboardList className="w-4 h-4" />
                        Submissions
                    </button>
                    <button
                        onClick={() => setActiveTab('builder')}
                        className={`px-5 py-2 text-sm font-semibold rounded-md border transition-colors flex items-center gap-2 ${
                            activeTab === 'builder' 
                                ? 'bg-black text-white border-black shadow-sm' 
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <Settings className="w-4 h-4" />
                        Form Builder
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`px-5 py-2 text-sm font-semibold rounded-md border transition-colors flex items-center gap-2 ${
                            activeTab === 'analytics' 
                                ? 'bg-black text-white border-black shadow-sm' 
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <BarChart3 className="w-4 h-4" />
                        Feedback Analytics
                    </button>
                </div>
            </div>

            {/* Tab Views */}
            <div>
               {activeTab === 'submissions' && (
    <SubmissionsTab 
        forms={customDefinitions} 
        apiFetch={apiFetch} 
    />
)}
                {activeTab === 'builder' && (
                    <FormBuilderTab 
                        customDefinitions={customDefinitions} 
                        fetchDefinitions={fetchDefinitions} 
                        apiFetch={apiFetch} 
                    />
                )}
                {activeTab === 'analytics' && (
                    <FeedbackAnalyticsTab 
                        feedbackDefinition={feedbackDefinition} 
                        apiFetch={apiFetch} 
                    />
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SUBMISSIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
const SubmissionsTab = ({ forms, apiFetch }) => {
    const [selectedSlug, setSelectedSlug] = useState(forms.length > 0 ? forms[0].slug : '');
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!selectedSlug) return;
        const fetchSubmissions = async () => {
            setLoading(true);
            try {
                const res = await apiFetch(`/api/v1/forms/${selectedSlug}/submissions`);
                const json = await res.json();
                if (json.status === 'success') {
                    setSubmissions(json.data.items || []);
                }
            } catch (error) {
                console.error("Error fetching submissions:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSubmissions();
    }, [selectedSlug, apiFetch]);

    const selectedForm = forms.find(f => f.slug === selectedSlug);
    const schemaProperties = selectedForm?.schema?.properties || {};
    const propertyKeys = Object.keys(schemaProperties);
    
    // Generate a public URL based on current environment (Handles standard dev ports automatically)
    const publicUrl = `${window.location.protocol}//${window.location.hostname}${window.location.port ? (window.location.port === '5173' ? ':4321' : ':' + window.location.port) : ''}/forms/${selectedSlug}`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Form Selection Buttons */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Select Form to View Submissions</h3>
                <div className="flex flex-wrap gap-2.5">
                    {forms.length === 0 && (
                        <div className="text-sm text-gray-500 italic">No custom forms created yet.</div>
                    )}
                    {forms.map(form => (
                        <button
                            key={form.slug}
                            onClick={() => setSelectedSlug(form.slug)}
                            className={`px-5 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-200 ${
                                selectedSlug === form.slug 
                                    ? 'bg-black text-white border-black shadow-md scale-[1.02]' 
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                        >
                            {form.title}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sharing Link Bar */}
            {selectedSlug && (
                <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" /> Public Share Link
                        </h3>
                        <p className="text-xs text-amber-700 mt-1">Share this URL with users to collect submissions directly to this form.</p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <input 
                            type="text" 
                            readOnly 
                            value={publicUrl}
                            className="bg-white border border-amber-300 text-amber-900 text-xs px-3 py-2.5 rounded-lg w-full md:w-72 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <button 
                            onClick={copyToClipboard}
                            className="px-4 py-2.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors flex items-center gap-1.5 shrink-0"
                        >
                            {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} 
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                        <a 
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors shrink-0 flex items-center gap-1.5"
                        >
                            Open Form
                        </a>
                    </div>
                </div>
            )}

            {/* Submissions List */}
            {!selectedSlug ? null : loading ? (
                <div className="py-20 text-center text-zinc-500">
                    <div className="w-8 h-8 border-2 border-zinc-200 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
                    <span className="text-sm">Loading submission entries...</span>
                </div>
            ) : submissions.length === 0 ? (
                <div className="border border-gray-200 rounded-xl bg-white p-16 text-center text-zinc-400 shadow-sm">
                    <ClipboardList className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                    <p className="text-sm font-medium text-gray-500">No submissions have been received yet for this form.</p>
                </div>
            ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Submission ID</th>
                                    <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Email Address</th>
                                    <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Date Submitted</th>
                                    
                                    {/* Schema headers */}
                                    {propertyKeys.map(key => (
                                        <th key={key} className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                            {schemaProperties[key]?.title || key}
                                        </th>
                                    ))}
                                    <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {submissions.map((sub) => {
                                    let subData = {};
                                    try {
                                        subData = typeof sub.data === 'string' ? JSON.parse(sub.data) : (sub.data || {});
                                    } catch (e) {
                                        subData = sub.data || {};
                                    }

                                    return (
                                        <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-4 px-5 text-gray-500 font-mono text-xs">{sub.id}</td>
                                            <td className="py-4 px-5 text-gray-900 font-medium">{sub.submitted_email || 'anonymous'}</td>
                                            <td className="py-4 px-5 text-gray-500 text-xs">{new Date(sub.created_at || sub.created).toLocaleString()}</td>

                                            {/* Dynamic Schema values */}
                                            {propertyKeys.map(key => {
                                                const value = subData[key];
                                                const displayVal = (typeof value === 'object' && value !== null) 
                                                    ? JSON.stringify(value) 
                                                    : String(value ?? '—');
                                                return (
                                                    <td key={key} className="py-4 px-5 text-gray-700 max-w-[200px] truncate" title={displayVal}>
                                                        {displayVal}
                                                    </td>
                                                );
                                            })}

                                            <td className="py-4 px-5 text-right">
                                                <td className="py-4 px-5 text-right">
    <a 
        href={`/forms/submissions/${sub.id}`}
        className="inline-flex items-center justify-center p-2 bg-gray-100 text-gray-600 hover:bg-black hover:text-white rounded-lg transition-colors"
        title="View Full Submission"
    >
        <Eye className="w-4 h-4" />
    </a>
</td>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. FORM BUILDER TAB
// ─────────────────────────────────────────────────────────────────────────────
function FormBuilderTab({ customDefinitions, fetchDefinitions, apiFetch }) {
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingForm, setEditingForm] = useState(null); // null means "Create"

    // Form builder field states
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [otp, setOtp] = useState(false);
    const [layout, setLayout] = useState('single_column');
    const [allowAttachments, setAllowAttachments] = useState(false);
    const [description, setDescription] = useState('');
    const [fields, setFields] = useState([]);
    const [stepGroups, setStepGroups] = useState([]);

    const [saving, setSaving] = useState(false);

    // Open editor for creating new form
    const handleCreateForm = () => {
        setEditingForm(null);
        setTitle('');
        setSlug('');
        setOtp(false);
        setLayout('single_column');
        setAllowAttachments(false);
        setDescription('');
        setFields([
            { key: 'email', title: 'Email Address', type: 'string', format: 'email', options: '', required: true, stepGroup: '' }
        ]);
        setStepGroups([]);
        setEditorOpen(true);
    };

    // Open editor for modifying existing form
    const handleEditForm = (form) => {
        setEditingForm(form);
        setTitle(form.title);
        setSlug(form.slug);
        setOtp(form.otp);
        setLayout(form.settings?.layout || 'single_column');
        setAllowAttachments(form.settings?.allow_attachments || false);
        setDescription(form.settings?.description || '');
        
        // Extract step groups
        setStepGroups(form.settings?.step_groups || []);

        // Flatten schema properties
        const schema = form.schema_data || {};
        const props = schema.properties || {};
        const requiredFields = schema.required || [];

const loadedFields = Object.entries(props).map(([key, value]) => {
            return {
                key,
                title: value.title || key,
                type: value.type || 'string',
                format: value['ui:widget'] === 'rating' ? 'rating' : (value.format || 'text'),
                options: Array.isArray(value.enum) ? value.enum.join(', ') : '',
                required: requiredFields.includes(key),
                stepGroup: value['ui:group'] || ''
            };
        });

        setFields(loadedFields.length ? loadedFields : [
            { key: 'email', title: 'Email Address', type: 'string', format: 'email', options: '', required: true, stepGroup: '' }
        ]);
        
        setEditorOpen(true);
    };

    // Handle delete form
    const handleDeleteForm = async (id) => {
        if (!confirm("Are you sure you want to delete this custom form definition? This will permanently delete all associated submissions.")) {
            return;
        }

        try {
            const res = await apiFetch(`/api/v1/forms/admin/definitions/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchDefinitions();
            } else {
                const json = await res.json();
                alert(json.error || 'Failed to delete form definition.');
            }
        } catch (err) {
            alert(err.message);
        }
    };

    // Field lists management
    const addField = () => {
        setFields([...fields, { key: '', title: '', type: 'string', format: 'text', options: '', required: false, stepGroup: '' }]);
    };

    const removeField = (idx) => {
        setFields(fields.filter((_, i) => i !== idx));
    };

    const updateField = (idx, patch) => {
        setFields(fields.map((f, i) => i === idx ? { ...f, ...patch } : f));
    };

    // Step groups management
    const addStepGroup = () => {
        setStepGroups([...stepGroups, { id: `step_${stepGroups.length + 1}`, label: `Step ${stepGroups.length + 1}`, icon: 'arrow-right' }]);
    };

    const removeStepGroup = (idx) => {
        setStepGroups(stepGroups.filter((_, i) => i !== idx));
    };

    const updateStepGroup = (idx, patch) => {
        setStepGroups(stepGroups.map((g, i) => i === idx ? { ...g, ...patch } : g));
    };

    // Save Form Definition to API
    const handleSaveForm = async (e) => {
        e.preventDefault();
        
        // Validation checks
        if (!title.trim() || !slug.trim()) {
            alert("Title and Slug are required.");
            return;
        }

        const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
        if (cleanSlug !== slug) {
            alert("Slug must contain only alphanumeric lowercase characters and hyphens.");
            setSlug(cleanSlug);
            return;
        }

        const hasInvalidKeys = fields.some(f => !f.key.trim() || !/^[a-zA-Z0-9_]+$/.test(f.key));
        if (hasInvalidKeys) {
            alert("All fields must have a valid Field Key (letters, numbers, underscores only).");
            return;
        }

        setSaving(true);

        try {
            // Build properties JSON Schema
            const properties = {};
            const required = [];

            fields.forEach(f => {
                const key = f.key.trim();
                const prop = {
                    title: f.title.trim() || key,
                    type: f.type
                };

                if (f.format === 'rating') {
                    prop.type = 'integer';
                    prop['ui:widget'] = 'rating';
                    prop.minimum = 1;
                    prop.maximum = 5;
                } else if (f.format !== 'text') {
                    prop.format = f.format;
                }

                if (f.format === 'select' && f.options.trim()) {
                    prop.enum = f.options.split(',').map(o => o.trim()).filter(Boolean);
                }

                if (layout === 'wizard' && f.stepGroup) {
                    prop['ui:group'] = f.stepGroup;
                }

                properties[key] = prop;

                if (f.required) {
                    required.push(key);
                }
            });

            const schema_data = {
                type: "object",
                properties,
                required
            };

            const settings = {
                allow_attachments: allowAttachments,
                description: description.trim(),
                layout,
                step_groups: layout === 'wizard' ? stepGroups : []
            };

            const payload = {
                title: title.trim(),
                slug: cleanSlug,
                type: 'custom',
                otp,
                schema_data,
                settings
            };

            const url = editingForm 
                ? `/api/v1/forms/admin/definitions/${editingForm.id}`
                : `/api/v1/forms/admin/definitions`;
            
            const method = editingForm ? 'PATCH' : 'POST';

            const res = await apiFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || 'Failed to save form definition.');
            }

            setEditorOpen(false);
            fetchDefinitions();
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {!editorOpen ? (
                // --- Forms Grid Listing ---
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-zinc-950">Custom Form Definitions</h2>
                        <button
                            onClick={handleCreateForm}
                            className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-md hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" /> Create Custom Form
                        </button>
                    </div>

                    {customDefinitions.length === 0 ? (
                        <div className="border border-dashed border-gray-300 rounded-lg p-16 text-center text-zinc-400 bg-zinc-50/50">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                            <p className="text-sm font-medium">No custom forms created yet. Click "Create Custom Form" to build your first schema.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {customDefinitions.map(form => (
                                <div key={form.id} className="border border-zinc-200 rounded-xl bg-white p-6 shadow-sm flex flex-col justify-between hover:border-zinc-400 transition-colors relative group">
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 rounded">
                                                {form.settings?.layout || 'single_column'}
                                            </span>
                                            {form.otp && (
                                                <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 rounded">
                                                    OTP Required
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-md font-bold text-zinc-950 mb-1">{form.title}</h3>
                                        <p className="text-xs text-zinc-400 font-mono mb-2">/{form.slug}</p>
                                        <p className="text-xs text-zinc-600 font-light line-clamp-2 leading-relaxed mb-6">
                                            {form.settings?.description || 'No description provided.'}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-zinc-100 pt-4 mt-auto">
                                        <a
                                            href={`/forms/${form.slug}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-semibold text-amber-600 hover:text-amber-800 hover:underline flex items-center gap-1"
                                        >
                                            <Eye className="w-3.5 h-3.5" /> Preview Form
                                        </a>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEditForm(form)}
                                                className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded transition-colors"
                                                title="Edit Schema"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteForm(form.id)}
                                                className="p-1.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
            ) : (
                // --- Form Builder Editor UI ---
                <form onSubmit={handleSaveForm} className="border border-zinc-200 rounded-xl bg-white p-8 shadow-sm space-y-8 max-w-4xl mx-auto animate-in fade-in duration-500">
                    <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
                        <h2 className="text-xl font-bold text-zinc-950">
                            {editingForm ? `Edit Form: ${editingForm.title}` : 'Create Custom Form Definition'}
                        </h2>
                        <button
                            type="button"
                            onClick={() => setEditorOpen(false)}
                            className="px-4 py-2 border border-zinc-300 rounded text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>

                    {/* Metadata & Layout Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Form Title</label>
                            <input 
                                type="text" 
                                required
                                value={title}
                                onChange={e => {
                                    setTitle(e.target.value);
                                    if (!editingForm) {
                                        setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                                    }
                                }}
                                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                                placeholder="Visitor Questionnaire"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">URL Slug</label>
                            <input 
                                type="text" 
                                required
                                disabled={!!editingForm}
                                value={slug}
                                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black disabled:bg-zinc-50 disabled:text-zinc-400"
                                placeholder="visitor-questionnaire"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2 space-y-1">
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Form Description</label>
                            <textarea 
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={2}
                                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
                                placeholder="Short subtitle or summary shown to users."
                            />
                        </div>

                        <div className="flex items-center gap-6 py-2">
                            <label className="flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={otp}
                                    onChange={e => setOtp(e.target.checked)}
                                    className="w-4 h-4 border-gray-300 text-black rounded focus:ring-black"
                                />
                                <span className="ml-3 text-xs font-bold text-zinc-700 uppercase tracking-wider">Require Email OTP</span>
                            </label>

                            <label className="flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={allowAttachments}
                                    onChange={e => setAllowAttachments(e.target.checked)}
                                    className="w-4 h-4 border-gray-300 text-black rounded focus:ring-black"
                                />
                                <span className="ml-3 text-xs font-bold text-zinc-700 uppercase tracking-wider">Allow File Uploads</span>
                            </label>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Layout Style</label>
                            <select
                                value={layout}
                                onChange={e => setLayout(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                            >
                                <option value="single_column">Single Column Layout</option>
                                <option value="wizard">Multi-step Wizard Layout</option>
                            </select>
                        </div>
                    </div>

                    {/* Step Groups builder (if Wizard) */}
                    {layout === 'wizard' && (
                        <div className="border border-zinc-200 rounded-lg p-6 bg-zinc-50/50 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-widest">Wizard Step Groups</h3>
                                <button
                                    type="button"
                                    onClick={addStepGroup}
                                    className="text-xs font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Step Group
                                </button>
                            </div>

                            {stepGroups.length === 0 ? (
                                <p className="text-xs text-zinc-400 italic">No steps added yet. Add at least one step group.</p>
                            ) : (
                                <div className="space-y-3">
                                    {stepGroups.map((group, gIdx) => (
                                        <div key={gIdx} className="flex gap-4 items-center bg-white p-3 border border-zinc-200 rounded-md shadow-sm">
                                            <div className="flex-1 grid grid-cols-3 gap-3">
                                                <input
                                                    type="text"
                                                    required
                                                    value={group.id}
                                                    onChange={e => updateStepGroup(gIdx, { id: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                                                    placeholder="group_id"
                                                    className="border border-gray-300 rounded px-2.5 py-1 text-xs"
                                                />
                                                <input
                                                    type="text"
                                                    required
                                                    value={group.label}
                                                    onChange={e => updateStepGroup(gIdx, { label: e.target.value })}
                                                    placeholder="Step Label (e.g. Personal Details)"
                                                    className="border border-gray-300 rounded px-2.5 py-1 text-xs col-span-2"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeStepGroup(gIdx)}
                                                className="text-zinc-400 hover:text-red-500"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Fields Schema Builder */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Form Schema Fields</h3>
                            <button
                                type="button"
                                onClick={addField}
                                className="px-3 py-1.5 border border-black text-black text-xs font-bold uppercase tracking-wider rounded hover:bg-zinc-50 transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add Form Field
                            </button>
                        </div>

                        <div className="space-y-4">
                            {fields.map((f, idx) => (
                                <div key={idx} className="flex flex-col gap-3 bg-zinc-50/50 border border-zinc-200 rounded-lg p-5 relative group">
                                    <button
                                        type="button"
                                        onClick={() => removeField(idx)}
                                        className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 transition-colors"
                                    >
                                        ✕
                                    </button>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Field ID Key</label>
                                            <input
                                                type="text"
                                                required
                                                value={f.key}
                                                onChange={e => updateField(idx, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                                                placeholder="phone_number"
                                                className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Field Label</label>
                                            <input
                                                type="text"
                                                required
                                                value={f.title}
                                                onChange={e => updateField(idx, { title: e.target.value })}
                                                placeholder="Phone Number"
                                                className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Input Format</label>
                                            <select
                                                value={f.format}
                                                onChange={e => {
                                                    const format = e.target.value;
                                                    let type = 'string';
                                                    if (format === 'select') type = 'string';
                                                    if (format === 'date') type = 'string';
                                                    if (format === 'rating') type = 'integer';
                                                    updateField(idx, { format, type });
                                                }}
                                                className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none"
                                            >
                                                <option value="text">Single Line Text</option>
                                                <option value="textarea">Multi-line Text</option>
                                                <option value="email">Email Input</option>
                                                <option value="date">Date Input</option>
                                                <option value="select">Dropdown Select</option>
                                                <option value="rating">Rating (1-5)</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-4 py-4">
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={f.required}
                                                    onChange={e => updateField(idx, { required: e.target.checked })}
                                                    className="w-3.5 h-3.5 border-gray-300 text-black rounded focus:ring-black"
                                                />
                                                <span className="ml-2 text-xs font-semibold text-zinc-600">Required</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Select Options details */}
                                    {f.format === 'select' && (
                                        <div className="space-y-1 w-full max-w-xl">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Select Options (comma-separated)</label>
                                            <input
                                                type="text"
                                                required
                                                value={f.options}
                                                onChange={e => updateField(idx, { options: e.target.value })}
                                                placeholder="Website, Museum, Staff, Social Media"
                                                className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none"
                                            />
                                        </div>
                                    )}

                                    {/* Step Group selector (if Wizard) */}
                                    {layout === 'wizard' && stepGroups.length > 0 && (
                                        <div className="space-y-1 w-full max-w-xs">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Assign to Wizard Step</label>
                                            <select
                                                value={f.stepGroup}
                                                onChange={e => updateField(idx, { stepGroup: e.target.value })}
                                                className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none"
                                            >
                                                <option value="">-- No step assigned --</option>
                                                {stepGroups.map(g => (
                                                    <option key={g.id} value={g.id}>{g.label} ({g.id})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-zinc-100 pt-6">
                        <button
                            type="button"
                            onClick={() => setEditorOpen(false)}
                            className="px-5 py-2.5 border border-zinc-300 rounded text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-md border border-black hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Form Definition'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FEEDBACK ANALYTICS TAB
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackAnalyticsTab({ feedbackDefinition, apiFetch }) {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchSubmissions = useCallback(async () => {
        if (!feedbackDefinition) return;
        setLoading(true);
        try {
            const res = await apiFetch(`/api/v1/forms/${feedbackDefinition.slug}/submissions`);
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

    // Parse all ratings & categories
    const analyticsData = useMemo(() => {
        if (submissions.length === 0) {
            return {
                averageRating: 0,
                ratingDistribution: [],
                categoryDistribution: [],
                recentComments: []
            };
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

            const cat = data.feedback_type || 'Other';
            categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;

            if (data.comments) {
                comments.push({
                    id: sub.id,
                    email: sub.submitted_email || 'anonymous',
                    comments: data.comments,
                    rating,
                    category: cat,
                    date: new Date(sub.created_at || sub.created).toLocaleDateString()
                });
            }
        });

        const totalValidRatings = Object.values(ratingsCount).reduce((a, b) => a + b, 0);
        const averageRating = totalValidRatings > 0 ? (ratingSum / totalValidRatings).toFixed(1) : 0;

        const ratingDistribution = Object.entries(ratingsCount).map(([stars, count]) => ({
            name: `${stars} ★`,
            value: count
        }));

        const categoryDistribution = Object.entries(categoriesCount).map(([name, count]) => ({
            name,
            value: count
        }));

        return {
            averageRating,
            ratingDistribution,
            categoryDistribution,
            recentComments: comments.slice(0, 10) // show last 10 comments
        };
    }, [submissions]);

    if (!feedbackDefinition) {
        return (
            <div className="border border-dashed border-gray-300 rounded-lg p-16 text-center text-zinc-400 bg-zinc-50/50">
                <HelpCircle className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                <p className="text-sm font-medium">Seeded 'user-feedback' form definition not found. Please verify if database was seeded correctly.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="py-20 text-center text-zinc-500">
                <div className="w-8 h-8 border-2 border-zinc-200 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
                <span className="text-sm">Analyzing visitor feedback...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-[#1c1c1c] rounded-xl flex flex-col items-center justify-center py-6 px-4 shadow-sm border border-zinc-800 text-white">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 text-center">Average Rating</span>
                    <span className="text-4xl font-extrabold text-amber-500 tracking-tight flex items-center gap-1.5">
                        {analyticsData.averageRating} <Star className="w-6 h-6 fill-amber-500 text-amber-500 shrink-0" />
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-1 uppercase">Out of 5 Stars</span>
                </div>

                <div className="bg-[#1c1c1c] rounded-xl flex flex-col items-center justify-center py-6 px-4 shadow-sm border border-zinc-800 text-white">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 text-center">Total Responses</span>
                    <span className="text-4xl font-extrabold text-white tracking-tight">
                        {submissions.length}
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-1 uppercase">Submissions Logs</span>
                </div>

                <div className="bg-[#1c1c1c] rounded-xl flex flex-col items-center justify-center py-6 px-4 shadow-sm border border-zinc-800 text-white">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 text-center">Satisfactory Rate</span>
                    <span className="text-4xl font-extrabold text-emerald-400 tracking-tight">
                        {submissions.length > 0 
                            ? `${((submissions.filter(s => {
                                let d = {};
                                try { d = typeof s.data === 'string' ? JSON.parse(s.data) : s.data; } catch(e){}
                                return Number(d.rating || 0) >= 4;
                            }).length / submissions.length) * 100).toFixed(0)}%` 
                            : '0%'}
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-1 uppercase">Ratings &ge; 4 Stars</span>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Recharts Bar Chart - Ratings distribution */}
                <div className="lg:col-span-7 bg-zinc-50/50 border border-zinc-200 rounded-2xl p-6 relative">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">Ratings Distribution</h3>
                    <div className="h-[280px] w-full">
                        {submissions.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-zinc-400 italic">No ratings to display</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analyticsData.ratingDistribution}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                                    <XAxis dataKey="name" stroke="#71717a" fontSize={11} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#71717a" fontSize={11} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', fontSize: '12px' }} />
                                    <Bar dataKey="value" fill="#d97706" radius={[6, 6, 0, 0]} maxBarSize={45} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Recharts Pie Chart - Category breakdown */}
                <div className="lg:col-span-5 bg-zinc-50/50 border border-zinc-200 rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">Feedback Categories</h3>
                        <div className="h-[200px] w-full">
                            {submissions.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-xs text-zinc-400 italic">No category data</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analyticsData.categoryDistribution}
                                            cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4}
                                            dataKey="value" nameKey="name"
                                        >
                                            {analyticsData.categoryDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', fontSize: '11px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                    {submissions.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            {analyticsData.categoryDistribution.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                                    <span className="truncate">{item.name} ({item.value})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Feed comments list */}
            <div className="border border-zinc-200 rounded-2xl bg-white p-6">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-amber-600" /> Recent User Comments
                </h3>

                {analyticsData.recentComments.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic py-4">No text comments have been submitted yet.</p>
                ) : (
                    <div className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto pr-2 space-y-4">
                        {analyticsData.recentComments.map((item, idx) => (
                            <div key={item.id} className="pt-4 first:pt-0">
                                <div className="flex items-center justify-between gap-4 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-800">{item.email}</span>
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-500">
                                            {item.category}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center text-amber-500 text-xs">
                                            {Array.from({ length: item.rating }).map((_, i) => (
                                                <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                            ))}
                                        </div>
                                        <span className="text-[10px] text-zinc-400">{item.date}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-600 font-light leading-relaxed whitespace-pre-wrap">{item.comments}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
