import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { Modal, DataTable } from '../../../components';
import { 
    Settings, Eye, Save, ClipboardList, AlertCircle, ArrowLeft,
    Copy, ExternalLink, Code, Plus, Trash2, CheckCircle, Download,
    ArrowUp, ArrowDown
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
                        href={`/forms/display/${formDef.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 border border-zinc-300 rounded-md text-sm font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
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
    const landingUrl = import.meta.env.VITE_LANDING_URL || `${window.location.protocol}//${window.location.hostname}${window.location.port ? (window.location.port === '5173' ? ':4321' : ':' + window.location.port) : ''}`;
    const publicUrl = `${landingUrl.replace(/\/$/, '')}/forms/display/${form.id}`;
    const embedUrl = `${window.location.origin}/forms/embed/${form.id}`;
    
    // Generate the dynamic embed code
    const iframeCode = `<iframe id="museo-form-${form.id}" src="${embedUrl}" width="100%" style="border:none; border-radius: 6px; overflow:hidden; transition: height 0.2s ease;" title="${form.title}" scrolling="no"></iframe>
<script>
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'form-resize') {
      var iframe = document.getElementById('museo-form-${form.id}');
      if (iframe) {
        iframe.style.height = event.data.height + 'px';
      }
    }
  });
</script>`;

    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedIframe, setCopiedIframe] = useState(false);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 ">
            <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Public Form URL</h3>
                <p className="text-sm text-gray-500 mb-4">Share this direct link with your audience to collect responses.</p>
                <div className="flex items-center gap-3">
                    <input 
                        type="text" 
                        readOnly 
                        value={publicUrl}
                        className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 text-sm px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(publicUrl);
                            setCopiedUrl(true);
                            setTimeout(() => setCopiedUrl(false), 2000);
                        }}
                        className="px-6 py-3 bg-black text-white rounded-md text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    >
                        {copiedUrl ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiedUrl ? 'Copied' : 'Copy'}
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Embed via iframe</h3>
                <p className="text-sm text-gray-500 mb-4">Copy and paste this HTML code into your website builder (WordPress, Webflow, Shopify, etc.) to embed the form directly. It will automatically resize to fit the form content.</p>
                <div className="flex items-start gap-3">
                    <textarea 
                        readOnly 
                        value={iframeCode}
                        rows={12} // Increased rows to show the full script
                        className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 text-sm font-mono px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-black resize-none whitespace-pre-wrap"
                    />
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(iframeCode);
                            setCopiedIframe(true);
                            setTimeout(() => setCopiedIframe(false), 2000);
                        }}
                        className="px-6 py-3 bg-black text-white rounded-md text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2"
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
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const [tableFilters, setTableFilters] = useState({ search: '', date: '' });
    const itemsPerPage = 10;

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

    useEffect(() => {
        setCurrentPage(1);
    }, [sortConfig, tableFilters]);

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

    // Client-side Filtering
    const filteredData = useMemo(() => {
        let result = [...submissions];
        if (tableFilters.search) {
            const q = tableFilters.search.toLowerCase();
            result = result.filter(item => {
                const emailMatch = (item.submitted_email || 'anonymous').toLowerCase().includes(q);
                const idMatch = (item.id || '').toLowerCase().includes(q);
                
                let subData = {};
                try {
                    subData = typeof item.data === 'string' ? JSON.parse(item.data) : (item.data || {});
                } catch (e) {
                    subData = item.data || {};
                }
                const dataMatch = Object.values(subData).some(val => 
                    String(val ?? '').toLowerCase().includes(q)
                );

                return emailMatch || idMatch || dataMatch;
            });
        }
        if (tableFilters.date) {
            const target = new Date(tableFilters.date).toDateString();
            result = result.filter(item => {
                const dateVal = item.created_at || item.created;
                return dateVal && new Date(dateVal).toDateString() === target;
            });
        }
        return result;
    }, [submissions, tableFilters]);

    // Client-side Sorting
    const sortedData = useMemo(() => {
        const items = [...filteredData];
        if (sortConfig?.key) {
            items.sort((a, b) => {
                let valA, valB;
                if (sortConfig.key === 'id' || sortConfig.key === 'submitted_email' || sortConfig.key === 'created_at') {
                    valA = a[sortConfig.key];
                    valB = b[sortConfig.key];
                    if (sortConfig.key === 'created_at') {
                        const da = a.created_at || a.created;
                        const db = b.created_at || b.created;
                        valA = da ? new Date(da).getTime() : 0;
                        valB = db ? new Date(db).getTime() : 0;
                    } else {
                        valA = valA ? String(valA).toLowerCase() : '';
                        valB = valB ? String(valB).toLowerCase() : '';
                    }
                } else {
                    let dataA = {}, dataB = {};
                    try { dataA = typeof a.data === 'string' ? JSON.parse(a.data) : (a.data || {}); } catch(e) {}
                    try { dataB = typeof b.data === 'string' ? JSON.parse(b.data) : (b.data || {}); } catch(e) {}
                    valA = dataA[sortConfig.key];
                    valB = dataB[sortConfig.key];
                    valA = valA !== undefined ? String(valA).toLowerCase() : '';
                    valB = valB !== undefined ? String(valB).toLowerCase() : '';
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            items.sort((a, b) => {
                const da = a.created_at || a.created ? new Date(a.created_at || a.created).getTime() : 0;
                const db = b.created_at || b.created ? new Date(b.created_at || b.created).getTime() : 0;
                return db - da;
            });
        }
        return items;
    }, [filteredData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(start, start + itemsPerPage);
    }, [sortedData, currentPage]);

    const handleQueryChange = useCallback((filters) => {
        setTableFilters(prev =>
            prev.search === filters.search && prev.date === filters.date ? prev : filters
        );
    }, []);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        else if (sortConfig.key === key && sortConfig.direction === 'desc') { direction = null; key = null; }
        setSortConfig({ key, direction });
    };

    const columns = useMemo(() => {
        const cols = [
            { key: 'id', label: 'Submission ID', render: (val) => <span className="font-mono text-xs text-gray-500">{val}</span> },
            { key: 'submitted_email', label: 'Email Address', render: (val) => val || 'anonymous', isBold: true },
            { key: 'created_at', label: 'Date Submitted', render: (val, row) => new Date(val || row.created).toLocaleString() }
        ];

        propertyKeys.forEach(key => {
            cols.push({
                key,
                label: schemaProperties[key]?.title || key,
                render: (_, row) => {
                    let subData = {};
                    try {
                        subData = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
                    } catch (e) {
                        subData = row.data || {};
                    }
                    const value = subData[key];
                    const displayVal = (typeof value === 'object' && value !== null) 
                        ? JSON.stringify(value) 
                        : String(value ?? '—');
                    return <span className="truncate max-w-[200px] block" title={displayVal}>{displayVal}</span>;
                }
            });
        });

        cols.push({
            key: 'action',
            label: 'Action',
            render: (_, row) => (
                <div className="text-right">
                    <a 
                        href={`/forms/submissions/${row.id}`}
                        className="inline-flex items-center justify-center p-2 bg-gray-100 text-gray-600 hover:bg-black hover:text-white rounded-md transition-colors"
                        title="View Full Submission"
                    >
                        <Eye className="w-4 h-4" />
                    </a>
                </div>
            )
        });

        return cols;
    }, [propertyKeys, schemaProperties]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-widest">Received Submissions ({submissions.length})</h3>
                <button 
                    onClick={handleExport}
                    disabled={submissions.length === 0}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-md text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="border border-gray-200 rounded-md bg-white p-16 text-center text-zinc-400 shadow-sm">
                    <ClipboardList className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                    <p className="text-sm font-medium text-gray-500">No submissions have been received yet for this form.</p>
                </div>
            ) : (
                <div className="border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm p-4">
                    <DataTable
                        columns={columns}
                        data={paginatedData}
                        onQueryChange={handleQueryChange}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        showExtraActions={false}
                        sortConfig={sortConfig}
                        onSort={requestSort}
                        isExpandable={false}
                        isLoading={loading}
                    />
                </div>
            )}
        </div>
    );
}

