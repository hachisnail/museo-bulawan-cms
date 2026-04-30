import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSSE } from '../hooks/useSSE';
import { useAuth } from '../context/authContext';
import FormRenderer from '../components/FormRenderer';

const ITEM_STATUS_COLORS = {
    'active': 'text-green-400 bg-green-500/10 border-green-500/20',
    'stable': 'text-green-400 bg-green-500/10 border-green-500/20', // Fallback
    'maintenance': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'needs_conservation': 'text-amber-400 bg-amber-500/10 border-amber-500/20', // Legacy
    'loan': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    'storage': 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
    'at_risk': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    'lost': 'text-rose-600 bg-rose-500/10 border-rose-500/20',
    'deaccessioned': 'text-zinc-600 bg-zinc-500/5 border-zinc-500/10'
};

export default function Inventory() {
    const { apiFetch } = useAuth();
    const { events } = useSSE('inventory');

    const [initialData, setInitialData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [activeTab, setActiveTab] = useState('general'); // 'general' | 'movement' | 'conservation'

    const prefillData = useMemo(() => ({
        artifact_id: selected?.id
    }), [selected?.id]);
    
    // Detailed Data
    const [movementHistory, setMovementHistory] = useState([]);
    const [conservationLogs, setConservationLogs] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchInventory = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/v1/acquisitions/inventory?expand=accession_id');
            const data = await res.json();
            if (data.status === 'success') {
                const items = data.data.items;
                
                // Enriched expansion for polymorphic media
                const enriched = await Promise.all(items.map(async (item) => {
                    if (item.expand?.accession_id) {
                        try {
                            const mRes = await apiFetch(`/api/v1/media/accession/${item.expand.accession_id.id}`);
                            const mData = await mRes.json();
                            item.expand.accession_id.expand = {
                                ...item.expand.accession_id.expand,
                                media_attachments_via_entity_id: mData.data?.items || []
                            };
                        } catch (e) {}
                    }
                    return item;
                }));
                
                setInitialData(enriched);
            }
        } catch (err) {
            console.error("Failed to fetch inventory", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => { fetchInventory(); }, [fetchInventory]);

    // Real-time synchronization
    useEffect(() => {
        if (events.length > 0) {
            console.log("Inventory update received, refreshing catalog...");
            fetchInventory();
        }
    }, [events, fetchInventory]);

    const displayList = [...initialData]
        .sort((a, b) => new Date(b.created) - new Date(a.created));

    const fetchDetails = async (item) => {
        setDetailLoading(true);
        setActiveTab('general');
        try {
            // Fetch the most up-to-date and fully expanded record for this item
            const itemRes = await apiFetch(`/api/v1/acquisitions/inventory/${item.id}?expand=accession_id,accession_id.intake_id`);
            const itemJson = await itemRes.json();
            if (itemJson.status === 'success') {
                const enrichedItem = itemJson.data;
                if (enrichedItem.expand?.accession_id) {
                    try {
                        const mRes = await apiFetch(`/api/v1/media/accession/${enrichedItem.expand.accession_id.id}`);
                        const mData = await mRes.json();
                        enrichedItem.expand.accession_id.expand = {
                            ...enrichedItem.expand.accession_id.expand,
                            media_attachments_via_entity_id: mData.data?.items || []
                        };
                    } catch (e) {}
                }
                setSelected(enrichedItem);
            }

            const [moveRes, healthRes] = await Promise.all([
                apiFetch(`/api/v1/acquisitions/inventory/${item.id}/movement`),
                apiFetch(`/api/v1/acquisitions/inventory/${item.id}/condition-reports`)
            ]);
            const moveJson = await moveRes.json();
            const healthJson = await healthRes.json();
            
            if (moveJson.status === 'success') setMovementHistory(moveJson.data.items);
            if (healthJson.status === 'success') setConservationLogs(healthJson.data.items);
        } catch (err) {
            console.error("Failed to fetch details", err);
        } finally {
            setDetailLoading(false);
        }
    };

    // Form States
    const [moveForm, setMoveForm] = useState({ toLocation: '', reason: '', condition: '' });
    const [consForm, setConsForm] = useState({ treatment: '', findings: '', recommendations: '' });
    const [showMoveForm, setShowMoveForm] = useState(false);
    const [showConsForm, setShowConsForm] = useState(false);

    const handleTransfer = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/inventory/${selected.id}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(moveForm)
            });
            if (res.ok) {
                alert('Artifact moved successfully.');
                setMoveForm({ toLocation: '', reason: '', condition: '' });
                setShowMoveForm(false);
                fetchInventory();
                fetchDetails(selected);
            }
        } catch (err) { alert('Transfer failed'); }
        finally { setActionLoading(false); }
    };

    const handleAddConservationLog = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/inventory/${selected.id}/conservation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(consForm)
            });
            if (res.ok) {
                alert('Conservation log added.');
                setConsForm({ treatment: '', findings: '', recommendations: '' });
                setShowConsForm(false);
                fetchDetails(selected);
            }
        } catch (err) { alert('Failed to add log'); }
        finally { setActionLoading(false); }
    };

    const handleStatusUpdate = async () => {
        const statuses = ['active', 'maintenance', 'loan', 'storage', 'lost'];
        const newStatus = prompt(`Enter new status (${statuses.join(', ')}):`);
        if (!newStatus || !statuses.includes(newStatus)) {
            if (newStatus) alert('Invalid status.');
            return;
        }

        const reason = prompt('Mandatory justification for manual override:');
        if (!reason || reason.length < 5) {
            alert('A justification (at least 5 chars) is required.');
            return;
        }

        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/inventory/${selected.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, isManual: true, reason })
            });
            if (res.ok) {
                alert('Status updated manually.');
                fetchInventory();
                fetchDetails(selected);
            }
        } catch (err) { alert('Failed to update status'); }
        finally { setActionLoading(false); }
    };

    const handleDeaccession = async () => {
        if (!confirm('CAUTION: Deaccessioning is a formal removal from the collection. Continue?')) return;
        const reason = prompt('Formal reason for deaccessioning:');
        if (!reason) return;
        
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/inventory/${selected.id}/deaccession`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });
            if (res.ok) {
                alert('Artifact formally deaccessioned.');
                fetchInventory();
                setSelected(null);
            }
        } catch (err) { alert('Deaccessioning failed'); }
        finally { setActionLoading(false); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Conditional Header: Only show if not in Detail View */}
            {!selected && (
                <header className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Collection Inventory</h1>
                        <p className="text-[var(--text-secondary)] mt-1">Cataloged artifacts in the museum's permanent custody.</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-zinc-400 uppercase tracking-widest font-bold">Live Catalog</span>
                    </div>
                </header>
            )}

            {!selected ? (
                /* GRID VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                    {loading && initialData.length === 0 ? (
                        <div className="col-span-full p-20 text-center text-zinc-500 bg-white/5 rounded-3xl border border-dashed border-white/10">
                            Loading catalog...
                        </div>
                    ) : displayList.length === 0 ? (
                        <div className="col-span-full p-20 text-center text-zinc-500 bg-white/5 rounded-3xl border border-dashed border-white/10">
                            <div className="text-5xl mb-4 opacity-10">🏛️</div>
                            No artifacts in inventory.
                        </div>
                    ) : (
                        displayList.map((item) => {
                            const acc = item.expand?.accession_id;
                            const intake = acc?.expand?.intake_id;
                            return (
                                <button 
                                    key={item.id}
                                    onClick={() => fetchDetails(item)}
                                    className="glass-panel rounded-3xl border border-white/5 transition-all text-left group hover:scale-[1.02] active:scale-[0.98] overflow-hidden flex flex-col hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10"
                                >
                                    <div className="h-48 bg-black/40 relative overflow-hidden flex items-center justify-center border-b border-white/5">
                                        {acc?.expand?.['media_attachments_via_entity_id']?.[0] ? (
                                            <img 
                                                src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${acc.expand['media_attachments_via_entity_id'][0].collectionId}/${acc.expand['media_attachments_via_entity_id'][0].id}/${acc.expand['media_attachments_via_entity_id'][0].files[0]}`} 
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                            />
                                        ) : (
                                            <div className="p-6 text-center opacity-30 group-hover:opacity-60 transition-opacity">
                                                <div className="text-3xl mb-2">📷</div>
                                                <div className="text-[9px] uppercase font-bold tracking-widest leading-tight">
                                                    {item.image_skip_reason ? item.image_skip_reason.replace(/_/g, ' ') : 'No Media'}
                                                </div>
                                            </div>
                                        )}
                                        <div className="absolute top-4 left-4 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold text-indigo-400 border border-white/10 font-mono">
                                            #{item.catalog_number}
                                        </div>
                                    </div>
                                    <div className="p-6 flex-1 flex flex-col">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${ITEM_STATUS_COLORS[item.status] || ITEM_STATUS_COLORS.active}`}>
                                                {item.status.replace(/_/g, ' ')}
                                            </div>
                                            <span className="text-[10px] text-zinc-600 font-mono">{acc?.accession_number}</span>
                                        </div>
                                        <h3 className="font-bold text-lg text-zinc-100 mb-1 group-hover:text-indigo-400 transition-colors line-clamp-1">
                                            {intake?.proposed_item_name || acc?.accession_number}
                                        </h3>
                                        <p className="text-xs text-zinc-500 line-clamp-2 italic mb-4">
                                            {acc?.historical_significance || 'No historical documentation available.'}
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-auto pt-4 border-t border-white/5">
                                            <span>📍</span> {item.current_location || 'Receiving'}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            ) : (
                /* FULL DETAIL VIEW */
                <div className="animate-in slide-in-from-right-8 duration-500 space-y-8">
                    {/* Detail Header / Nav */}
                    <nav className="flex items-center justify-between pb-6 border-b border-white/5">
                        <button 
                            onClick={() => setSelected(null)}
                            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group"
                        >
                            <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
                            <span className="text-sm font-bold">Back to Catalog</span>
                        </button>
                        <div className="flex gap-3">
                            <button onClick={handleStatusUpdate} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-bold text-zinc-300 transition-all">
                                ⚙️ Override Status
                            </button>
                            <button onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL}/api/v1/acquisitions/accessions/${selected.accession_id}/report`, '_blank')} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-bold text-zinc-300 transition-all">
                                📄 Print Report
                            </button>
                            <button onClick={handleDeaccession} className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 text-rose-500 hover:text-white rounded-xl text-[11px] font-bold transition-all">
                                🗑️ Deaccession
                            </button>
                        </div>
                    </nav>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Primary Content (Left) */}
                        <div className="lg:col-span-8 space-y-8">
                            {/* Visual Documentation */}
                            <section className="glass-panel rounded-3xl overflow-hidden border border-white/5">
                                <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400">Visual Documentation</h3>
                                    <span className="text-[10px] text-zinc-500">{(selected.expand?.accession_id?.expand?.media_attachments_via_entity_id?.length || 0)} File(s) Attached</span>
                                </div>
                                <div className="p-8">
                                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                                        {(selected.expand?.accession_id?.expand?.media_attachments_via_entity_id || []).map((m) => (
                                            (m.files || []).map((file, idx) => (
                                                <div key={`${m.id}-${idx}`} className="min-w-[300px] h-64 rounded-2xl overflow-hidden border border-white/10 bg-black shadow-xl group relative">
                                                    <img 
                                                        src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`} 
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                                        <p className="text-[10px] text-white/80 italic">{m.caption || 'Artifact documentation capture'}</p>
                                                    </div>
                                                </div>
                                            ))
                                        ))}
                                        {(!selected.expand?.accession_id?.expand?.media_attachments_via_entity_id || selected.expand?.accession_id?.expand?.media_attachments_via_entity_id.length === 0) && (
                                            <div className="w-full h-64 flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-dashed border-white/10 opacity-30">
                                                <div className="text-4xl mb-3">📷</div>
                                                <p className="text-xs uppercase tracking-widest font-bold">No documentation found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Lifecycle Tabs */}
                            <section className="glass-panel rounded-3xl overflow-hidden border border-white/5 min-h-[500px] flex flex-col">
                                <div className="flex border-b border-white/5 bg-white/5">
                                    <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} label="Historical Provenance" />
                                    <TabButton active={activeTab === 'movement'} onClick={() => setActiveTab('movement')} label="Movement Trail" />
                                    <TabButton active={activeTab === 'conservation'} onClick={() => setActiveTab('conservation')} label="Health & Conservation" />
                                </div>
                                
                                <div className="p-8 flex-1">
                                    {detailLoading ? (
                                        <div className="h-full flex items-center justify-center py-20">
                                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : (
                                        <>
                                            {activeTab === 'general' && (
                                                <div className="animate-in fade-in duration-300 space-y-8">
                                                    <div className="prose prose-invert max-w-none">
                                                        <h4 className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-4">Historical Significance</h4>
                                                        <p className="text-zinc-200 text-lg leading-relaxed italic font-serif">
                                                            "{selected.expand?.accession_id?.historical_significance || 'No historical research data currently recorded for this artifact.'}"
                                                        </p>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/5">
                                                        <div>
                                                            <h4 className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-4">Curatorial Notes</h4>
                                                            <div className="bg-black/20 p-6 rounded-2xl border border-white/5 text-sm text-zinc-400 leading-relaxed min-h-[150px]">
                                                                {selected.expand?.accession_id?.research_notes || 'No curatorial notes recorded.'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-4">Technical Structured Data</h4>
                                                            <div className="space-y-2">
                                                                {Object.entries(selected.expand?.accession_id?.research_data || {}).map(([k, v]) => (
                                                                    <DetailRow key={k} label={k} value={v} />
                                                                ))}
                                                                {Object.keys(selected.expand?.accession_id?.research_data || {}).length === 0 && (
                                                                    <p className="text-xs text-zinc-600 italic">No supplemental structured data.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'movement' && (
                                                <div className="animate-in fade-in duration-300 space-y-8">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <h4 className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Audit History</h4>
                                                            <p className="text-xs text-zinc-600 mt-1">Official internal movement log.</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => setShowMoveForm(true)}
                                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                                                        >
                                                            + Log New Move
                                                        </button>
                                                    </div>

                                                    {showMoveForm && (
                                                        <div className="bg-indigo-600/5 border border-indigo-500/20 rounded-3xl p-8 animate-in slide-in-from-top-4 duration-500 mb-8">
                                                            <div className="flex justify-between items-center mb-6">
                                                                <span className="text-xs font-black uppercase text-indigo-400">Movement Authorization Form</span>
                                                                <button type="button" onClick={() => setShowMoveForm(false)} className="text-zinc-500 hover:text-white transition-colors">Cancel</button>
                                                            </div>
                                                            <FormRenderer 
                                                                slug="artifact-movement"
                                                                hideHeader={true}
                                                                compact={true}
                                                                customFetch={apiFetch}
                                                                prefillData={prefillData}
                                                                onSuccess={() => { setShowMoveForm(false); fetchDetails(selected); fetchInventory(); }}
                                                                className="!p-0 !bg-transparent !border-none !shadow-none"
                                                            />
                                                        </div>
                                                    )}

                                                    <div className="space-y-6 relative">
                                                        <div className="absolute left-3.5 top-2 bottom-2 w-px bg-white/5"></div>
                                                        {movementHistory.map((move, i) => (
                                                            <div key={i} className="relative pl-12">
                                                                <div className={`absolute left-0 top-1 w-7 h-7 rounded-full flex items-center justify-center border-4 border-black z-10 ${i === 0 ? 'bg-indigo-500 ring-4 ring-indigo-500/20' : 'bg-zinc-800'}`}>
                                                                    <span className="text-[10px]">{i === 0 ? '📍' : '•'}</span>
                                                                </div>
                                                                <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-all group">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <h5 className="font-bold text-zinc-100 group-hover:text-indigo-400 transition-colors">{move.to_location}</h5>
                                                                        <span className="text-[10px] font-mono text-zinc-600">{new Date(move.created).toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="text-[10px] text-zinc-400 leading-relaxed mb-4 italic">"{move.reason || 'Standard internal rotation'}"</div>
                                                                    <div className="flex items-center gap-3 text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                                                                        <span>Actor: {move.expand?.moved_by?.name || move.moved_by || 'System Agent'}</span>
                                                                        {move.submission_id && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <a href={`/admin/forms/submissions/${move.submission_id}`} className="text-indigo-500 hover:underline">Form Proof</a>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {movementHistory.length === 0 && (
                                                            <div className="py-20 text-center opacity-20">No movement history recorded.</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'conservation' && (
                                                <div className="animate-in fade-in duration-300 space-y-8">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <h4 className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Health Evaluation</h4>
                                                            <p className="text-xs text-zinc-600 mt-1">Official conservation and condition reports.</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => setShowConsForm(true)}
                                                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg shadow-amber-500/20"
                                                        >
                                                            + New Health Entry
                                                        </button>
                                                    </div>

                                                    {showConsForm && (
                                                        <div className="bg-amber-600/5 border border-amber-500/20 rounded-3xl p-8 animate-in slide-in-from-top-4 duration-500 mb-8">
                                                            <div className="flex justify-between items-center mb-6">
                                                                <span className="text-xs font-black uppercase text-amber-400">Condition Assessment Form</span>
                                                                <button type="button" onClick={() => setShowConsForm(false)} className="text-zinc-500 hover:text-white transition-colors">Cancel</button>
                                                            </div>
                                                            <FormRenderer 
                                                                slug="artifact-health"
                                                                hideHeader={true}
                                                                compact={true}
                                                                customFetch={apiFetch}
                                                                prefillData={prefillData}
                                                                onSuccess={() => { setShowConsForm(false); fetchDetails(selected); }}
                                                                className="!p-0 !bg-transparent !border-none !shadow-none"
                                                            />
                                                        </div>
                                                    )}

                                                    <div className="space-y-6">
                                                        {conservationLogs.map((log, i) => (
                                                            <div key={i} className="bg-white/5 border border-white/5 rounded-3xl p-6 hover:bg-white/10 transition-all border-l-4 border-l-indigo-500">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                                        log.condition === 'Excellent' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                                        log.condition === 'Good' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                                                        log.condition === 'Fair' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                                        'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                                    }`}>
                                                                        {log.condition || 'Observation'}
                                                                    </div>
                                                                    <span className="text-[10px] font-mono text-zinc-600">{new Date(log.created).toLocaleString()}</span>
                                                                </div>

                                                                <p className="text-sm text-zinc-300 leading-relaxed mb-6 whitespace-pre-wrap">{log.notes}</p>

                                                                {log.attachments?.length > 0 && (
                                                                    <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                                                                        {log.attachments.map((file, idx) => (
                                                                            <a 
                                                                                key={idx} 
                                                                                href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${log.collectionId}/${log.id}/${file}`} 
                                                                                target="_blank" rel="noreferrer" 
                                                                                className="block w-24 h-24 rounded-2xl overflow-hidden border border-white/10 hover:border-indigo-500 transition-all shadow-lg shrink-0"
                                                                            >
                                                                                <img src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${log.collectionId}/${log.id}/${file}`} className="w-full h-full object-cover" />
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center justify-between pt-4 border-t border-white/5 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                                                    <span>Evaluated By: {log.reporter_name || log.expand?.reported_by?.name || 'Staff'}</span>
                                                                    {log.submission_id && (
                                                                        <a href={`/admin/forms/submissions/${log.submission_id}`} className="text-indigo-400 hover:underline">Reference Form</a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {conservationLogs.length === 0 && (
                                                            <div className="py-20 text-center opacity-20">No conservation reports found.</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* Sidebar (Right) */}
                        <div className="lg:col-span-4 space-y-6">
                            <section className="glass-panel rounded-3xl p-8 border border-white/5 bg-indigo-600/5 relative overflow-hidden">
                                <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/10 blur-3xl rounded-full"></div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-6">Internal Identity</h4>
                                <div className="space-y-6 relative z-10">
                                    <div>
                                        <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Catalog Number</div>
                                        <div className="text-2xl font-black text-white tracking-tight">#{selected.catalog_number}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Accession Proof</div>
                                        <div className="text-sm font-mono text-zinc-300">{selected.expand?.accession_id?.accession_number}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Current Lifecycle</div>
                                        <div className={`mt-2 inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${ITEM_STATUS_COLORS[selected.status] || ITEM_STATUS_COLORS.active}`}>
                                            {selected.status.replace(/_/g, ' ')}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="glass-panel rounded-3xl p-8 border border-white/5">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Technical Specifications</h4>
                                <div className="space-y-4">
                                    <DetailRow label="Materials" value={selected.expand?.accession_id?.materials} />
                                    <DetailRow label="Dimensions" value={selected.expand?.accession_id?.dimensions} />
                                    <DetailRow label="Legal Framework" value={selected.expand?.accession_id?.legal_status} />
                                    <DetailRow label="Contract Type" value={selected.expand?.accession_id?.contract_type?.replace(/_/g, ' ')} caps />
                                </div>
                            </section>

                            <section className="glass-panel rounded-3xl p-8 border border-white/5">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Location Summary</h4>
                                <div className="space-y-4">
                                    <DetailRow label="Zone" value={selected.current_location || 'Receiving Bay'} />
                                    <DetailRow label="Last Update" value={new Date(selected.updated).toLocaleDateString()} />
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRow({ label, value, caps }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-[10px] uppercase font-bold text-zinc-600">{label}</span>
            <span className={`text-xs text-zinc-300 text-right ${caps ? 'capitalize' : ''}`}>{value || '—'}</span>
        </div>
    );
}

function TabButton({ active, onClick, label }) {
    return (
        <button 
            onClick={onClick}
            className={`px-8 py-5 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                active 
                ? 'text-white' 
                : 'text-zinc-600 hover:text-zinc-400'
            }`}
        >
            {label}
            {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 animate-in fade-in slide-in-from-bottom-1 duration-300"></div>}
        </button>
    );
}
