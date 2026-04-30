import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';

const ACCESSION_STATUS_COLORS = {
    pending_approval: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    in_research: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    finalized: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
};

export default function Accessions() {
    const { apiFetch } = useAuth();
    const { events } = useSSE('accessions');
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archive'
    const [accessions, setAccessions] = useState([]);
    const [archived, setArchived] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Research Form
    const [research, setResearch] = useState({ dimensions: '', materials: '', research_notes: '', historical_significance: '' });
    const [customData, setCustomData] = useState([]); // Array of { key: '', value: '' }

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Active Accessions
            const res = await apiFetch('/api/v1/acquisitions/accessions?expand=intake_id');
            const data = await res.json();
            
            // Fetch Deaccessioned Archive
            const archRes = await apiFetch('/api/v1/acquisitions/inventory/archive?expand=accession_id.intake_id');
            const archData = await archRes.json();

            if (data.status === 'success') {
                const items = data.data.items;
                const enrichedItems = await Promise.all(items.map(async (item) => {
                    try {
                        const mRes = await apiFetch(`/api/v1/media/accession/${item.id}`);
                        const mData = await mRes.json();
                        return {
                            ...item,
                            expand: { ...item.expand, media_attachments_via_entity_id: mData.data?.items || [] }
                        };
                    } catch (e) { return item; }
                }));
                setAccessions(enrichedItems);
            }

            if (archData.status === 'success') {
                setArchived(archData.data.items);
            }
        } catch (err) {
            console.error("Failed to fetch acquisition data", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Real-time synchronization
    useEffect(() => {
        if (events.length > 0) {
            console.log("Accession update received, refreshing data...");
            fetchData();
        }
    }, [events, fetchData]);

    // Update selected when research changes
    useEffect(() => {
        if (selected) {
            setResearch({
                dimensions: selected.dimensions || '',
                materials: selected.materials || '',
                research_notes: selected.research_notes || '',
                historical_significance: selected.historical_significance || ''
            });
            // Convert research_data object to array for UI
            const extra = selected.research_data || {};
            setCustomData(Object.entries(extra).map(([key, value]) => ({ key, value })));
        }
    }, [selected]);

    const handleAction = async (accessionId, action, body = {}) => {
        setActionLoading(true);
        try {
            let endpoint = '';
            if (action === 'approve') {
                endpoint = `/api/v1/acquisitions/accessions/${accessionId}/approve`;
            } else if (action === 'finalize') {
                endpoint = `/api/v1/acquisitions/inventory/from-accession/${accessionId}`;
            }

            const res = await apiFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: Object.keys(body).length ? JSON.stringify(body) : undefined
            });
            if (res.ok) {
                alert('Action completed successfully');
                fetchData();
                
                // Refresh selection to show new status/buttons
                const updatedRes = await apiFetch(`/api/v1/acquisitions/accessions/${accessionId}?expand=intake_id`);
                const updatedJson = await updatedRes.json();
                if (updatedJson.status === 'success') {
                    // Re-fetch media too to keep expand consistent
                    const mRes = await apiFetch(`/api/v1/media/accession/${accessionId}`);
                    const mData = await mRes.json();
                    setSelected({
                        ...updatedJson.data,
                        expand: {
                            ...updatedJson.data.expand,
                            media_attachments_via_entity_id: mData.data?.items || []
                        }
                    });
                }
            } else {
                const json = await res.json();
                alert(json.error || 'Action failed');
            }
        } catch (err) {
            alert('Request failed');
        } finally {
            setActionLoading(false);
        }
    };

    const addCustomField = () => setCustomData([...customData, { key: '', value: '' }]);
    const removeCustomField = (index) => setCustomData(customData.filter((_, i) => i !== index));
    const updateCustomField = (index, field, val) => {
        const next = [...customData];
        next[index][field] = val;
        setCustomData(next);
    };

    const handleResearchUpdate = async (e) => {
        e.preventDefault();
        setActionLoading(true);

        // Convert array back to object
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
            if (res.ok) {
                alert('Research updated');
                fetchData();
                
                // Refresh local selected state
                const updatedRes = await apiFetch(`/api/v1/acquisitions/accessions/${selected.id}?expand=intake_id`);
                const updatedJson = await updatedRes.json();
                if (updatedJson.status === 'success') {
                    const mRes = await apiFetch(`/api/v1/media/accession/${selected.id}`);
                    const mData = await mRes.json();
                    setSelected({
                        ...updatedJson.data,
                        expand: {
                            ...updatedJson.data.expand,
                            media_attachments_via_entity_id: mData.data?.items || []
                        }
                    });
                }
            }
        } catch (err) {
            alert('Update failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        formData.append('entity_type', 'accession');
        formData.append('entity_id', selected.id);

        setActionLoading(true);
        try {
            const res = await apiFetch('/api/v1/media/upload', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                alert('Images uploaded');
                fetchData();
                // Refresh selection to show new images
                const updatedRes = await apiFetch(`/api/v1/acquisitions/accessions/${selected.id}?expand=intake_id`);
                const updatedJson = await updatedRes.json();
                if (updatedJson.status === 'success') {
                    const mRes = await apiFetch(`/api/v1/media/accession/${selected.id}`);
                    const mData = await mRes.json();
                    setSelected({
                        ...updatedJson.data,
                        expand: {
                            ...updatedJson.data.expand,
                            media_attachments_via_entity_id: mData.data?.items || []
                        }
                    });
                }
            }
        } catch (err) { alert('Upload failed'); }
        finally { setActionLoading(false); }
    };

    const fetchArchiveMedia = async (item) => {
        if (!item || item.mediaFetched) return;
        try {
            const accId = item.expand?.accession_id?.id;
            if (!accId) return;
            const mRes = await apiFetch(`/api/v1/media/accession/${accId}`);
            const mData = await mRes.json();
            setSelected(prev => ({
                ...prev,
                mediaFetched: true,
                expand: {
                    ...prev.expand,
                    accession_id: {
                        ...prev.expand.accession_id,
                        expand: {
                            ...prev.expand.accession_id.expand,
                            media_attachments_via_entity_id: mData.data?.items || []
                        }
                    }
                }
            }));
        } catch (e) { console.error("Failed to fetch archive media", e); }
    };

    const handleMOAUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('files', file);

        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/accessions/${selected.id}/upload-moa`, {
                method: 'POST',
                body: formData // Note: apiFetch handles FormData headers
            });
            if (res.ok) {
                alert('Signed MOA uploaded');
                fetchData();
            }
        } catch (err) {
            alert('Upload failed');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Accessioning Registry</h1>
                <p className="text-[var(--text-secondary)] mt-1">Formal legal registration and artifact research.</p>
            </header>

            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl w-fit">
                <button 
                    onClick={() => { setActiveTab('active'); setSelected(null); }}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-white'}`}
                >
                    Live Registry ({accessions.length})
                </button>
                <button 
                    onClick={() => { setActiveTab('archive'); setSelected(null); }}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'archive' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-white'}`}
                >
                    Collection Archive ({archived.length})
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* List */}
                {/* Registry List (Full Width) */}
                <div className="lg:col-span-12">
                    <div className="glass-panel rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                            <h3 className="font-black uppercase tracking-widest text-xs text-zinc-400">
                                {activeTab === 'active' ? 'Curatorial Registry' : 'Historical Archive'}
                            </h3>
                            <div className="text-[10px] text-zinc-500 font-mono">
                                { (activeTab === 'active' ? accessions : archived).length } Records Identified
                            </div>
                        </div>
                        {loading ? (
                            <div className="p-20 text-center text-zinc-500">
                                <div className="animate-pulse mb-2 text-indigo-400 font-black tracking-widest uppercase text-[10px]">Scanning Registry...</div>
                                <p className="text-xs italic">Synchronizing curatorial data...</p>
                            </div>
                        ) : (activeTab === 'active' ? accessions : archived).length === 0 ? (
                            <div className="p-20 text-center text-zinc-500 italic text-sm">No records found in this view.</div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {(activeTab === 'active' ? accessions : archived).map(item => (
                                    <button 
                                        key={item.id} onClick={() => {
                                            setSelected(item);
                                            if (activeTab === 'archive') fetchArchiveMedia(item);
                                        }}
                                        className={`w-full p-6 flex items-center justify-between hover:bg-white/5 transition-all group ${selected?.id === item.id ? 'bg-indigo-500/5 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}
                                    >
                                        <div className="flex items-center gap-8 text-left">
                                            <div className="hidden md:block">
                                                <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Index No.</div>
                                                <div className="font-mono text-indigo-400 text-xs font-bold">
                                                    {activeTab === 'active' ? item.accession_number : item.catalog_number}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-200 font-black text-lg tracking-tight group-hover:text-white transition-colors">
                                                    {activeTab === 'active' 
                                                        ? (item.expand?.intake_id?.proposed_item_name || 'Unnamed Artifact')
                                                        : (item.expand?.accession_id?.expand?.intake_id?.proposed_item_name || 'Archived Artifact')
                                                    }
                                                </div>
                                                <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold">
                                                    {activeTab === 'active' 
                                                        ? `${item.contract_type.replace(/_/g, ' ')} • ${item.legal_status}`
                                                        : `Deaccessioned: ${new Date(item.updated).toLocaleDateString(undefined, { dateStyle: 'medium' })}`
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${activeTab === 'active' ? ACCESSION_STATUS_COLORS[item.status] : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                                                {item.status.replace(/_/g, ' ')}
                                            </span>
                                            <div className="text-zinc-600 group-hover:text-indigo-400 transition-colors">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Accession Detail Modal (Window) */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="glass-panel w-full max-w-6xl max-h-[90vh] rounded-[40px] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
                        {/* Modal Header */}
                        <header className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${activeTab === 'active' ? ACCESSION_STATUS_COLORS[selected.status] : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                                        {activeTab === 'active' ? selected.status.replace(/_/g, ' ') : 'Archived Record'}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-mono">#{activeTab === 'active' ? selected.accession_number : selected.catalog_number}</span>
                                </div>
                                <h2 className="text-3xl font-black text-white tracking-tight">
                                    {activeTab === 'active' 
                                        ? (selected.expand?.intake_id?.proposed_item_name || 'Unnamed Artifact')
                                        : (selected.expand?.accession_id?.expand?.intake_id?.proposed_item_name || 'Archived Artifact')
                                    }
                                </h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setSelected(null)}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold transition-all"
                                >
                                    Close Window
                                </button>
                                {activeTab === 'active' && selected.status === 'pending_approval' && (
                                    <button 
                                        onClick={() => handleAction(selected.id, 'approve')}
                                        className="px-10 py-3 bg-green-600 hover:bg-green-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-green-500/40 transition-all active:scale-95"
                                    >
                                        Approve Accession
                                    </button>
                                )}
                            </div>
                        </header>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-10">
                            {activeTab === 'active' ? (
                                <div className="grid grid-cols-12 gap-12">
                                    {/* Left Side: Research & Identity */}
                                    <div className="col-span-12 lg:col-span-7 space-y-12">
                                        {/* Curatorial Research */}
                                        <section className="space-y-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-xl">📜</div>
                                                <h3 className="text-lg font-black uppercase tracking-widest text-zinc-400">Curatorial Research</h3>
                                            </div>

                                            <form onSubmit={handleResearchUpdate} className="space-y-8">
                                                <div className="grid grid-cols-2 gap-8">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] uppercase font-black text-zinc-600">Physical Dimensions</label>
                                                        <input 
                                                            type="text" value={research.dimensions} onChange={e => setResearch({...research, dimensions: e.target.value})}
                                                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                            placeholder="e.g. 24cm x 15cm x 10cm"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] uppercase font-black text-zinc-600">Constituent Materials</label>
                                                        <input 
                                                            type="text" value={research.materials} onChange={e => setResearch({...research, materials: e.target.value})}
                                                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                            placeholder="e.g. Bronze, Gold leaf"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-black text-zinc-600">Historical Significance & Provenance</label>
                                                    <textarea 
                                                        rows="6" value={research.historical_significance} onChange={e => setResearch({...research, historical_significance: e.target.value})}
                                                        className="w-full bg-white/[0.03] border border-white/10 rounded-[32px] p-6 text-base text-zinc-200 leading-relaxed font-serif italic focus:outline-none focus:border-indigo-500 transition-all resize-none"
                                                        placeholder="Provide detailed provenance and significance..."
                                                    />
                                                </div>

                                                <div className="space-y-4 pt-4">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Structured Metadata</label>
                                                        <button type="button" onClick={addCustomField} className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10">Add Field</button>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {customData.map((field, idx) => (
                                                            <div key={idx} className="flex gap-3">
                                                                <input type="text" value={field.key} onChange={e => updateCustomField(idx, 'key', e.target.value)} className="w-1/3 bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-[11px] text-indigo-300 font-bold uppercase tracking-widest" placeholder="Field Name" />
                                                                <input type="text" value={field.value} onChange={e => updateCustomField(idx, 'value', e.target.value)} className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white" placeholder="Value" />
                                                                <button type="button" onClick={() => removeCustomField(idx)} className="text-zinc-500 hover:text-rose-400">✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {selected.status !== 'finalized' && (
                                                    <button type="submit" disabled={actionLoading} className="w-full py-4 bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-600 hover:text-white transition-all">
                                                        Update Curatorial Registry
                                                    </button>
                                                )}
                                            </form>
                                        </section>

                                        {/* Administrative Handover */}
                                        {selected.status === 'in_research' && (
                                            <section className="bg-amber-500/5 rounded-[40px] p-8 border border-amber-500/10 space-y-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-xl">🏛️</div>
                                                    <h3 className="text-xs font-black uppercase tracking-widest text-amber-500">Inventory Handover</h3>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[11px] text-zinc-500 max-w-md italic">Research is complete. Finalize the record to assign a catalog number and move the artifact into permanent museum inventory.</p>
                                                    <button 
                                                        onClick={() => {
                                                            const loc = prompt('Assign Storage Location:');
                                                            if (loc) handleAction(selected.id, 'finalize', { location: loc });
                                                        }}
                                                        className="px-8 py-3 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl hover:scale-105 transition-transform"
                                                    >
                                                        Finalize to Inventory
                                                    </button>
                                                </div>
                                            </section>
                                        )}
                                    </div>

                                    {/* Right Side: Legal & Media */}
                                    <div className="col-span-12 lg:col-span-5 space-y-12">
                                        {/* Legal Framework Card */}
                                        <section className="bg-indigo-600/5 rounded-[40px] p-8 border border-indigo-500/10 space-y-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-xl">⚖️</div>
                                                <h3 className="text-xs font-black uppercase tracking-widest text-indigo-300">Legal Framework</h3>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="text-[9px] uppercase font-black text-zinc-600 block mb-1">Contract Type</label>
                                                        <div className="text-sm text-white font-bold uppercase tracking-wider">{selected.contract_type.replace(/_/g, ' ')}</div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] uppercase font-black text-zinc-600 block mb-1">Legal Status</label>
                                                        <div className="text-sm text-indigo-400 font-bold">{selected.legal_status}</div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[9px] uppercase font-black text-zinc-600 block mb-1">Signed MOA Status</label>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${selected.signed_moa ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                                                            {selected.signed_moa ? 'Electronically Verified' : 'Awaiting Documentation'}
                                                        </span>
                                                        <div className="relative overflow-hidden">
                                                            <input type="file" onChange={handleMOAUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                            <button className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300">Update MOA</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        {/* Documentary Evidence Gallery */}
                                        <section className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-xl">🖼️</div>
                                                    <h3 className="text-lg font-black uppercase tracking-widest text-zinc-400">Documentary Evidence</h3>
                                                </div>
                                                <div className="relative">
                                                    <input type="file" multiple onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                    <button className="px-4 py-2 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all">+ Add Visuals</button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3">
                                                {(selected.expand?.media_attachments_via_entity_id || []).map((m, i) => (
                                                    (m.files || []).map((file, idx) => (
                                                        <div key={`${m.id}-${idx}`} className="group relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                                                            <img 
                                                                src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`}
                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                            />
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                                                <a 
                                                                    href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`}
                                                                    target="_blank" rel="noreferrer"
                                                                    className="px-4 py-2 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-transform"
                                                                >
                                                                    View Original
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ))
                                                ))}
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            ) : (
                                <ArchiveViewerModal selected={selected} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ArchiveViewerModal({ selected }) {
    const acc = selected.expand?.accession_id;
    const intake = acc?.expand?.intake_id;

    return (
        <div className="grid grid-cols-12 gap-12">
            <div className="col-span-12 lg:col-span-7 space-y-12">
                <section className="bg-rose-500/5 border border-rose-500/10 p-10 rounded-[40px] space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center text-2xl">⚠️</div>
                        <h3 className="text-xl font-black uppercase tracking-widest text-rose-500">Deaccession Summary</h3>
                    </div>
                    <p className="text-2xl text-zinc-200 leading-relaxed font-serif italic">"{selected.deaccession_reason || 'No specific reason provided.'}"</p>
                    <div className="grid grid-cols-2 gap-8 pt-6 border-t border-rose-500/10">
                        <DetailRow label="Final Handover Date" value={new Date(selected.updated).toLocaleDateString(undefined, { dateStyle: 'full' })} />
                        <DetailRow label="Last Known Location" value={selected.current_location} />
                    </div>
                </section>

                <section className="space-y-8">
                    <h4 className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Historical Provenance</h4>
                    <div className="text-lg text-zinc-400 leading-relaxed border-l-2 border-white/10 pl-8">
                        {acc?.historical_significance || 'No significant curatorial data archived.'}
                    </div>
                </section>
            </div>

            <div className="col-span-12 lg:col-span-5 space-y-12">
                <section className="bg-white/5 rounded-[40px] p-8 border border-white/10 space-y-8">
                    <h4 className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Catalog Specification</h4>
                    <div className="space-y-6">
                        <DetailRow label="Original Donor" value={intake?.donor_info || intake?.source_info} />
                        <DetailRow label="Materials" value={acc?.materials} />
                        <DetailRow label="Dimensions" value={acc?.dimensions} />
                        <DetailRow label="Legal Method" value={acc?.contract_type} caps />
                    </div>
                    {acc?.research_data && Object.keys(acc.research_data).length > 0 && (
                        <div className="pt-8 border-t border-white/5 space-y-3">
                            {Object.entries(acc.research_data).map(([k, v]) => (
                                <DetailRow key={k} label={k} value={v} />
                            ))}
                        </div>
                    )}
                </section>

                {acc?.expand?.media_attachments_via_entity_id?.length > 0 && (
                    <section className="space-y-6">
                        <h4 className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Archival Visuals</h4>
                        <div className="grid grid-cols-3 gap-3">
                            {acc.expand.media_attachments_via_entity_id.map((m, i) => (
                                (m.files || []).map((file, idx) => (
                                    <div key={`${m.id}-${idx}`} className="aspect-square rounded-2xl overflow-hidden border border-white/5 bg-black/40 grayscale opacity-40">
                                        <img src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`} className="w-full h-full object-cover" />
                                    </div>
                                ))
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}

function DetailRow({ label, value, mono, caps, status }) {
    return (
        <div className="flex justify-between text-xs items-center">
            <span className="text-zinc-600 font-bold uppercase tracking-wider text-[9px]">{label}</span>
            <span className={`text-zinc-200 ${mono ? 'font-mono' : ''} ${caps ? 'capitalize' : ''} ${status ? 'text-green-400 font-black' : ''}`}>
                {value || 'N/A'}
            </span>
        </div>
    );
}
