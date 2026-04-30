import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';

// --- Theme Status Colors ---
const STATUS_STYLES = {
    pending_approval: 'text-[#A68A27] bg-[#D4AF37]/10 border-[#D4AF37]/30',
    in_research: 'text-blue-700 bg-blue-50 border-blue-200',
    finalized: 'text-black bg-zinc-200 border-black',
    archived: 'text-zinc-500 bg-white border-zinc-200'
};

export default function Accessions() {
    const { apiFetch } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const { events } = useSSE('accessions');
    
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archive'
    const [accessions, setAccessions] = useState([]);
    const [archived, setArchived] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Research Form State (Added Tags back)
    const [research, setResearch] = useState({ dimensions: '', materials: '', research_notes: '', historical_significance: '', tags: '' });
    const [customData, setCustomData] = useState([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [accRes, archRes] = await Promise.all([
                apiFetch('/api/v1/acquisitions/accessions?expand=intake_id'),
                apiFetch('/api/v1/acquisitions/inventory/archive?expand=accession_id.intake_id')
            ]);
            const accData = await accRes.json();
            const archData = await archRes.json();

            if (accData.status === 'success') {
                const enrichedItems = await Promise.all(accData.data.items.map(async (item) => {
                    try {
                        const mRes = await apiFetch(`/api/v1/media/accession/${item.id}`);
                        const mData = await mRes.json();
                        // Restored exact PocketBase relation mapping
                        return { ...item, expand: { ...item.expand, media_attachments_via_entity_id: mData.data?.items || [] } };
                    } catch (e) { return item; }
                }));
                setAccessions(enrichedItems);
            }

            if (archData.status === 'success') {
                setArchived(archData.data.items);
            }
        } catch (err) {
            console.error("Failed to fetch accession data", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (events.length > 0) fetchData();
    }, [events, fetchData]);

    // Handle initial selection from URL params
    useEffect(() => {
        const id = searchParams.get('id');
        if (id && accessions.length > 0) {
            const item = accessions.find(i => i.id === id);
            if (item) {
                setActiveTab('active');
                setSelected(item);
            }
        }
    }, [searchParams, accessions]);

    // Sync form state when a record is selected
    useEffect(() => {
        if (selected && activeTab === 'active') {
            setResearch({
                dimensions: selected.dimensions || '',
                materials: selected.materials || '',
                research_notes: selected.research_notes || '',
                historical_significance: selected.historical_significance || '',
                tags: selected.tags || ''
            });
            const extra = selected.research_data || {};
            setCustomData(Object.entries(extra).map(([key, value]) => ({ key, value })));
        }
    }, [selected, activeTab]);

    const handleAction = async (accessionId, action, body = {}) => {
        setActionLoading(true);
        try {
            const endpoint = action === 'approve' 
                ? `/api/v1/acquisitions/accessions/${accessionId}/approve`
                : `/api/v1/acquisitions/inventory/from-accession/${accessionId}`;

            const res = await apiFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: Object.keys(body).length ? JSON.stringify(body) : undefined
            });

            if (res.ok) {
                fetchData();
                setSelected(null); // Clear selection to refresh view
            } else {
                const json = await res.json();
                alert(json.error || 'Action failed.');
            }
        } catch (err) {
            alert('Request failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleResearchUpdate = async (e) => {
        e.preventDefault();
        setActionLoading(true);

        const researchDataObj = {};
        customData.forEach(item => {
            if (item.key.trim()) researchDataObj[item.key.trim()] = item.value;
        });

        try {
            const res = await apiFetch(`/api/v1/acquisitions/accessions/${selected.id}/research`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...research, research_data: researchDataObj })
            });
            if (res.ok) {
                alert('Research data saved.');
                fetchData();
            } else {
                alert('Failed to save research.');
            }
        } catch (err) {
            alert('Update failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleFileUpload = async (e, type) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        setActionLoading(true);
        try {
            if (type === 'moa') {
                const formData = new FormData();
                formData.append('files', files[0]);
                await apiFetch(`/api/v1/acquisitions/accessions/${selected.id}/upload-moa`, { method: 'POST', body: formData });
            } else if (type === 'media') {
                const formData = new FormData();
                files.forEach(f => formData.append('files', f));
                formData.append('entity_type', 'accession');
                formData.append('entity_id', selected.id);
                const uploadRes = await apiFetch('/api/v1/media/upload', { method: 'POST', body: formData });
                
                if(uploadRes.ok) {
                    // Update Local state instantly so photos show up without clearing selection
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
            fetchData();
        } catch (err) {
            alert('Upload failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const fetchArchiveMedia = async (item) => {
        if (!item || item.mediaFetched) return;
        try {
            const accId = item.expand?.accession_id?.id;
            if (!accId) return;
            const mRes = await apiFetch(`/api/v1/media/accession/${accId}`);
            const mData = await mRes.json();
            setSelected(prev => ({
                ...prev, mediaFetched: true,
                expand: {
                    ...prev.expand,
                    accession_id: {
                        ...prev.expand.accession_id,
                        expand: { ...prev.expand.accession_id.expand, media_attachments_via_entity_id: mData.data?.items || [] }
                    }
                }
            }));
        } catch (e) { console.error("Failed to fetch archive media"); }
    };

    const displayList = activeTab === 'active' ? accessions : archived;
    
    // Safely extract media array based on the active tab context
    const currentMedia = activeTab === 'active' 
        ? (selected?.expand?.media_attachments_via_entity_id || []) 
        : (selected?.expand?.accession_id?.expand?.media_attachments_via_entity_id || []);

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            
            {/* --- Header --- */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-zinc-200 pb-6">
                <div>
                    <h1 className="text-2xl font-serif text-black uppercase tracking-widest">Accessions</h1>
                    <p className="text-sm text-zinc-500 mt-1 font-light">Formal legal registration and artifact research.</p>
                </div>
            </header>

            {/* --- Main Workspace --- */}
            <div className="flex flex-col lg:flex-row gap-8 items-start">
                
                {/* LEFT: Queue (List) */}
                <div className="w-full lg:w-1/3 flex flex-col gap-4">
                    
                    {/* Tabs */}
                    <div className="flex border-b border-zinc-200">
                        <button 
                            onClick={() => { setActiveTab('active'); setSelected(null); }}
                            className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'active' ? 'border-[#D4AF37] text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                        >
                            Active Registry ({accessions.length})
                        </button>
                        <button 
                            onClick={() => { setActiveTab('archive'); setSelected(null); }}
                            className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'archive' ? 'border-[#D4AF37] text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                        >
                            Archive ({archived.length})
                        </button>
                    </div>

                    {/* List */}
                    <div className="border border-zinc-200 bg-white rounded-sm divide-y divide-zinc-100 h-[700px] overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-xs text-zinc-400 uppercase tracking-widest">Updating Registry...</div>
                        ) : displayList.length === 0 ? (
                            <div className="p-8 text-center text-xs text-zinc-400 uppercase tracking-widest">No records found.</div>
                        ) : (
                            displayList.map((item) => {
                                const isSelected = selected?.id === item.id;
                                const title = activeTab === 'active' 
                                    ? item.expand?.intake_id?.proposed_item_name 
                                    : item.expand?.accession_id?.expand?.intake_id?.proposed_item_name;
                                const number = activeTab === 'active' ? item.accession_number : item.catalog_number;
                                
                                return (
                                    <button 
                                        key={item.id} 
                                        onClick={() => {
                                            setSelected(item);
                                            if (activeTab === 'archive') fetchArchiveMedia(item);
                                        }}
                                        className={`w-full p-4 text-left transition-colors flex flex-col gap-2 border-l-2 ${isSelected ? 'bg-zinc-50 border-[#D4AF37]' : 'bg-white border-transparent hover:bg-zinc-50'}`}
                                    >
                                        <div className="flex justify-between items-start w-full">
                                            <div className="font-bold text-sm text-black line-clamp-1 pr-4">
                                                {title || 'Unnamed Artifact'}
                                            </div>
                                            <span className={`flex-shrink-0 px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-widest border ${activeTab === 'active' ? STATUS_STYLES[item.status] : STATUS_STYLES.archived}`}>
                                                {activeTab === 'active' ? item.status.replace(/_/g, ' ') : 'Archived'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-zinc-500 font-mono">
                                            REF: {number}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT: Detail View (Reading Room) */}
                <div className="w-full lg:w-2/3">
                    {!selected ? (
                        <div className="h-[700px] border border-zinc-200 bg-zinc-50 flex items-center justify-center rounded-sm">
                            <p className="text-sm font-serif italic text-zinc-400">Select a record from the registry to view or edit.</p>
                        </div>
                    ) : (
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
                                
                                {/* Archived Warning */}
                                {activeTab === 'archive' && (
                                    <div className="bg-red-50 border border-red-200 p-4 rounded-sm">
                                        <h4 className="text-[10px] uppercase font-bold tracking-widest text-red-700 mb-1">Deaccession Summary</h4>
                                        <p className="text-sm font-serif italic text-red-900">"{selected.deaccession_reason || 'No specific reason provided.'}"</p>
                                    </div>
                                )}

                                {/* Legal Framework */}
                                <div>
                                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 mb-4 border-b border-zinc-100 pb-2">Legal Framework & Status</h4>
                                    <div className="grid grid-cols-2 gap-6 bg-zinc-50 p-4 border border-zinc-200 rounded-sm">
                                        <div>
                                            <span className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">Contract Type</span>
                                            <span className="text-sm text-black font-medium uppercase tracking-wider">
                                                {activeTab === 'active' ? selected.contract_type : selected.expand?.accession_id?.contract_type || 'N/A'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">Signed Legal Document</span>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-xs font-bold uppercase tracking-widest ${selected.signed_moa || (activeTab==='archive' && selected.expand?.accession_id?.signed_moa) ? 'text-green-600' : 'text-red-500'}`}>
                                                    {selected.signed_moa || (activeTab==='archive' && selected.expand?.accession_id?.signed_moa) ? 'Verified' : 'Missing'}
                                                </span>
                                                {activeTab === 'active' && !selected.signed_moa && (
                                                    <div className="relative">
                                                        <input type="file" onChange={(e) => handleFileUpload(e, 'moa')} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                        <button className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37] hover:text-black transition-colors">Upload MOA</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Curatorial Research (Editable in Active, Read-only in Archive) */}
                                <div>
                                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 mb-4 border-b border-zinc-100 pb-2">Curatorial Research</h4>
                                    {activeTab === 'active' ? (
                                        <form id="research-form" onSubmit={handleResearchUpdate} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">Dimensions</label>
                                                    <input type="text" value={research.dimensions} onChange={e => setResearch({...research, dimensions: e.target.value})} className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none" placeholder="e.g. 24cm x 15cm x 10cm" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">Materials</label>
                                                    <input type="text" value={research.materials} onChange={e => setResearch({...research, materials: e.target.value})} className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none" placeholder="e.g. Bronze, Gold leaf" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">Curatorial Tags</label>
                                                <input type="text" value={research.tags} onChange={e => setResearch({...research, tags: e.target.value})} className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none" placeholder="Comma separated (e.g. Pre-colonial, Ceramic, Ritual)" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">Historical Significance & Provenance</label>
                                                <textarea rows="4" value={research.historical_significance} onChange={e => setResearch({...research, historical_significance: e.target.value})} className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm font-serif focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none resize-none" placeholder="Provide detailed provenance..." />
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
                                        {currentMedia.map((m) => (
                                            (m.files || []).map((file, idx) => (
                                                <a 
                                                    key={`${m.id}-${idx}`} 
                                                    href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`}
                                                    target="_blank" rel="noreferrer"
                                                    className="aspect-square border border-zinc-200 rounded-sm overflow-hidden bg-zinc-50 group relative block"
                                                >
                                                    <img src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`} className={`w-full h-full object-cover transition-opacity ${activeTab==='archive' ? 'grayscale opacity-60' : 'group-hover:opacity-75'}`} alt="Archival Document" />
                                                    <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[8px] text-white font-mono truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">View Full Size</div>
                                                </a>
                                            ))
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
                                        <button 
                                            onClick={() => { const loc = prompt('Assign Storage Location (e.g. Vault A, Shelf 3):'); if (loc) handleAction(selected.id, 'finalize', { location: loc }); }} 
                                            disabled={actionLoading} 
                                            className="px-6 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm disabled:opacity-50"
                                        >
                                            Finalize to Permanent Inventory
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}