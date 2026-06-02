import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { Modal } from '../../../components';
import { 
    Settings, Eye, Save, ClipboardList, AlertCircle, ArrowLeft,
    Copy, ExternalLink, Code, Plus, Trash2, CheckCircle, Download
} from 'lucide-react';

export default function FormDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { apiFetch } = useAuth();

    const [activeTab, setActiveTab] = useState('builder');
    const [formDef, setFormDef] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });

    // Fetch definition
    const fetchDefinition = useCallback(async () => {
        try {
            const res = await apiFetch(`/api/v1/forms/admin/definitions`);
            const json = await res.json();
            if (json.status === 'success') {
                const found = json.data.find(d => d.id === id);
                if (found) {
                    setFormDef(found);
                } else {
                    navigate('/forms');
                }
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: err.message, type: 'alert', variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [id, apiFetch, navigate]);

    useEffect(() => {
        fetchDefinition();
    }, [fetchDefinition]);

    if (loading) return (
        <div className="flex flex-col gap-y-8 bg-white min-h-fit max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 items-center justify-center h-96">
            <div className="w-8 h-8 border-2 border-zinc-200 border-t-black rounded-full animate-spin"></div>
        </div>
    );

    if (!formDef) return null;

    return (
        <div className="flex flex-col gap-y-8 bg-white min-h-fit max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <div className="flex items-center justify-between">
                <div>
                    <button onClick={() => navigate('/forms')} className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-black uppercase tracking-widest mb-4">
                        <ArrowLeft className="w-4 h-4" /> Back to Forms
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{formDef.title}</h1>
                    <p className="text-sm text-zinc-500 mt-1 font-mono">ID: {formDef.id}</p>
                </div>
                <div className="flex gap-3">
                    <a 
                        href={`/forms/${formDef.id.toLowerCase()}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 border border-zinc-300 rounded text-sm font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                    >
                        <ExternalLink className="w-4 h-4" /> Preview
                    </a>
                </div>
            </div>

            <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
                <button
                    onClick={() => setActiveTab('builder')}
                    className={`px-5 py-2 text-sm font-semibold rounded-md border transition-colors flex items-center gap-2 ${
                        activeTab === 'builder' ? 'bg-black text-white border-black shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    <Settings className="w-4 h-4" /> Builder
                </button>
                <button
                    onClick={() => setActiveTab('submissions')}
                    className={`px-5 py-2 text-sm font-semibold rounded-md border transition-colors flex items-center gap-2 ${
                        activeTab === 'submissions' ? 'bg-black text-white border-black shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    <ClipboardList className="w-4 h-4" /> Submissions
                </button>
                <button
                    onClick={() => setActiveTab('embed')}
                    className={`px-5 py-2 text-sm font-semibold rounded-md border transition-colors flex items-center gap-2 ${
                        activeTab === 'embed' ? 'bg-black text-white border-black shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    <Code className="w-4 h-4" /> Share & Embed
                </button>
            </div>

            <div>
                {activeTab === 'builder' && <FormBuilderTab form={formDef} fetchDefinition={fetchDefinition} apiFetch={apiFetch} setModal={setModal} />}
                {activeTab === 'submissions' && <SubmissionsTab form={formDef} apiFetch={apiFetch} setModal={setModal} />}
                {activeTab === 'embed' && <EmbedTab form={formDef} />}
            </div>

            <Modal {...modal} onClose={() => setModal(prev => ({ ...prev, isOpen: false }))} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARE & EMBED TAB
// ─────────────────────────────────────────────────────────────────────────────
function EmbedTab({ form }) {
    const publicUrl = `${window.location.protocol}//${window.location.hostname}${window.location.port ? (window.location.port === '5173' ? ':4321' : ':' + window.location.port) : ''}/forms/${form.id.toLowerCase()}`;
    const embedUrl = `${window.location.protocol}//${window.location.hostname}${window.location.port ? (window.location.port === '5173' ? ':4321' : ':' + window.location.port) : ''}/forms/embed/${form.id}`;
    
    const iframeCode = `<iframe src="${embedUrl}" width="100%" height="600" style="border:none; border-radius: 8px; overflow:hidden;" title="${form.title}"></iframe>`;

    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedIframe, setCopiedIframe] = useState(false);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 ">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Public Form URL</h3>
                <p className="text-sm text-gray-500 mb-4">Share this direct link with your audience to collect responses.</p>
                <div className="flex items-center gap-3">
                    <input 
                        type="text" 
                        readOnly 
                        value={publicUrl}
                        className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 text-sm px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(publicUrl);
                            setCopiedUrl(true);
                            setTimeout(() => setCopiedUrl(false), 2000);
                        }}
                        className="px-6 py-3 bg-black text-white rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    >
                        {copiedUrl ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiedUrl ? 'Copied' : 'Copy'}
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Embed via iframe</h3>
                <p className="text-sm text-gray-500 mb-4">Copy and paste this HTML code into your website builder (WordPress, Webflow, Shopify, etc.) to embed the form directly.</p>
                <div className="flex items-start gap-3">
                    <textarea 
                        readOnly 
                        value={iframeCode}
                        rows={3}
                        className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 text-sm font-mono px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
                    />
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(iframeCode);
                            setCopiedIframe(true);
                            setTimeout(() => setCopiedIframe(false), 2000);
                        }}
                        className="px-6 py-3 bg-black text-white rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    >
                        {copiedIframe ? <CheckCircle className="w-4 h-4" /> : <Code className="w-4 h-4" />} {copiedIframe ? 'Copied' : 'Copy Code'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSIONS TAB (Scoped to form)
// ─────────────────────────────────────────────────────────────────────────────
function SubmissionsTab({ form, apiFetch, setModal }) {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSubmissions = async () => {
            try {
                const res = await apiFetch(`/api/v1/forms/${form.id}/submissions`);
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
    }, [form.id, apiFetch]);

    const schemaProperties = form?.schema?.properties || {};
    const propertyKeys = Object.keys(schemaProperties);

    const handleExport = async () => {
        try {
            const res = await apiFetch(`/api/v1/forms/admin/submissions/export?id=${form.id}`);
            if (!res.ok) {
                setModal({ isOpen: true, title: 'Export Failed', message: 'Failed to export submissions.', type: 'alert', variant: 'error' });
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `submissions-${form.id}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setModal({ isOpen: true, title: 'Export Error', message: 'Error exporting submissions.', type: 'alert', variant: 'error' });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-widest">Received Submissions ({submissions.length})</h3>
                <button 
                    onClick={handleExport}
                    disabled={submissions.length === 0}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download className="w-4 h-4" /> Export to Excel
                </button>
            </div>

            {loading ? (
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
                                                <a 
                                                    href={`/forms/submissions/${sub.id}`}
                                                    className="inline-flex items-center justify-center p-2 bg-gray-100 text-gray-600 hover:bg-black hover:text-white rounded-lg transition-colors"
                                                    title="View Full Submission"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </a>
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
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER TAB
// ─────────────────────────────────────────────────────────────────────────────
function FormBuilderTab({ form, fetchDefinition, apiFetch, setModal }) {
    const [title, setTitle] = useState(form.title);
    const [slug, setSlug] = useState(form.slug);
    const [otp, setOtp] = useState(!!form.otp);
    const [layout, setLayout] = useState(form.settings?.layout || 'single_column');
    const [allowAttachments, setAllowAttachments] = useState(form.settings?.allow_attachments || false);
    const [description, setDescription] = useState(form.settings?.description || '');

    // Info Block (intro notice shown before form fields)
    const infoBlock = form.settings?.info_block || form.settings?.infoBlock || {};
    const [showInfoBlock, setShowInfoBlock] = useState(!!(infoBlock.header || infoBlock.description));
    const [infoHeader, setInfoHeader] = useState(infoBlock.header || infoBlock.title || '');
    const [infoDescription, setInfoDescription] = useState(infoBlock.description || infoBlock.text || '');

    // Field Mapping
    const fieldMapping = form.settings?.field_mapping || {};
    const [emailFieldKey, setEmailFieldKey] = useState(fieldMapping.donorEmail || 'email');

    // File upload settings (global)
    const [maxFiles, setMaxFiles] = useState(form.settings?.max_files || 5);
    const [maxFileSizeMB, setMaxFileSizeMB] = useState(form.settings?.max_file_size_mb || 10);
    const [acceptedFileTypes, setAcceptedFileTypes] = useState(form.settings?.accepted_file_types || '');

    const [stepGroups, setStepGroups] = useState(form.settings?.step_groups || []);
    const [fields, setFields] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const schema = form.schema_data || {};
        const props = schema.properties || {};
        const requiredFields = schema.required || [];

        const loadedFields = Object.entries(props).map(([key, value]) => {
            const format = value['ui:widget'] || value.format || (value.type === 'boolean' ? 'toggle' : 'text');
            // Parse dependsOn
            const dep = value['ui:dependsOn'] || value['dependsOn'];
            return {
                key,
                title: value.title || key,
                type: value.type || 'string',
                format: format,
                options: Array.isArray(value.enum) ? value.enum.join(', ') : '',
                rows: Array.isArray(value['ui:rows']) ? value['ui:rows'].join(', ') : '',
                columns: Array.isArray(value['ui:columns']) ? value['ui:columns'].join(', ') : '',
                minLabel: value['ui:minLabel'] || '',
                maxLabel: value['ui:maxLabel'] || '',
                required: requiredFields.includes(key),
                stepGroup: value['ui:group'] || '',
                hidden: value['ui:widget'] === 'hidden',
                // File-specific
                fileAccept: value['ui:accept'] || '',
                fileMaxCount: value['ui:maxFiles'] || '',
                // Conditional visibility
                hasDependsOn: !!dep,
                dependsOnField: dep?.field || '',
                dependsOnValue: dep?.value || '',
                dependsOnOperator: dep?.operator || 'eq'
            };
        });

        setFields(loadedFields.length ? loadedFields : [
            { key: 'email', title: 'Email Address', type: 'string', format: 'email', options: '', rows: '', columns: '', minLabel: '', maxLabel: '', required: true, stepGroup: '', hidden: false, fileAccept: '', fileMaxCount: '', hasDependsOn: false, dependsOnField: '', dependsOnValue: '', dependsOnOperator: 'eq' }
        ]);
    }, [form]);

    const addField = () => setFields([...fields, { key: '', title: '', type: 'string', format: 'text', options: '', rows: '', columns: '', minLabel: '', maxLabel: '', required: false, stepGroup: '', hidden: false, fileAccept: '', fileMaxCount: '', hasDependsOn: false, dependsOnField: '', dependsOnValue: '', dependsOnOperator: 'eq' }]);
    const removeField = (idx) => setFields(fields.filter((_, i) => i !== idx));
    const updateField = (idx, patch) => setFields(fields.map((f, i) => i === idx ? { ...f, ...patch } : f));

    const addStepGroup = () => setStepGroups([...stepGroups, { id: `step_${stepGroups.length + 1}`, label: `Step ${stepGroups.length + 1}`, icon: 'arrow-right' }]);
    const removeStepGroup = (idx) => setStepGroups(stepGroups.filter((_, i) => i !== idx));
    const updateStepGroup = (idx, patch) => setStepGroups(stepGroups.map((g, i) => i === idx ? { ...g, ...patch } : g));

    const handleSaveForm = async (e) => {
        e.preventDefault();
        
        if (!title.trim() || !slug.trim()) {
            setModal({ isOpen: true, title: 'Validation Error', message: 'Title and Slug are required.', type: 'alert', variant: 'warning' });
            return;
        }

        const validKeys = fields.every(f => /^[a-zA-Z0-9_]+$/.test(f.key));
        if (!validKeys) {
            setModal({ isOpen: true, title: 'Validation Error', message: 'All fields must have a valid Field Key (letters, numbers, underscores only).', type: 'alert', variant: 'warning' });
            return;
        }

        setSaving(true);
        try {
            const properties = {};
            const required = [];

            fields.forEach(f => {
                const key = f.key.trim();
                const prop = { title: f.title.trim() || key, type: f.type };

                // Hidden field
                if (f.hidden) {
                    prop['ui:widget'] = 'hidden';
                } else if (['rating', 'range', 'linear_scale'].includes(f.format)) {
                    prop.type = 'integer';
                    prop['ui:widget'] = f.format;
                    prop.minimum = 1;
                    prop.maximum = f.format === 'rating' ? 5 : 10;
                    if (f.format === 'linear_scale') {
                        prop['ui:minLabel'] = f.minLabel;
                        prop['ui:maxLabel'] = f.maxLabel;
                    }
                } else if (f.format === 'toggle') {
                    prop.type = 'boolean';
                    prop['ui:widget'] = 'toggle';
                } else if (f.format === 'checkbox') {
                    prop.type = 'array';
                    prop['ui:widget'] = 'checkbox';
                    prop.items = { type: 'string', enum: f.options ? [...new Set(f.options.split(',').map(o => o.trim()).filter(Boolean))] : [] };
                } else if (['multiple_choice_grid', 'checkbox_grid'].includes(f.format)) {
                    prop.type = 'object';
                    prop['ui:widget'] = f.format;
                    prop['ui:rows'] = f.rows ? f.rows.split(',').map(o => o.trim()).filter(Boolean) : [];
                    prop['ui:columns'] = f.columns ? f.columns.split(',').map(o => o.trim()).filter(Boolean) : [];
                } else if (f.format === 'file') {
                    prop.format = 'file';
                    prop['ui:widget'] = 'file';
                    if (f.fileAccept?.trim()) prop['ui:accept'] = f.fileAccept.trim();
                    if (f.fileMaxCount) prop['ui:maxFiles'] = Number(f.fileMaxCount) || 5;
                } else if (f.format !== 'text') {
                    prop.format = f.format;
                    if (['radio', 'select'].includes(f.format)) {
                        prop['ui:widget'] = f.format;
                    }
                }

                if (['select', 'radio'].includes(f.format) && f.options?.trim()) {
                    prop.enum = [...new Set(f.options.split(',').map(o => o.trim()).filter(Boolean))];
                }

                // Conditional visibility
                if (f.hasDependsOn && f.dependsOnField?.trim()) {
                    prop['ui:dependsOn'] = {
                        field: f.dependsOnField.trim(),
                        value: f.dependsOnValue,
                        operator: f.dependsOnOperator || 'eq'
                    };
                }

                if (layout === 'wizard' && f.stepGroup) {
                    prop['ui:group'] = f.stepGroup;
                }

                properties[key] = prop;
                if (f.required) required.push(key);
            });

            const settings = {
                allow_attachments: allowAttachments,
                description: description.trim(),
                layout,
                step_groups: layout === 'wizard' ? stepGroups : [],
                field_mapping: { donorEmail: emailFieldKey.trim() || 'email' },
                max_files: Number(maxFiles) || 5,
                max_file_size_mb: Number(maxFileSizeMB) || 10,
                accepted_file_types: acceptedFileTypes.trim()
            };

            if (showInfoBlock && (infoHeader.trim() || infoDescription.trim())) {
                settings.info_block = {
                    header: infoHeader.trim(),
                    description: infoDescription.trim()
                };
            }

            const payload = {
                title: title.trim(),
                slug: slug.trim(),
                type: 'custom',
                otp,
                schema_data: { type: "object", properties, required },
                settings
            };

            const res = await apiFetch(`/api/v1/forms/admin/definitions/${form.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || 'Failed to save form definition.');
            }

            setModal({ isOpen: true, title: 'Success', message: 'Form definition saved successfully!', type: 'alert', variant: 'info' });
            fetchDefinition();
        } catch (err) {
            setModal({ isOpen: true, title: 'Save Error', message: err.message, type: 'alert', variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSaveForm} className="space-y-8 animate-in fade-in duration-500">

            {/* ── SECTION: General Settings ── */}
            <div className="border border-zinc-200 rounded-xl bg-white p-6 shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-widest border-b border-zinc-100 pb-3">General Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Form Title</label>
                        <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black" />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">URL Slug</label>
                        <input type="text" disabled value={slug} className="w-full bg-zinc-50 border border-gray-300 text-zinc-400 rounded-md py-2 px-3 text-sm" />
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-1">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Form Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none" placeholder="Short subtitle shown to users below the title." />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Layout Style</label>
                        <select value={layout} onChange={e => setLayout(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black">
                            <option value="single_column">Single Column Layout</option>
                            <option value="wizard">Multi-step Wizard Layout</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Email Field Key</label>
                        <input type="text" value={emailFieldKey} onChange={e => setEmailFieldKey(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="email" />
                        <p className="text-[9px] text-zinc-400 mt-0.5">Which field key contains the user's email (for OTP and notifications).</p>
                    </div>
                </div>
            </div>

            {/* ── SECTION: Toggleable Features ── */}
            <div className="border border-zinc-200 rounded-xl bg-white p-6 shadow-sm space-y-5">
                <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-widest border-b border-zinc-100 pb-3">Features & Toggles</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <label className="flex items-start gap-3 p-4 border border-zinc-200 rounded-lg hover:border-zinc-400 transition-colors cursor-pointer">
                        <input type="checkbox" checked={otp} onChange={e => setOtp(e.target.checked)} className="w-4 h-4 mt-0.5 border-gray-300 text-black rounded focus:ring-black" />
                        <div>
                            <span className="text-xs font-bold text-zinc-800 block">Require Email OTP</span>
                            <span className="text-[10px] text-zinc-400 leading-tight">Users must verify their email with a one-time code before submitting.</span>
                        </div>
                    </label>
                    <label className="flex items-start gap-3 p-4 border border-zinc-200 rounded-lg hover:border-zinc-400 transition-colors cursor-pointer">
                        <input type="checkbox" checked={allowAttachments} onChange={e => setAllowAttachments(e.target.checked)} className="w-4 h-4 mt-0.5 border-gray-300 text-black rounded focus:ring-black" />
                        <div>
                            <span className="text-xs font-bold text-zinc-800 block">Allow File Attachments</span>
                            <span className="text-[10px] text-zinc-400 leading-tight">Adds a dedicated media upload step to the form (separate from per-field file inputs).</span>
                        </div>
                    </label>
                    <label className="flex items-start gap-3 p-4 border border-zinc-200 rounded-lg hover:border-zinc-400 transition-colors cursor-pointer">
                        <input type="checkbox" checked={showInfoBlock} onChange={e => setShowInfoBlock(e.target.checked)} className="w-4 h-4 mt-0.5 border-gray-300 text-black rounded focus:ring-black" />
                        <div>
                            <span className="text-xs font-bold text-zinc-800 block">Show Intro Notice</span>
                            <span className="text-[10px] text-zinc-400 leading-tight">Displays a header and description block before the form fields.</span>
                        </div>
                    </label>
                </div>

                {/* Info Block Configuration */}
                {showInfoBlock && (
                    <div className="border border-dashed border-zinc-300 rounded-lg p-5 bg-zinc-50/50 space-y-3 mt-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Intro Notice Content</p>
                        <input type="text" value={infoHeader} onChange={e => setInfoHeader(e.target.value)} placeholder="Notice header (e.g. Important Information)" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                        <textarea value={infoDescription} onChange={e => setInfoDescription(e.target.value)} placeholder="Notice description body text..." rows={3} className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none resize-none" />
                    </div>
                )}

                {/* File Attachment Settings */}
                {allowAttachments && (
                    <div className="border border-dashed border-zinc-300 rounded-lg p-5 bg-zinc-50/50 space-y-3 mt-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">File Upload Settings (Global)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase">Max Files</label>
                                <input type="number" min="1" max="20" value={maxFiles} onChange={e => setMaxFiles(e.target.value)} className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase">Max Size per File (MB)</label>
                                <input type="number" min="1" max="100" value={maxFileSizeMB} onChange={e => setMaxFileSizeMB(e.target.value)} className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase">Accepted Types</label>
                                <input type="text" value={acceptedFileTypes} onChange={e => setAcceptedFileTypes(e.target.value)} placeholder=".pdf, .jpg, .png, .docx" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                <p className="text-[9px] text-zinc-400">Comma-separated extensions. Leave empty to allow all.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── SECTION: Wizard Step Groups ── */}
            {layout === 'wizard' && (
                <div className="border border-zinc-200 rounded-xl bg-white p-6 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                        <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-widest">Wizard Step Groups</h3>
                        <button type="button" onClick={addStepGroup} className="text-xs font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Step</button>
                    </div>
                    {stepGroups.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic">No steps added yet. Add at least one step group.</p>
                    ) : (
                        <div className="space-y-3">
                            {stepGroups.map((group, gIdx) => (
                                <div key={gIdx} className="flex gap-4 items-center bg-zinc-50 p-3 border border-zinc-200 rounded-md">
                                    <div className="flex-1 grid grid-cols-3 gap-3">
                                        <input type="text" required value={group.id} onChange={e => updateStepGroup(gIdx, { id: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} placeholder="step_id" className="border border-gray-300 rounded px-2.5 py-1 text-xs" />
                                        <input type="text" required value={group.label} onChange={e => updateStepGroup(gIdx, { label: e.target.value })} placeholder="Step Label" className="border border-gray-300 rounded px-2.5 py-1 text-xs col-span-2" />
                                    </div>
                                    <button type="button" onClick={() => removeStepGroup(gIdx)} className="text-zinc-400 hover:text-red-500">✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── SECTION: Schema Fields ── */}
            <div className="border border-zinc-200 rounded-xl bg-white p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                    <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-widest">Form Schema Fields</h3>
                    <button type="button" onClick={addField} className="px-3 py-1.5 border border-black text-black text-xs font-bold uppercase tracking-wider rounded hover:bg-zinc-50 transition-colors flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Add Field
                    </button>
                </div>

                <div className="space-y-4">
                    {fields.map((f, idx) => (
                        <div key={idx} className={`flex flex-col gap-3 border rounded-lg p-5 relative group transition-colors ${f.hidden ? 'bg-zinc-100/80 border-zinc-300 border-dashed' : 'bg-zinc-50/50 border-zinc-200'}`}>
                            <button type="button" onClick={() => removeField(idx)} className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 transition-colors">✕</button>

                            {/* Row 1: Core field config */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Field ID Key</label>
                                    <input type="text" required value={f.key} onChange={e => updateField(idx, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} placeholder="phone_number" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Field Label</label>
                                    <input type="text" required value={f.title} onChange={e => updateField(idx, { title: e.target.value })} placeholder="Phone Number" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Input Format</label>
                                    <select value={f.format} onChange={e => {
                                        const format = e.target.value;
                                        let type = 'string';
                                        if (format === 'rating') type = 'integer';
                                        updateField(idx, { format, type });
                                    }} className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none">
                                        <option value="text">Single Line Text</option>
                                        <option value="textarea">Multi-line Text</option>
                                        <option value="email">Email Input</option>
                                        <option value="date">Date Input</option>
                                        <option value="time">Time Input</option>
                                        <option value="file">File Upload</option>
                                        <option value="select">Dropdown Select</option>
                                        <option value="radio">Multiple Choice (Radio)</option>
                                        <option value="checkbox">Checkboxes</option>
                                        <option value="toggle">Toggle / Switch</option>
                                        <option value="rating">Rating (1-5 Stars)</option>
                                        <option value="range">Slider Range (1-10)</option>
                                        <option value="linear_scale">Linear Scale</option>
                                        <option value="multiple_choice_grid">Multiple Choice Grid</option>
                                        <option value="checkbox_grid">Checkbox Grid</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-4 py-4">
                                    <label className="flex items-center cursor-pointer">
                                        <input type="checkbox" checked={f.required} onChange={e => updateField(idx, { required: e.target.checked })} className="w-3.5 h-3.5 border-gray-300 text-black rounded focus:ring-black" />
                                        <span className="ml-2 text-[10px] font-semibold text-zinc-600">Required</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer" title="Hide this field from users (useful for internal programmatic state)">
                                        <input type="checkbox" checked={f.hidden} onChange={e => updateField(idx, { hidden: e.target.checked })} className="w-3.5 h-3.5 border-gray-300 text-black rounded focus:ring-black" />
                                        <span className="ml-2 text-[10px] font-semibold text-zinc-600">Hidden (Internal)</span>
                                    </label>
                                </div>
                                {/* Conditional visibility toggle */}
                                <div className="flex items-center py-4">
                                    <label className="flex items-center cursor-pointer">
                                        <input type="checkbox" checked={f.hasDependsOn} onChange={e => updateField(idx, { hasDependsOn: e.target.checked })} className="w-3.5 h-3.5 border-gray-300 text-black rounded focus:ring-black" />
                                        <span className="ml-2 text-[10px] font-semibold text-zinc-600">Conditional</span>
                                    </label>
                                </div>
                            </div>

                            {/* File Upload Config */}
                            {f.format === 'file' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl border-t border-zinc-200 pt-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Accepted File Types</label>
                                        <input type="text" value={f.fileAccept} onChange={e => updateField(idx, { fileAccept: e.target.value })} placeholder=".pdf, .jpg, .png" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                        <p className="text-[9px] text-zinc-400">Comma-separated. Leave empty for all types.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Max File Count</label>
                                        <input type="number" min="1" max="20" value={f.fileMaxCount} onChange={e => updateField(idx, { fileMaxCount: e.target.value })} placeholder="5" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                    </div>
                                </div>
                            )}

                            {/* Conditional Visibility Config */}
                            {f.hasDependsOn && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl border-t border-zinc-200 pt-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Depends on Field</label>
                                        <select value={f.dependsOnField} onChange={e => updateField(idx, { dependsOnField: e.target.value })} className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none">
                                            <option value="">-- Select field --</option>
                                            {fields.filter((_, i) => i !== idx).map(other => (
                                                <option key={other.key} value={other.key}>{other.title || other.key}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Operator</label>
                                        <select value={f.dependsOnOperator} onChange={e => updateField(idx, { dependsOnOperator: e.target.value })} className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none">
                                            <option value="eq">Equals</option>
                                            <option value="neq">Not Equals</option>
                                            <option value="not_empty">Not Empty</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Value</label>
                                        <input type="text" value={f.dependsOnValue} onChange={e => updateField(idx, { dependsOnValue: e.target.value })} placeholder="Expected value" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                        <p className="text-[9px] text-zinc-400">Not needed for "Not Empty" operator.</p>
                                    </div>
                                </div>
                            )}

                            {/* Select/Radio/Checkbox Options */}
                            {['select', 'radio', 'checkbox'].includes(f.format) && (
                                <div className="space-y-1 w-full max-w-xl">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Options (comma-separated)</label>
                                    <input type="text" required value={f.options} onChange={e => updateField(idx, { options: e.target.value })} placeholder="Website, Museum, Staff" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                </div>
                            )}

                            {/* Grid Options */}
                            {['multiple_choice_grid', 'checkbox_grid'].includes(f.format) && (
                                <div className="grid grid-cols-2 gap-4 w-full max-w-xl">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Rows (comma-separated)</label>
                                        <input type="text" required value={f.rows} onChange={e => updateField(idx, { rows: e.target.value })} placeholder="Quality, Speed" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Columns (comma-separated)</label>
                                        <input type="text" required value={f.columns} onChange={e => updateField(idx, { columns: e.target.value })} placeholder="Poor, Fair, Good" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                    </div>
                                </div>
                            )}

                            {/* Linear Scale Labels */}
                            {f.format === 'linear_scale' && (
                                <div className="grid grid-cols-2 gap-4 w-full max-w-xl">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Min Label</label>
                                        <input type="text" value={f.minLabel} onChange={e => updateField(idx, { minLabel: e.target.value })} placeholder="Not Satisfied" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Max Label</label>
                                        <input type="text" value={f.maxLabel} onChange={e => updateField(idx, { maxLabel: e.target.value })} placeholder="Very Satisfied" className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                    </div>
                                </div>
                            )}

                            {/* Wizard Step Assignment */}
                            {layout === 'wizard' && stepGroups.length > 0 && (
                                <div className="space-y-1 w-full max-w-xs border-t border-zinc-200 pt-3">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Assign to Wizard Step</label>
                                    <select value={f.stepGroup} onChange={e => updateField(idx, { stepGroup: e.target.value })} className="w-full bg-white border border-gray-300 rounded py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none">
                                        <option value="">-- No step assigned --</option>
                                        {stepGroups.map(g => <option key={g.id} value={g.id}>{g.label} ({g.id})</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Save Button ── */}
            <div className="flex justify-end gap-3 border-t border-zinc-100 pt-6">
                <button type="submit" disabled={saving} className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-md border border-black hover:bg-zinc-800 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Form Definition'}
                </button>
            </div>
        </form>
    );
}

