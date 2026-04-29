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
    const [accessions, setAccessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Research Form
    const [research, setResearch] = useState({ dimensions: '', materials: '', research_notes: '', historical_significance: '' });
    const [customData, setCustomData] = useState([]); // Array of { key: '', value: '' }

    const fetchAccessions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/v1/acquisitions/accessions?expand=intake_id');
            const data = await res.json();
            if (data.status === 'success') {
                const items = data.data.items;
                
                // Manually fetch media for each accession since expansion won't work for polymorphic IDs
                const enrichedItems = await Promise.all(items.map(async (item) => {
                    try {
                        const mRes = await apiFetch(`/api/v1/media/accession/${item.id}`);
                        const mData = await mRes.json();
                        return {
                            ...item,
                            expand: {
                                ...item.expand,
                                media_attachments_via_entity_id: mData.data?.items || []
                            }
                        };
                    } catch (e) {
                        return item;
                    }
                }));
                
                setAccessions(enrichedItems);
            }
        } catch (err) {
            console.error("Failed to fetch accessions", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => { fetchAccessions(); }, [fetchAccessions]);

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
            const res = await apiFetch(`/api/v1/acquisitions/accessions/${accessionId}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: Object.keys(body).length ? JSON.stringify(body) : undefined
            });
            if (res.ok) {
                alert('Action completed successfully');
                fetchAccessions();
                setSelected(null);
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...research,
                    research_data: researchDataObj
                })
            });
            if (res.ok) {
                alert('Research updated');
                fetchAccessions();
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
                fetchAccessions();
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

    const handleMOAUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('files', file);

        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/accessions/${selected.id}/moa`, {
                method: 'POST',
                body: formData // Note: apiFetch handles FormData headers
            });
            if (res.ok) {
                alert('Signed MOA uploaded');
                fetchAccessions();
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* List */}
                <div className="lg:col-span-8">
                    <div className="glass-panel rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/5 bg-white/5">
                            <h3 className="font-semibold text-sm">Accession Records</h3>
                        </div>
                        {loading ? (
                            <div className="p-20 text-center text-zinc-500">Loading registry...</div>
                        ) : accessions.length === 0 ? (
                            <div className="p-20 text-center text-zinc-500">No accession records found.</div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {accessions.map(item => (
                                    <button 
                                        key={item.id} onClick={() => setSelected(item)}
                                        className={`w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors ${selected?.id === item.id ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : ''}`}
                                    >
                                        <div className="text-left">
                                            <div className="font-mono text-indigo-400 text-sm font-bold">{item.accession_number}</div>
                                            <div className="text-zinc-200 font-semibold mt-1">{item.expand?.intake_id?.proposed_item_name || 'Unnamed Artifact'}</div>
                                            <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">{item.contract_type} • {item.legal_status}</div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${ACCESSION_STATUS_COLORS[item.status]}`}>
                                            {item.status.replace(/_/g, ' ')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Detail/Research Panel */}
                <div className="lg:col-span-4">
                    <div className="glass-panel rounded-2xl sticky top-8 overflow-hidden min-h-[600px]">
                        {!selected ? (
                            <div className="p-16 text-center text-zinc-500">
                                <p className="text-sm italic">Select a record to manage legal and research data.</p>
                            </div>
                        ) : (
                            <div className="p-6 space-y-8 animate-in slide-in-from-right-4 duration-300">
                                <header className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg">Accession Record</h3>
                                        <p className="text-[10px] font-mono text-zinc-500 uppercase">{selected.accession_number}</p>
                                    </div>
                                    <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white">✕</button>
                                </header>

                                <section className="space-y-4">
                                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Intake Context</h4>
                                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-3">
                                        <DetailRow label="Original Item" value={selected.expand?.intake_id?.proposed_item_name} />
                                        <DetailRow label="Donor/Source" value={selected.expand?.intake_id?.donor_info || selected.expand?.intake_id?.source_info} />
                                        <DetailRow label="Acquisition" value={selected.expand?.intake_id?.acquisition_method} caps />
                                        <div className="pt-2 border-t border-white/5">
                                            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Description from Form</p>
                                            <p className="text-xs text-zinc-400 italic">"{selected.expand?.intake_id?.item_description || 'No description provided.'}"</p>
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-indigo-400">Legal & Compliance</h4>
                                    <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-white/5">
                                        <DetailRow label="Contract" value={selected.contract_type} caps />
                                        <DetailRow label="Signed MOA" value={selected.signed_moa ? 'Uploaded' : 'Missing'} status={!!selected.signed_moa} />
                                    </div>
                                    
                                    <div className="relative group">
                                        <input 
                                            type="file" onChange={handleMOAUpload}
                                            disabled={selected.status === 'finalized'}
                                            className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <button 
                                            disabled={selected.status === 'finalized'}
                                            className="w-full py-2.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold rounded-xl hover:bg-indigo-600/40 transition-all disabled:opacity-50"
                                        >
                                            {selected.signed_moa ? 'Replace Signed MOA' : 'Upload Signed MOA'}
                                        </button>
                                    </div>

                                    {selected.status === 'pending_approval' && (
                                        <button 
                                            onClick={() => handleAction(selected.id, 'approve')}
                                            disabled={actionLoading}
                                            className="w-full py-3 bg-green-600 text-white font-bold rounded-xl text-sm disabled:opacity-50"
                                        >
                                            Approve Accession
                                        </button>
                                    )}

                                    <button 
                                        onClick={() => window.open(`${window.location.origin}/api/v1/acquisitions/accessions/${selected.id}/report`, '_blank')}
                                        className="w-full py-2.5 bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                    >
                                        📄 Generate Formal Report
                                    </button>
                                </section>

                                <section className="space-y-4">
                                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-blue-400">Curatorial Research</h4>
                                    <form onSubmit={handleResearchUpdate} className="space-y-3">
                                        <fieldset disabled={selected.status === 'finalized'} className="space-y-3">
                                            <div>
                                                <label className="text-[10px] text-zinc-500 block mb-1">Dimensions</label>
                                                <input 
                                                    type="text" value={research.dimensions} onChange={e => setResearch({...research, dimensions: e.target.value})}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                                    placeholder="e.g. 20cm x 15cm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-zinc-500 block mb-1">Materials</label>
                                                <input 
                                                    type="text" value={research.materials} onChange={e => setResearch({...research, materials: e.target.value})}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                                    placeholder="e.g. Terracotta, Pigment"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-zinc-500 block mb-1">Historical Significance</label>
                                                <textarea 
                                                    rows="3" value={research.historical_significance} onChange={e => setResearch({...research, historical_significance: e.target.value})}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none"
                                                    placeholder="Explain why this artifact matters..."
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-zinc-500 block mb-1">Research Notes</label>
                                                <textarea 
                                                    rows="3" value={research.research_notes} onChange={e => setResearch({...research, research_notes: e.target.value})}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none"
                                                    placeholder="Curatorial notes, provenance, etc..."
                                                />
                                            </div>

                                            <div className="space-y-3 pt-2">
                                                <div className="flex justify-between items-center">
                                                    <h5 className="text-[10px] uppercase font-bold text-zinc-500">Structured Data</h5>
                                                    <button 
                                                        type="button" onClick={addCustomField}
                                                        className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/10 disabled:opacity-0"
                                                    >
                                                        + Add Key
                                                    </button>
                                                </div>
                                                
                                                {customData.map((field, idx) => (
                                                    <div key={idx} className="flex gap-2 animate-in slide-in-from-left-2 duration-200">
                                                        <input 
                                                            type="text" value={field.key} onChange={e => updateCustomField(idx, 'key', e.target.value)}
                                                            className="flex-1 bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-[11px] text-indigo-300"
                                                            placeholder="Key (e.g. Origin)"
                                                        />
                                                        <input 
                                                            type="text" value={field.value} onChange={e => updateCustomField(idx, 'value', e.target.value)}
                                                            className="flex-1 bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-[11px] text-white"
                                                            placeholder="Value"
                                                        />
                                                        {selected.status !== 'finalized' && (
                                                            <button 
                                                                type="button" onClick={() => removeCustomField(idx)}
                                                                className="text-zinc-500 hover:text-rose-400 px-1"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </fieldset>

                                        {selected.status !== 'finalized' && (
                                            <button 
                                                type="submit" disabled={actionLoading}
                                                className="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl"
                                            >
                                                Save Research Data
                                            </button>
                                        )}
                                    </form>
                                </section>
                                {selected.status === 'in_research' && (
                                    <section className="pt-4 border-t border-white/5 space-y-4">
                                        <h4 className="text-[10px] uppercase tracking-widest font-bold text-amber-400">Artifact Media (Mandatory)</h4>
                                        
                                        {/* Image Upload */}
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap gap-2">
                                                {(selected.expand?.media_attachments_via_entity_id || []).map((m, i) => (
                                                    <div key={i} className="w-16 h-16 rounded-lg bg-black/40 border border-white/10 overflow-hidden relative group">
                                                        <img src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${m.files[0]}`} className="w-full h-full object-cover" />
                                                    </div>
                                                ))}
                                                <div className="relative w-16 h-16 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer">
                                                    <span className="text-xl">+</span>
                                                    <input 
                                                        type="file" multiple onChange={(e) => handleImageUpload(e)}
                                                        disabled={selected.status === 'finalized'}
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 py-2">
                                                <div className="flex-1 h-px bg-white/5"></div>
                                                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">OR</span>
                                                <div className="flex-1 h-px bg-white/5"></div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] text-zinc-500 block mb-1">Skip Image Reason</label>
                                                <select 
                                                    value={research.image_skip_reason || ''} 
                                                    onChange={e => setResearch({...research, image_skip_reason: e.target.value})}
                                                    disabled={selected.status === 'finalized'}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500"
                                                >
                                                    <option value="">-- No Skip (Images Required) --</option>
                                                    <option value="sensitive_to_light">Sensitive to Light (No Flash/Studio Exposure)</option>
                                                    <option value="special_handling">Requires Special Handling for Capture</option>
                                                    <option value="conservation_ongoing">Ongoing Conservation (Imaging Deferred)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => {
                                                const hasImages = (selected.expand?.media_attachments_via_entity_id?.length > 0);
                                                const hasReason = !!research.image_skip_reason;
                                                
                                                if (!hasImages && !hasReason) {
                                                    alert('Error: You must either upload artifact images or provide a valid skip reason before finalization.');
                                                    return;
                                                }

                                                const loc = prompt('Assign Storage Location (e.g. Shelf A-4):');
                                                if (loc) handleAction(selected.id, 'finalize', { 
                                                    location: loc,
                                                    imageSkipReason: research.image_skip_reason 
                                                });
                                            }}
                                            className="w-full py-3 bg-white text-black font-bold rounded-xl text-sm hover:bg-zinc-200 transition-all disabled:opacity-50"
                                        >
                                            Finalize to Inventory
                                        </button>
                                    </section>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DetailRow({ label, value, mono, caps, status }) {
    return (
        <div className="flex justify-between text-xs">
            <span className="text-zinc-500">{label}</span>
            <span className={`text-zinc-200 ${mono ? 'font-mono' : ''} ${caps ? 'capitalize' : ''} ${status ? 'text-green-400 font-bold' : ''}`}>
                {value}
            </span>
        </div>
    );
}