function FormBuilderTab({ form, fetchDefinition, apiFetch, setModal }) {
    const isReadOnly = form.type !== 'custom';
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
    const [activeFieldIndex, setActiveFieldIndex] = useState(0);

    useEffect(() => {
        const schema = form.schema_data || {};
        const props = schema.properties || {};
        const requiredFields = schema.required || [];

        const loadedFields = Object.entries(props).map(([key, value]) => {
            const format = value['ui:widget'] || value.format || (value.type === 'boolean' ? 'toggle' : 'text');
            const dep = value['ui:dependsOn'] || value['dependsOn'];
            return {
                key,
                title: value.title || key,
                description: value.description || '',
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
                fileAccept: value['ui:accept'] || '',
                fileMaxCount: value['ui:maxFiles'] || '',
                hasDependsOn: !!dep,
                dependsOnField: dep?.field || '',
                dependsOnValue: dep?.value || '',
                dependsOnOperator: dep?.operator || 'eq'
            };
        });

        setFields(loadedFields.length ? loadedFields : [
            { key: 'email', title: 'Email Address', description: '', type: 'string', format: 'email', options: '', rows: '', columns: '', minLabel: '', maxLabel: '', required: true, stepGroup: '', hidden: false, fileAccept: '', fileMaxCount: '', hasDependsOn: false, dependsOnField: '', dependsOnValue: '', dependsOnOperator: 'eq' }
        ]);
    }, [form]);

    const addField = () => {
        const newField = { key: '', title: '', description: '', type: 'string', format: 'text', options: '', rows: '', columns: '', minLabel: '', maxLabel: '', required: false, stepGroup: '', hidden: false, fileAccept: '', fileMaxCount: '', hasDependsOn: false, dependsOnField: '', dependsOnValue: '', dependsOnOperator: 'eq' };
        setFields([...fields, newField]);
        setActiveFieldIndex(fields.length);
    };

    const removeField = (idx) => {
        const newFields = fields.filter((_, i) => i !== idx);
        setFields(newFields);
        if (activeFieldIndex >= newFields.length) {
            setActiveFieldIndex(Math.max(0, newFields.length - 1));
        }
    };

    const updateField = (idx, patch) => setFields(fields.map((f, i) => i === idx ? { ...f, ...patch } : f));

    const addStepGroup = () => setStepGroups([...stepGroups, { id: `step_${stepGroups.length + 1}`, label: `Step ${stepGroups.length + 1}`, icon: 'arrow-right' }]);
    const removeStepGroup = (idx) => setStepGroups(stepGroups.filter((_, i) => i !== idx));
    const updateStepGroup = (idx, patch) => setStepGroups(stepGroups.map((g, i) => i === idx ? { ...g, ...patch } : g));

    const moveField = (index, direction) => {
        if (direction === 'up' && index > 0) {
            const newFields = [...fields];
            const temp = newFields[index];
            newFields[index] = newFields[index - 1];
            newFields[index - 1] = temp;
            setFields(newFields);
            setActiveFieldIndex(index - 1);
        } else if (direction === 'down' && index < fields.length - 1) {
            const newFields = [...fields];
            const temp = newFields[index];
            newFields[index] = newFields[index + 1];
            newFields[index + 1] = temp;
            setFields(newFields);
            setActiveFieldIndex(index + 1);
        }
    };

    const duplicateField = (index) => {
        const fieldToDuplicate = fields[index];
        const newFields = [...fields];
        let counter = 1;
        let newKey = `${fieldToDuplicate.key || 'field'}_copy`;
        while (newFields.some(f => f.key === newKey)) {
            newKey = `${fieldToDuplicate.key || 'field'}_copy_${counter}`;
            counter++;
        }
        const copied = {
            ...fieldToDuplicate,
            key: newKey,
            title: fieldToDuplicate.title ? `${fieldToDuplicate.title} (Copy)` : ''
        };
        newFields.splice(index + 1, 0, copied);
        setFields(newFields);
        setActiveFieldIndex(index + 1);
    };

    const handleSaveForm = async (e) => {
        e.preventDefault();
        
        if (!title.trim() || !slug.trim()) {
            setModal({ isOpen: true, title: 'Validation Error', message: 'Title and Slug are required.', type: 'alert', variant: 'warning' });
            return;
        }

        let currentFields = [...fields];
        let currentEmailKey = emailFieldKey.trim() || 'email';

        if (otp) {
            let emailField = currentFields.find(f => f.key === currentEmailKey);
            
            if (!emailField || emailField.format !== 'email') {
                const alternateEmailField = currentFields.find(f => f.format === 'email');
                if (alternateEmailField) {
                    currentEmailKey = alternateEmailField.key;
                    setEmailFieldKey(currentEmailKey);
                } else {
                    let newKey = 'email';
                    let counter = 1;
                    while (currentFields.some(f => f.key === newKey)) {
                        newKey = `email_${counter}`;
                        counter++;
                    }
                    currentEmailKey = newKey;
                    
                    emailField = {
                        key: currentEmailKey,
                        title: 'Email Address',
                        description: '',
                        type: 'string',
                        format: 'email',
                        options: '', rows: '', columns: '', minLabel: '', maxLabel: '',
                        required: true, stepGroup: '', hidden: false, fileAccept: '', fileMaxCount: '', hasDependsOn: false, dependsOnField: '', dependsOnValue: '', dependsOnOperator: 'eq'
                    };
                    currentFields.push(emailField);
                    setFields(currentFields);
                    setEmailFieldKey(currentEmailKey);
                }
            }
            
            const emailFieldIndex = currentFields.findIndex(f => f.key === currentEmailKey);
            if (emailFieldIndex !== -1 && !currentFields[emailFieldIndex].required) {
                currentFields[emailFieldIndex] = { ...currentFields[emailFieldIndex], required: true };
                setFields([...currentFields]);
            }
        }

        const validKeys = currentFields.every(f => /^[a-zA-Z0-9_]+$/.test(f.key));
        if (!validKeys) {
            setModal({ isOpen: true, title: 'Validation Error', message: 'All fields must have a valid Field Key (letters, numbers, underscores only).', type: 'alert', variant: 'warning' });
            return;
        }

        setSaving(true);
        try {
            const properties = {};
            const required = [];

            currentFields.forEach(f => {
                const key = f.key.trim();
                const prop = { 
                    title: f.title.trim(), 
                    type: f.type,
                    description: f.description?.trim() || ''
                };

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
                field_mapping: { donorEmail: currentEmailKey },
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
        <form onSubmit={handleSaveForm} className="max-w-3xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
            {isReadOnly && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-md p-4 flex items-start gap-3 shadow-sm">
                    <AlertCircle className="w-5 h-5 text-zinc-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 className="text-sm font-bold text-zinc-900">System Form (Read-Only)</h4>
                        <p className="text-xs text-zinc-650 mt-0.5 leading-relaxed font-normal">
                            This form is a system-defined type ({form.type}) and is read-only.
                            Any modifications can only be made by database administrators directly in the database.
                        </p>
                    </div>
                </div>
            )}

            {/* ── GOOGLE FORMS STYLE HEADER CARD ── */}
            <div className="bg-white border border-zinc-200/85 border-t-8 border-t-black rounded-md p-8 shadow-sm space-y-4">
                <input 
                    type="text" 
                    required 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    disabled={isReadOnly} 
                    className="w-full bg-white border-b border-zinc-200 hover:border-zinc-300 focus:border-black text-2xl font-serif font-bold py-2 focus:outline-none transition-colors" 
                    placeholder="Untitled Form"
                />
                <textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    disabled={isReadOnly} 
                    rows={2} 
                    className="w-full bg-white border-b border-zinc-100 hover:border-zinc-200 focus:border-black text-sm text-zinc-600 py-2 focus:outline-none resize-none transition-colors" 
                    placeholder="Form description" 
                />
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-[10px] text-zinc-400 font-mono">
                    <div>Slug: <span className="text-zinc-600">{slug}</span></div>
                </div>
            </div>

            {/* ── SETTINGS CARD ── */}
            <div className="bg-white border border-zinc-200/85 rounded-md p-6 shadow-sm space-y-5">
                <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-widest border-b border-zinc-100 pb-2 flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-zinc-500" /> Form Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Layout Style</label>
                        <select value={layout} onChange={e => setLayout(e.target.value)} disabled={isReadOnly} className="w-full bg-white border border-gray-300 rounded-md py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none">
                            <option value="single_column">Single Column Layout</option>
                            <option value="wizard">Multi-step Wizard Layout</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Email Field Key</label>
                        <input type="text" value={emailFieldKey} onChange={e => setEmailFieldKey(e.target.value)} disabled={isReadOnly} className="w-full bg-white border border-gray-300 rounded-md py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" placeholder="email" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <label className="flex items-start gap-2.5 p-3 border border-zinc-150 rounded-md hover:border-zinc-300 transition-colors cursor-pointer bg-zinc-50/50">
                        <input type="checkbox" checked={otp} onChange={e => setOtp(e.target.checked)} disabled={isReadOnly} className="w-3.5 h-3.5 mt-0.5 border-gray-300 text-black rounded-md focus:ring-black" />
                        <div>
                            <span className="text-[11px] font-bold text-zinc-700 block">Require OTP</span>
                            <span className="text-[9px] text-zinc-400 leading-tight block">Verify user emails.</span>
                        </div>
                    </label>
                    <label className="flex items-start gap-2.5 p-3 border border-zinc-150 rounded-md hover:border-zinc-300 transition-colors cursor-pointer bg-zinc-50/50">
                        <input type="checkbox" checked={allowAttachments} onChange={e => setAllowAttachments(e.target.checked)} disabled={isReadOnly} className="w-3.5 h-3.5 mt-0.5 border-gray-300 text-black rounded-md focus:ring-black" />
                        <div>
                            <span className="text-[11px] font-bold text-zinc-700 block">Global Attachments</span>
                            <span className="text-[9px] text-zinc-400 leading-tight block">Media upload section.</span>
                        </div>
                    </label>
                    <label className="flex items-start gap-2.5 p-3 border border-zinc-150 rounded-md hover:border-zinc-300 transition-colors cursor-pointer bg-zinc-50/50">
                        <input type="checkbox" checked={showInfoBlock} onChange={e => setShowInfoBlock(e.target.checked)} disabled={isReadOnly} className="w-3.5 h-3.5 mt-0.5 border-gray-300 text-black rounded-md focus:ring-black" />
                        <div>
                            <span className="text-[11px] font-bold text-zinc-700 block">Intro Notice</span>
                            <span className="text-[9px] text-zinc-400 leading-tight block">Notice block at start.</span>
                        </div>
                    </label>
                </div>

                {showInfoBlock && (
                    <div className="border border-dashed border-zinc-200 rounded-md p-4 bg-zinc-50/30 space-y-3">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Intro Notice Content</p>
                        <input type="text" value={infoHeader} onChange={e => setInfoHeader(e.target.value)} disabled={isReadOnly} placeholder="Notice header (e.g. Important Information)" className="w-full bg-white border border-gray-300 rounded-md py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                        <textarea value={infoDescription} onChange={e => setInfoDescription(e.target.value)} disabled={isReadOnly} placeholder="Notice description body text..." rows={2} className="w-full bg-white border border-gray-300 rounded-md py-1.5 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none resize-none" />
                    </div>
                )}

                {allowAttachments && (
                    <div className="border border-dashed border-zinc-200 rounded-md p-4 bg-zinc-50/30 space-y-3">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">File Upload Settings (Global)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-zinc-500 uppercase">Max Files</label>
                                <input type="number" min="1" max="20" value={maxFiles} onChange={e => setMaxFiles(e.target.value)} disabled={isReadOnly} className="w-full bg-white border border-gray-300 rounded-md py-1 px-2 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-zinc-500 uppercase">Max Size (MB)</label>
                                <input type="number" min="1" max="100" value={maxFileSizeMB} onChange={e => setMaxFileSizeMB(e.target.value)} disabled={isReadOnly} className="w-full bg-white border border-gray-300 rounded-md py-1 px-2 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-zinc-500 uppercase">Accepted Types</label>
                                <input type="text" value={acceptedFileTypes} onChange={e => setAcceptedFileTypes(e.target.value)} disabled={isReadOnly} placeholder=".pdf, .jpg, .png" className="w-full bg-white border border-gray-300 rounded-md py-1 px-2 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── SECTION: Wizard Step Groups ── */}
            {layout === 'wizard' && (
                <div className="border border-zinc-200/80 rounded-md bg-white p-6 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                        <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-widest">Wizard Steps</h3>
                        {!isReadOnly && (
                            <button type="button" onClick={addStepGroup} className="text-xs font-semibold text-zinc-800 hover:text-black flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Step</button>
                        )}
                    </div>
                    {stepGroups.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic">No steps added yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {stepGroups.map((group, gIdx) => (
                                <div key={gIdx} className="flex gap-4 items-center bg-zinc-50/50 p-2.5 border border-zinc-200 rounded-md">
                                    <div className="flex-1 grid grid-cols-3 gap-3">
                                        <input type="text" required value={group.id} onChange={e => updateStepGroup(gIdx, { id: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} disabled={isReadOnly} placeholder="step_id" className="border border-gray-300 rounded-md px-2.5 py-1 text-xs" />
                                        <input type="text" required value={group.label} onChange={e => updateStepGroup(gIdx, { label: e.target.value })} disabled={isReadOnly} placeholder="Step Label" className="border border-gray-300 rounded-md px-2.5 py-1 text-xs col-span-2" />
                                    </div>
                                    {!isReadOnly && (
                                        <button type="button" onClick={() => removeStepGroup(gIdx)} className="text-zinc-400 hover:text-red-500">✕</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── SCHEMA FIELDS LIST ── */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Questions ({fields.length})</h3>
                    {!isReadOnly && (
                        <button type="button" onClick={addField} className="px-3 py-1.5 border border-black text-black text-xs font-bold uppercase tracking-wider rounded-md hover:bg-zinc-50 transition-colors flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Add Question
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    {fields.map((f, idx) => {
                        const isActive = activeFieldIndex === idx;
                        
                        if (!isActive) {
                            return (
                                <div 
                                    key={idx} 
                                    onClick={() => setActiveFieldIndex(idx)}
                                    className={`bg-white border border-zinc-200 rounded-md p-5 hover:border-zinc-300 transition-all shadow-sm flex flex-col gap-2 ${
                                        f.hidden ? 'opacity-60 bg-zinc-50/30' : ''
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1">
                                            <div className="text-sm font-semibold text-zinc-800 flex items-center gap-1.5">
                                                {f.title || <span className="text-zinc-400 italic font-normal text-xs">(Empty Question Label)</span>}
                                                {f.required && <span className="text-red-500">*</span>}
                                                {f.hidden && <span className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-md font-mono">Hidden</span>}
                                            </div>
                                            {f.description && (
                                                <p className="text-xs text-zinc-400 leading-relaxed font-normal">{f.description}</p>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                            {f.format.replace('_', ' ')}
                                        </span>
                                    </div>
                                    
                                    <div className="pt-2 text-xs text-zinc-400">
                                        {['text', 'email', 'phone', 'date', 'time'].includes(f.format) && (
                                            <div className="border-b border-dashed border-zinc-200 pb-1 max-w-xs text-zinc-300 italic">Short answer text</div>
                                        )}
                                        {f.format === 'textarea' && (
                                            <div className="border-b border-dashed border-zinc-200 pb-4 max-w-md text-zinc-300 italic">Long answer text</div>
                                        )}
                                        {f.format === 'file' && (
                                            <div className="border border-dashed border-zinc-200 rounded-md p-4 flex items-center justify-center gap-2 max-w-xs bg-zinc-50/30">
                                                <span className="text-[10px] font-semibold text-zinc-400">DRAG & DROP OR UPLOAD FILE</span>
                                            </div>
                                        )}
                                        {['select', 'radio', 'checkbox'].includes(f.format) && (
                                            <div className="flex flex-col gap-1.5 pl-1">
                                                {(f.options ? f.options.split(',') : ['Option 1']).map((opt, oIdx) => (
                                                    <div key={oIdx} className="flex items-center gap-2">
                                                        <div className={`w-3.5 h-3.5 border border-zinc-300 ${f.format === 'radio' ? 'rounded-full' : f.format === 'select' ? 'hidden' : 'rounded-sm'}`} />
                                                        <span className="text-zinc-500">{opt.trim() || `Option ${oIdx + 1}`}</span>
                                                    </div>
                                                ))}
                                                {f.format === 'select' && (
                                                    <div className="border border-zinc-200 rounded-md px-2.5 py-1.5 max-w-xs flex justify-between items-center text-zinc-500 bg-white">
                                                        <span>Select option...</span>
                                                        <span>▼</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {f.format === 'toggle' && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-4 bg-zinc-200 rounded-full relative"><div className="w-3.5 h-3.5 bg-white rounded-full absolute left-0.5 top-0.5 border border-zinc-300" /></div>
                                                <span className="text-zinc-500">Toggle input preview</span>
                                            </div>
                                        )}
                                        {['rating', 'range', 'linear_scale'].includes(f.format) && (
                                            <div className="flex items-center gap-1.5 text-zinc-300">
                                                {f.format === 'rating' && Array.from({ length: 5 }).map((_, i) => <span key={i} className="text-lg">★</span>)}
                                                {f.format === 'range' && <div className="w-full max-w-xs h-1 bg-zinc-200 rounded relative"><div className="w-3.5 h-3.5 bg-zinc-400 rounded-full absolute top-1/2 -translate-y-1/2 left-1/4" /></div>}
                                                {f.format === 'linear_scale' && (
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] text-zinc-400 font-bold">{f.minLabel || 'Min'}</span>
                                                        <div className="flex gap-1.5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="w-3.5 h-3.5 rounded-full border border-zinc-300" />)}</div>
                                                        <span className="text-[10px] text-zinc-400 font-bold">{f.maxLabel || 'Max'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {['multiple_choice_grid', 'checkbox_grid'].includes(f.format) && (
                                            <div className="border border-zinc-200 rounded-md p-2 max-w-md bg-zinc-50/20">
                                                <table className="w-full text-left text-[10px] border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th className="border-b border-zinc-200 p-1"></th>
                                                            {(f.columns ? f.columns.split(',') : ['Col 1', 'Col 2']).map((c, i) => <th key={i} className="border-b border-zinc-200 p-1 text-center text-zinc-400">{c.trim()}</th>)}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(f.rows ? f.rows.split(',') : ['Row 1']).map((r, i) => (
                                                            <tr key={i}>
                                                                <td className="p-1 text-zinc-500 font-medium">{r.trim()}</td>
                                                                {(f.columns ? f.columns.split(',') : ['Col 1', 'Col 2']).map((_, ci) => (
                                                                    <td key={ci} className="p-1 text-center"><div className={`w-3.5 h-3.5 border border-zinc-300 mx-auto ${f.format === 'multiple_choice_grid' ? 'rounded-full' : 'rounded-sm'}`} /></td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div 
                                key={idx} 
                                className="bg-white border border-zinc-300 border-l-4 border-l-black rounded-md p-6 shadow-md flex flex-col gap-4 relative"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Question Title</label>
                                        <input 
                                            type="text" 
                                            value={f.title} 
                                            onChange={e => updateField(idx, { title: e.target.value })} 
                                            disabled={isReadOnly} 
                                            placeholder="Question/Label" 
                                            className="w-full bg-white border-b border-zinc-200 hover:border-zinc-300 focus:border-black py-1.5 text-sm font-semibold focus:outline-none transition-colors" 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Input Type</label>
                                        <select 
                                            value={f.format} 
                                            onChange={e => {
                                                const format = e.target.value;
                                                let type = 'string';
                                                if (format === 'rating') type = 'integer';
                                                updateField(idx, { format, type });
                                            }} 
                                            disabled={isReadOnly} 
                                            className="w-full bg-white border border-zinc-200 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-black focus:outline-none"
                                        >
                                            <option value="text">Single Line Text</option>
                                            <option value="textarea">Multi-line Text</option>
                                            <option value="email">Email Input</option>
                                            <option value="phone">Phone Number</option>
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
                                </div>

                                <div className="space-y-1 w-full">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Question Description (Optional)</label>
                                    <input 
                                        type="text" 
                                        value={f.description || ''} 
                                        onChange={e => updateField(idx, { description: e.target.value })} 
                                        disabled={isReadOnly} 
                                        placeholder="Description / subtitle help text" 
                                        className="w-full bg-white border-b border-zinc-150 hover:border-zinc-200 focus:border-black py-1.5 text-xs focus:outline-none transition-colors text-zinc-500 font-light" 
                                    />
                                </div>

                                {f.format === 'file' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl border-t border-zinc-100 pt-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Accepted File Types</label>
                                            <input type="text" value={f.fileAccept} onChange={e => updateField(idx, { fileAccept: e.target.value })} disabled={isReadOnly} placeholder=".pdf, .jpg, .png" className="w-full bg-white border border-gray-300 rounded-md py-1 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                            <p className="text-[9px] text-zinc-400">Comma-separated. Leave empty for all.</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Max File Count</label>
                                            <input type="number" min="1" max="20" value={f.fileMaxCount} onChange={e => updateField(idx, { fileMaxCount: e.target.value })} disabled={isReadOnly} placeholder="5" className="w-full bg-white border border-gray-300 rounded-md py-1 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                        </div>
                                    </div>
                                )}

                                {['select', 'radio', 'checkbox'].includes(f.format) && (
                                    <div className="space-y-1 w-full max-w-xl border-t border-zinc-100 pt-3">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Options (comma-separated)</label>
                                        <input type="text" required value={f.options} onChange={e => updateField(idx, { options: e.target.value })} disabled={isReadOnly} placeholder="Website, Museum, Staff" className="w-full bg-white border border-gray-300 rounded-md py-1 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                    </div>
                                )}

                                {['multiple_choice_grid', 'checkbox_grid'].includes(f.format) && (
                                    <div className="grid grid-cols-2 gap-4 w-full max-w-xl border-t border-zinc-100 pt-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Rows (comma-separated)</label>
                                            <input type="text" required value={f.rows} onChange={e => updateField(idx, { rows: e.target.value })} disabled={isReadOnly} placeholder="Quality, Speed" className="w-full bg-white border border-gray-300 rounded-md py-1 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Columns (comma-separated)</label>
                                            <input type="text" required value={f.columns} onChange={e => updateField(idx, { columns: e.target.value })} disabled={isReadOnly} placeholder="Poor, Fair, Good" className="w-full bg-white border border-gray-300 rounded-md py-1 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                        </div>
                                    </div>
                                )}

                                {f.format === 'linear_scale' && (
                                    <div className="grid grid-cols-2 gap-4 w-full max-w-xl border-t border-zinc-100 pt-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Min Label</label>
                                            <input type="text" value={f.minLabel} onChange={e => updateField(idx, { minLabel: e.target.value })} disabled={isReadOnly} placeholder="Not Satisfied" className="w-full bg-white border border-gray-300 rounded-md py-1 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Max Label</label>
                                            <input type="text" value={f.maxLabel} onChange={e => updateField(idx, { maxLabel: e.target.value })} disabled={isReadOnly} placeholder="Very Satisfied" className="w-full bg-white border border-gray-300 rounded-md py-1 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                        </div>
                                    </div>
                                )}

                                {f.hasDependsOn && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl border-t border-zinc-100 pt-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Depends on Field</label>
                                            <select value={f.dependsOnField} onChange={e => updateField(idx, { dependsOnField: e.target.value })} disabled={isReadOnly} className="w-full bg-white border border-gray-300 rounded-md py-1 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none">
                                                <option value="">-- Select field --</option>
                                                {fields.filter((_, i) => i !== idx).map(other => (
                                                    <option key={other.key} value={other.key}>{other.title || other.key}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Operator</label>
                                            <select value={f.dependsOnOperator} onChange={e => updateField(idx, { dependsOnOperator: e.target.value })} disabled={isReadOnly} className="w-full bg-white border border-gray-300 rounded-md py-1 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none">
                                                <option value="eq">Equals</option>
                                                <option value="neq">Not Equals</option>
                                                <option value="not_empty">Not Empty</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Value</label>
                                            <input type="text" value={f.dependsOnValue} onChange={e => updateField(idx, { dependsOnValue: e.target.value })} disabled={isReadOnly} placeholder="Expected value" className="w-full bg-white border border-gray-300 rounded-md py-1 px-2.5 text-xs focus:ring-1 focus:ring-black focus:outline-none" />
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-4 items-center border-t border-zinc-100 pt-3">
                                    <div className="space-y-1 max-w-[180px]">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Field ID Key</label>
                                        <input 
                                            type="text" 
                                            required 
                                            value={f.key} 
                                            onChange={e => updateField(idx, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} 
                                            disabled={isReadOnly} 
                                            placeholder="field_key" 
                                            className="w-full bg-white border border-gray-300 rounded-md py-1 px-2 text-xs focus:ring-1 focus:ring-black focus:outline-none" 
                                        />
                                    </div>

                                    {layout === 'wizard' && stepGroups.length > 0 && (
                                        <div className="space-y-1 max-w-xs">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Assign to Wizard Step</label>
                                            <select value={f.stepGroup} onChange={e => updateField(idx, { stepGroup: e.target.value })} disabled={isReadOnly} className="w-full bg-white border border-gray-300 rounded-md py-1 px-2 text-xs focus:ring-1 focus:ring-black focus:outline-none">
                                                <option value="">-- No step assigned --</option>
                                                {stepGroups.map(g => <option key={g.id} value={g.id}>{g.label} ({g.id})</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-zinc-100 pt-4 flex flex-wrap justify-between items-center gap-4">
                                    <div className="flex gap-4 items-center">
                                        <label className="flex items-center cursor-pointer">
                                            <input type="checkbox" checked={f.required} onChange={e => updateField(idx, { required: e.target.checked })} disabled={isReadOnly} className="w-3.5 h-3.5 border-gray-300 text-black rounded-md focus:ring-black" />
                                            <span className="ml-2 text-[10px] font-semibold text-zinc-600">Required</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input type="checkbox" checked={f.hidden} onChange={e => updateField(idx, { hidden: e.target.checked })} disabled={isReadOnly} className="w-3.5 h-3.5 border-gray-300 text-black rounded-md focus:ring-black" />
                                            <span className="ml-2 text-[10px] font-semibold text-zinc-600">Hidden (Internal)</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input type="checkbox" checked={f.hasDependsOn} onChange={e => updateField(idx, { hasDependsOn: e.target.checked })} disabled={isReadOnly} className="w-3.5 h-3.5 border-gray-300 text-black rounded-md focus:ring-black" />
                                            <span className="ml-2 text-[10px] font-semibold text-zinc-600">Conditional</span>
                                        </label>
                                    </div>
                                    
                                    {!isReadOnly && (
                                        <div className="flex items-center gap-3 text-zinc-400">
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); moveField(idx, 'up'); }} 
                                                disabled={idx === 0} 
                                                className="p-1 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Move Up"
                                            >
                                                <ArrowUp className="w-4 h-4" />
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); moveField(idx, 'down'); }} 
                                                disabled={idx === fields.length - 1} 
                                                className="p-1 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Move Down"
                                            >
                                                <ArrowDown className="w-4 h-4" />
                                            </button>
                                            <div className="w-px h-4 bg-zinc-200" />
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); duplicateField(idx); }} 
                                                className="p-1 hover:text-black"
                                                title="Duplicate Field"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); removeField(idx); }} 
                                                className="p-1 hover:text-red-500"
                                                title="Delete Field"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
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

