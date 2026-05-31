import { useState, useEffect } from 'react';
import FormRenderer from '../FormRenderer';

// --- Theme Status Colors ---
export const STATUS_STYLES = {
    pending_approval: 'text-[#A68A27] bg-[#D4AF37]/10 border-[#D4AF37]/30',
    in_research: 'text-blue-700 bg-blue-50 border-blue-200',
    finalized: 'text-black bg-zinc-200 border-black',
    archived: 'text-zinc-500 bg-white border-zinc-200'
};

export default function AccessionDetail({
    selected,
    activeTab,
    apiFetch,
    setSelected,
    handleAction,
    actionLoading,
    setModal,
    fetchData,
    locations,
    setShowFinalizeModal
}) {
    const [research, setResearch] = useState({
        dimensions: '',
        materials: '',
        research_notes: '',
        historical_significance: '',
        tags: '',
        research_completed: false,
        accession_number: ''
    });
    const [customData, setCustomData] = useState([]);
    const [activeDetailTab, setActiveDetailTab] = useState('research');
    const [conditionReports, setConditionReports] = useState([]);
    const [showHealthForm, setShowHealthForm] = useState(false);

    // Sync form state when a record is selected
    useEffect(() => {
        if (selected && activeTab === 'active') {
            setResearch({
                dimensions: selected.dimensions || '',
                materials: selected.materials || '',
                research_notes: selected.research_notes || '',
                historical_significance: selected.historical_significance || '',
                tags: selected.tags || '',
                research_completed: !!selected.research_completed,
                accession_number: selected.accession_number || ''
            });
            const extra = selected.research_data || {};
            setCustomData(Object.entries(extra).map(([key, value]) => ({ key, value })));
            
            // Fetch condition reports
            apiFetch(`/api/v1/acquisitions/accession/${selected.id}/condition-reports`)
                .then(r => r.json())
                .then(data => {
                    if (data.status === 'success') setConditionReports(data.data.items);
                })
                .catch(() => {});
        }
    }, [selected, activeTab, apiFetch]);

    if (!selected) {
        return (
            <div className="h-[700px] border border-zinc-200 bg-zinc-50 flex items-center justify-center rounded-sm">
                <p className="text-sm font-serif italic text-zinc-400">Select a record from the registry to view or edit.</p>
            </div>
        );
    }

    const currentMedia = activeTab === 'active' 
        ? (selected.expand?.media_attachments_via_entity_id || []) 
        : (selected.expand?.accession_id?.expand?.media_attachments_via_entity_id || []);

    const handleFileUpload = async (e, type) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        try {
            if (type === 'moa') {
                const formData = new FormData();
                formData.append('files', files[0]);
                const res = await apiFetch(`/api/v1/acquisitions/accessions/${selected.id}/upload-moa`, { method: 'POST', body: formData });
                if (res.ok) {
                    setModal({ isOpen: true, title: 'Verified', message: 'Signed MOA uploaded and verified.', type: 'alert', variant: 'success' });
                    const mRes = await apiFetch(`/api/v1/media/accession/${selected.id}`);
                    const mData = mRes.ok ? await mRes.json() : { data: { items: [] } };
                    
                    setSelected(prev => ({ 
                        ...prev, 
                        signed_moa: true,
                        expand: {
                            ...prev.expand,
                            media_attachments_via_entity_id: mData.data?.items || []
                        }
                    }));
                } else {
                    const json = await res.json();
                    setModal({ isOpen: true, title: 'Upload Failed', message: json.error || 'MOA upload failed.', type: 'alert', variant: 'error' });
                }
            } else if (type === 'media') {
                const formData = new FormData();
                files.forEach(f => formData.append('files', f));
                formData.append('entity_type', 'accession');
                formData.append('entity_id', selected.id);
                const uploadRes = await apiFetch('/api/v1/media/upload', { method: 'POST', body: formData });
                
                if (uploadRes.ok) {
                    const mRes = await apiFetch(`/api/v1/media/accession/${selected.id}`);
                    const mData = await mRes.json();
                    setSelected(prev => ({
                        ...prev, 
                        expand: {
                            ...prev.expand, 
                            media_attachments_via_entity_id: mData.data?.items || []
                        }
                    }));
                }
            }
            fetchData(true);
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Upload failed.', type: 'alert', variant: 'error' });
        }
    };

    const handleResearchSubmit = async (e) => {
        e.preventDefault();
        
        // Validate accession number format if it has changed and is manually inputted
        if (research.accession_number !== selected.accession_number) {
            const accNumRegex = /^\d{4}\.\d{3}\.\d{2}$/;
            if (!accNumRegex.test(research.accession_number)) {
                setModal({
                    isOpen: true,
                    title: 'Validation Error',
                    message: 'Accession number must match format YYYY.SEQ.BATCH (e.g., 2026.001.01)',
                    type: 'alert',
                    variant: 'error'
                });
                return;
            }
        }

        const researchDataObj = {};
        customData.forEach(item => {
            if (item.key.trim()) researchDataObj[item.key.trim()] = item.value;
        });

        try {
            const res = await apiFetch(`/api/v1/acquisitions/accessions/${selected.id}/research`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...research, 
                    research_data: researchDataObj 
                })
            });
            const json = await res.json();
            if (res.ok) {
                setModal({ isOpen: true, title: 'Success', message: 'Research data saved successfully.', type: 'alert', variant: 'success' });
                setSelected(prev => ({ ...prev, ...research, research_data: researchDataObj }));
                fetchData(true);
            } else {
                setModal({ isOpen: true, title: 'Failed', message: json.error || json.message || 'Failed to save research data.', type: 'alert', variant: 'error' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Update failed.', type: 'alert', variant: 'error' });
        }
    };

    return (
        <div className="border border-zinc-200 bg-white rounded-sm flex flex-col h-[700px] overflow-hidden">
            {/* Detail Header */}
            <div className="p-6 border-b border-zinc-200 bg-zinc-50">
                <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-widest border ${activeTab === 'active' ? STATUS_STYLES[selected.status] : STATUS_STYLES.archived}`}>
                        {activeTab === 'active' ? selected.status.replace(/_/g, ' ') : 'Deaccessioned Archive'}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-mono">
                        ID: {activeTab === 'active' ? selected.accession_number : selected.catalog_number}
                    </span>
                </div>
                <h2 className="text-2xl font-serif text-black uppercase tracking-wider leading-tight">
                    {activeTab === 'active' 
                        ? (selected.expand?.intake_id?.proposed_item_name || 'Unnamed Artifact')
                        : (selected.expand?.accession_id?.expand?.intake_id?.proposed_item_name || 'Archived Artifact')}
                </h2>
            </div>

            {/* Detail Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* Compliance Checklist */}
                {activeTab === 'active' && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-sm p-5 space-y-4">
                        <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 border-b border-zinc-200 pb-2 mb-3">Compliance Progress</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[10px] font-bold ${selected.signed_moa ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-zinc-300 text-zinc-300'}`}>
                                    {selected.signed_moa ? '✓' : '1'}
                                </div>
                                <span className={`text-[11px] font-bold uppercase tracking-wider ${selected.signed_moa ? 'text-black' : 'text-zinc-400'}`}>Signed MOA</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[10px] font-bold ${research.research_completed ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-zinc-300 text-zinc-300'}`}>
                                    {research.research_completed ? '✓' : '2'}
                                </div>
                                <span className={`text-[11px] font-bold uppercase tracking-wider ${research.research_completed ? 'text-black' : 'text-zinc-400'}`}>Research Data</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[10px] font-bold ${currentMedia.length > 0 ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-zinc-300 text-zinc-300'}`}>
                                    {currentMedia.length > 0 ? '✓' : '3'}
                                </div>
                                <span className={`text-[11px] font-bold uppercase tracking-wider ${currentMedia.length > 0 ? 'text-black' : 'text-zinc-400'}`}>Visual Doc.</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Archived Warning */}
                {activeTab === 'archive' && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-sm">
                        <h4 className="text-[10px] uppercase font-bold tracking-widest text-red-700 mb-1">Deaccession Summary</h4>
                        <p className="text-sm font-serif italic text-red-900">"{selected.deaccession_reason || 'No specific reason provided.'}"</p>
                    </div>
                )}

                {/* Legal Framework */}
                <div>
                    <div className="flex justify-between items-end mb-4 border-b border-zinc-100 pb-2">
                        <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Legal Framework & MOA</h4>
                        {activeTab === 'active' && !selected.signed_moa && (
                            <div className="relative">
                                <input type="file" onChange={(e) => handleFileUpload(e, 'moa')} className="absolute inset-0 opacity-0 cursor-pointer" />
                                <button className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37] hover:text-black transition-colors flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    Upload Signed MOA
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-6 bg-zinc-50 p-4 border border-zinc-200 rounded-sm">
                        <div>
                            <span className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">Contract Type</span>
                            <span className="text-sm text-black font-medium uppercase tracking-wider block">
                                {activeTab === 'active' ? (selected.contract_type || 'PENDING GENERATION').replace(/_/g, ' ') : (selected.expand?.accession_id?.contract_type || 'N/A').replace(/_/g, ' ')}
                            </span>
                            {((activeTab === 'active' ? selected.contract_type : selected.expand?.accession_id?.contract_type)?.toLowerCase() === 'loan') && (
                                <div className="text-xs text-amber-600 font-bold mt-1 uppercase tracking-wider">
                                    Loan Ends: {activeTab === 'active'
                                        ? (selected.expand?.intake_id?.loan_end_date ? new Date(selected.expand.intake_id.loan_end_date).toLocaleDateString() : 'No Limit')
                                        : (selected.expand?.accession_id?.expand?.intake_id?.loan_end_date ? new Date(selected.expand.accession_id.expand.intake_id.loan_end_date).toLocaleDateString() : 'No Limit')}
                                </div>
                            )}
                        </div>
                        <div>
                            <span className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">Signed Legal Document</span>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold uppercase tracking-widest ${selected.signed_moa || (activeTab==='archive' && selected.expand?.accession_id?.signed_moa) ? 'text-green-600' : 'text-red-500'}`}>
                                    {selected.signed_moa || (activeTab==='archive' && selected.expand?.accession_id?.signed_moa) ? 'Verified & Linked' : 'Awaiting Scan'}
                                </span>
                                {(selected.signed_moa || (activeTab==='archive' && selected.expand?.accession_id?.signed_moa)) ? (
                                    <a 
                                        href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/accession/${activeTab === 'active' ? selected.id : selected.expand?.accession_id?.id}/${currentMedia.find(m => m.context === 'Signed MOA Document')?.file_name}`}
                                        target="_blank" rel="noreferrer"
                                        className="px-2 py-1 bg-blue-50 text-[9px] uppercase font-bold tracking-widest text-blue-600 border border-blue-100 rounded-sm hover:bg-blue-100 transition-colors"
                                    >
                                        View Signed Document
                                    </a>
                                ) : (
                                    <a 
                                        href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/acquisitions/intakes/${selected.intake_id}/export-moa`}
                                        target="_blank" rel="noreferrer"
                                        className="px-2 py-1 bg-[#D4AF37]/10 text-[9px] uppercase font-bold tracking-widest text-[#A68A27] border border-[#D4AF37]/30 rounded-sm hover:bg-[#D4AF37]/20 transition-colors"
                                    >
                                        Export MOA for Printing
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Detail Tabs */}
                <div className="flex border-b border-zinc-200 -mx-6 px-6">
                    <button 
                        onClick={() => setActiveDetailTab('research')}
                        className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-colors border-b-2 mr-8 ${activeDetailTab === 'research' ? 'border-black text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                    >
                        Curatorial Research
                    </button>
                    <button 
                        onClick={() => setActiveDetailTab('health')}
                        className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-colors border-b-2 ${activeDetailTab === 'health' ? 'border-black text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                    >
                        Condition Reports ({conditionReports.length})
                    </button>
                </div>

                {activeDetailTab === 'research' ? (
                    <div className="animate-in fade-in duration-300">
                        <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 mb-4 border-b border-zinc-100 pb-2">Technical Documentation</h4>
                        {activeTab === 'active' ? (
                            <form id="research-form" onSubmit={handleResearchSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">Accession Number *</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={research.accession_number} 
                                            onChange={e => setResearch({...research, accession_number: e.target.value})} 
                                            className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none font-mono" 
                                            placeholder="YYYY.SEQ.BATCH (e.g. 2026.001.01)" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">Dimensions</label>
                                        <input type="text" value={research.dimensions} onChange={e => setResearch({...research, dimensions: e.target.value})} className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none" placeholder="e.g. 24cm x 15cm x 10cm" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">Materials</label>
                                        <input type="text" value={research.materials} onChange={e => setResearch({...research, materials: e.target.value})} className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none" placeholder="e.g. Bronze, Gold leaf" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">Curatorial Tags</label>
                                        <input type="text" value={research.tags} onChange={e => setResearch({...research, tags: e.target.value})} className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none" placeholder="Comma separated (e.g. Pre-colonial, Ceramic, Ritual)" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">Historical Significance & Provenance</label>
                                    <textarea rows="4" value={research.historical_significance} onChange={e => setResearch({...research, historical_significance: e.target.value})} className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm font-serif focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none resize-none" placeholder="Provide detailed provenance..." />
                                </div>
                                
                                <div className="flex items-center gap-3 bg-zinc-50 p-3 border border-zinc-200 rounded-sm">
                                    <input 
                                        type="checkbox" 
                                        id="research_completed" 
                                        checked={research.research_completed} 
                                        onChange={e => setResearch({...research, research_completed: e.target.checked})}
                                        className="w-4 h-4 accent-[#D4AF37]"
                                    />
                                    <label htmlFor="research_completed" className="text-[10px] uppercase font-bold text-black tracking-widest cursor-pointer">
                                        Mark Research as Completed
                                    </label>
                                </div>
                                
                                {/* Custom Metadata Fields */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-[10px] uppercase font-bold text-zinc-600 tracking-widest">Additional Metadata</label>
                                        <button type="button" onClick={() => setCustomData([...customData, { key: '', value: '' }])} className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37] hover:text-black transition-colors">+ Add Row</button>
                                    </div>
                                    <div className="space-y-2">
                                        {customData.map((field, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input type="text" value={field.key} onChange={e => { const n=[...customData]; n[idx].key=e.target.value; setCustomData(n); }} className="w-1/3 border border-zinc-300 rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-600 focus:border-[#D4AF37] outline-none" placeholder="PROPERTY" />
                                                <input type="text" value={field.value} onChange={e => { const n=[...customData]; n[idx].value=e.target.value; setCustomData(n); }} className="flex-1 border border-zinc-300 rounded-sm px-3 py-1.5 text-sm text-black focus:border-[#D4AF37] outline-none" placeholder="Value" />
                                                <button type="button" onClick={() => setCustomData(customData.filter((_, i) => i !== idx))} className="px-2 text-zinc-400 hover:text-red-500">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        ) : (
                            /* Read-only Archive View */
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">Dimensions</label>
                                        <div className="text-sm text-black">{selected.expand?.accession_id?.dimensions || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">Materials</label>
                                        <div className="text-sm text-black">{selected.expand?.accession_id?.materials || 'N/A'}</div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-2">Curatorial Tags</label>
                                    <div className="flex flex-wrap gap-2">
                                        {selected.expand?.accession_id?.tags ? (
                                            selected.expand.accession_id.tags.split(',').map((tag, i) => (
                                                <span key={i} className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded-sm text-[10px] uppercase tracking-widest border border-zinc-200">
                                                    {tag.trim()}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-sm text-black">N/A</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">Historical Significance</label>
                                    <div className="text-sm font-serif text-black leading-relaxed pl-4 border-l-2 border-zinc-200">
                                        {selected.expand?.accession_id?.historical_significance || 'No historical data recorded.'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Condition Reports Tab */
                    <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Health Registry</h4>
                            {activeTab === 'active' && (
                                <button 
                                    onClick={() => setShowHealthForm(true)}
                                    className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37] hover:text-black transition-colors"
                                >
                                    + New Report
                                </button>
                            )}
                        </div>

                        {showHealthForm && (
                            <div className="bg-zinc-50 border border-zinc-200 rounded-sm p-6 mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-[10px] font-bold uppercase text-zinc-400">Condition Assessment</span>
                                    <button onClick={() => setShowHealthForm(false)} className="text-xs text-zinc-400 hover:text-black">Cancel</button>
                                </div>
                                <FormRenderer 
                                    slug="artifact-health"
                                    hideHeader={true}
                                    compact={true}
                                    customFetch={apiFetch}
                                    prefillData={{ artifact_id: selected.id, entity_type: 'accession' }}
                                    onSuccess={() => { 
                                        setShowHealthForm(false); 
                                        apiFetch(`/api/v1/acquisitions/accession/${selected.id}/condition-reports`)
                                            .then(r => r.json())
                                            .then(data => { if (data.status === 'success') setConditionReports(data.data.items); });
                                    }}
                                />
                            </div>
                        )}

                        <div className="space-y-4">
                            {conditionReports.map((report, i) => (
                                <div key={i} className="p-4 border border-zinc-200 rounded-sm bg-zinc-50/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`px-2 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-widest border ${
                                            report.condition === 'Excellent' ? 'bg-green-50 text-green-700 border-green-200' :
                                            report.condition === 'Fair' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-red-50 text-red-700 border-red-200'
                                        }`}>
                                            {report.condition || 'Observation'}
                                        </span>
                                        <span className="text-[10px] font-mono text-zinc-400">{new Date(report.created).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs text-zinc-600 line-clamp-3">{report.notes}</p>
                                    <div className="mt-3 text-[9px] uppercase font-bold text-zinc-400">Reporter: {report.reporter_name || 'Staff'}</div>
                                </div>
                            ))}
                            {conditionReports.length === 0 && (
                                <div className="py-12 text-center text-xs text-zinc-400 italic">No condition reports yet.</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Visual Documentation */}
                <div>
                    <div className="flex justify-between items-center mb-4 border-b border-zinc-100 pb-2">
                        <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Visual Documentation</h4>
                        {activeTab === 'active' && (
                            <div className="relative">
                                <input type="file" multiple onChange={(e) => handleFileUpload(e, 'media')} className="absolute inset-0 opacity-0 cursor-pointer" />
                                <button className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37] hover:text-black transition-colors">+ Add Photos</button>
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                        {currentMedia.filter(m => m.context !== 'Signed MOA Document').map((m) => (
                            <a 
                                key={m.id} 
                                href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/accession/${activeTab === 'active' ? selected.id : selected.expand?.accession_id?.id}/${m.file_name}`}
                                target="_blank" rel="noreferrer"
                                className="aspect-square border border-zinc-200 rounded-sm overflow-hidden bg-zinc-50 group relative block"
                            >
                                <img 
                                    src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/accession/${activeTab === 'active' ? selected.id : selected.expand?.accession_id?.id}/${m.file_name}`} 
                                    className={`w-full h-full object-cover transition-opacity ${activeTab==='archive' ? 'grayscale opacity-60' : 'group-hover:opacity-75'}`} 
                                    alt="Archival Item" 
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[8px] text-white font-mono truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">View Full Size</div>
                            </a>
                        ))}
                    </div>
                </div>

            </div>

            {/* --- Footer Action Bar (Only for Active records) --- */}
            {activeTab === 'active' && (
                <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-3 items-center">
                    {actionLoading && <span className="text-xs text-zinc-400 uppercase tracking-widest mr-auto ml-2">Processing...</span>}
                    
                    <button form="research-form" type="submit" disabled={actionLoading} className="px-6 py-2.5 bg-white border border-zinc-300 text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors rounded-sm disabled:opacity-50">
                        Save Research
                    </button>

                    {selected.status === 'pending_approval' && (
                        <button onClick={() => handleAction(selected.id, 'approve')} disabled={actionLoading} className="px-6 py-2.5 bg-black text-[#D4AF37] text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm disabled:opacity-50">
                            Approve Accession
                        </button>
                    )}

                    {selected.status === 'in_research' && (
                        <div className="flex items-center gap-4">
                            {(!selected.signed_moa || !selected.research_completed) && (
                                <div className="text-[9px] uppercase font-bold text-red-500 tracking-widest text-right">
                                    {!selected.signed_moa && <div>• MOA Missing</div>}
                                    {!selected.research_completed && <div>• Research Incomplete</div>}
                                </div>
                            )}
                            <button 
                                onClick={() => setShowFinalizeModal(true)}
                                disabled={actionLoading || !selected.signed_moa || !selected.research_completed} 
                                className={`px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${(!selected.signed_moa || !selected.research_completed) ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-black text-white hover:bg-zinc-800'}`}
                            >
                                Finalize to Permanent Inventory
                            </button>
                        </div>
                    )}

                    {selected.status === 'finalized' && (
                        <button 
                            onClick={() => setModal({ isOpen: true, title: 'Reopen Record', message: 'Reopen this record for research updates?', type: 'confirm', onConfirm: () => handleAction(selected.id, 'rollback') })}
                            className="px-6 py-2.5 bg-white border border-zinc-300 text-zinc-600 text-xs font-bold uppercase tracking-widest hover:text-black hover:border-black transition-all rounded-sm"
                        >
                            Reopen for Research
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
