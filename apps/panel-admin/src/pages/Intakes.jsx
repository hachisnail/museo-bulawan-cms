import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';

const STATUS_COLORS = {
    // Submissions
    pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    processed: 'text-green-400 bg-green-500/10 border-green-500/20',
    archived: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
    // Intakes
    under_review: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    awaiting_delivery: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    in_custody: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    approved: 'text-green-400 bg-green-500/10 border-green-500/20',
    rejected: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    accessioned: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
};

export default function Intakes() {
    const { apiFetch } = useAuth();
    const { events } = useSSE('intakes');
    const [activeTab, setActiveTab] = useState('intakes'); // 'submissions' | 'intakes'
    
    // Lists
    const [intakes, setIntakes] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    
    // Loading states
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Selection
    const [selected, setSelected] = useState(null); // { type: 'submission'|'intake', data: {} }
    
    // UI Helpers
    const [moaDraft, setMoaDraft] = useState(null);
    const [verifyToken, setVerifyToken] = useState('');
    const [verifyResult, setVerifyResult] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);

    // Registration Form
    const [itemName, setItemName] = useState('');
    const [sourceInfo, setSourceInfo] = useState('');
    const [method, setMethod] = useState('gift');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [iRes, sRes] = await Promise.all([
                apiFetch('/api/v1/acquisitions/intakes?expand=donation_item_id'),
                apiFetch('/api/v1/forms/admin/submissions?status=pending')
            ]);
            const iJson = await iRes.json();
            const sJson = await sRes.json();
            
            if (iJson.status === 'success') setIntakes(iJson.data.items);
            if (sJson.status === 'success') {
                // Filter for donation-type forms only
                const donationOnly = sJson.data.items.filter(s => s.expand?.form_id?.type === 'donation');
                setSubmissions(donationOnly);
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
            console.log("Real-time update received, refreshing data...");
            fetchData();
        }
    }, [events, fetchData]);

    const displayIntakes = [...intakes]
        .sort((a, b) => new Date(b.created) - new Date(a.created));

    const handleInternalRegister = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await apiFetch('/api/v1/acquisitions/intakes/internal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemName, sourceInfo, method })
            });
            if (!res.ok) throw new Error('Failed to create intake');
            setItemName(''); setSourceInfo(''); setMethod('gift');
            fetchData();
        } catch (error) {
            alert('Error creating intake');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSelectRecord = async (type, item) => {
        setActionLoading(true);
        try {
            let endpoint = '';
            let mediaType = '';
            
            if (type === 'submission') {
                endpoint = `/api/v1/forms/admin/submissions/${item.id}`;
                mediaType = 'submission';
            } else {
                endpoint = `/api/v1/acquisitions/intakes/${item.id}?expand=donation_item_id`;
                mediaType = 'intake';
            }

            const res = await apiFetch(endpoint);
            const json = await res.json();
            
            if (json.status === 'success') {
                // Fetch media for this record
                try {
                    const mRes = await apiFetch(`/api/v1/media/${mediaType}/${item.id}`);
                    const mData = await mRes.json();
                    
                    if (type === 'submission') {
                        const submissionMedia = [];
                        const rawFiles = json.data.submission.attachments || json.data.submission.supporting_documents || [];
                        
                        if (rawFiles.length > 0) {
                            submissionMedia.push({
                                collectionId: json.data.submission.collectionId,
                                id: json.data.submission.id,
                                files: rawFiles,
                                caption: 'Donor Provided Documentation'
                            });
                        }

                        setSelected({ 
                            type, 
                            data: json.data.submission, 
                            items: json.data.items,
                            media: [...submissionMedia, ...(mData.data?.items || [])]
                        });
                    } else {
                        setSelected({ 
                            type, 
                            data: json.data, 
                            media: mData.data?.items || []
                        });
                    }
                } catch (e) {
                    if (type === 'submission') {
                        setSelected({ type, data: json.data.submission, items: json.data.items, media: [] });
                    } else {
                        setSelected({ type, data: json.data, media: [] });
                    }
                }
            }
        } catch (err) {
            console.error("Failed to fetch record details", err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAction = async (id, action, body = {}) => {
        if (action !== 'moa' && !confirm(`Are you sure you want to ${action.replace(/-/g, ' ')} this?`)) return;
        setActionLoading(true);
        try {
            let endpoint = '';
            if (selected.type === 'submission') {
                endpoint = `/api/v1/acquisitions/intakes/external/${id}`;
            } else {
                // Determine sub-domain based on action
                if (['approve', 'reject', 'reopen', 'moa', 'delivery', 'generate-moa', 'rollback', 'confirm-delivery'].includes(action)) {
                    const actionName = action === 'moa' ? 'generate-moa' : (action === 'delivery' ? 'confirm-delivery' : action);
                    endpoint = `/api/v1/acquisitions/intakes/${id}/${actionName}`;
                } else if (action === 'accession') {
                    endpoint = `/api/v1/acquisitions/accessions/from-intake/${id}`;
                }
            }
            
            const res = await apiFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: Object.keys(body).length ? JSON.stringify(body) : undefined
            });
            const json = await res.json();
            
            if (res.ok) {
                if (action === 'moa') {
                    setMoaDraft(json);
                } else {
                    alert('Action successful');
                    fetchData();
                    setSelected(null);
                }
            } else {
                alert(json.error || 'Action failed');
            }
        } catch (err) {
            alert('Request failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleVerifyToken = async (e) => {
        if (e) e.preventDefault();
        setIsVerifying(true);
        setVerifyResult(null);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/delivery/verify/${verifyToken}`);
            const json = await res.json();
            if (res.ok) {
                setVerifyResult(json.data);
            } else {
                alert(json.error || 'Invalid token');
            }
        } catch (err) {
            alert('Verification failed');
        } finally {
            setIsVerifying(false);
        }
    };

    const confirmVerifiedDelivery = async () => {
        if (!verifyResult) return;
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/intakes/${verifyResult.id}/confirm-delivery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: verifyToken })
            });
            if (res.ok) {
                alert('Delivery confirmed successfully!');
                setVerifyResult(null);
                setVerifyToken('');
                setMoaDraft(null);
                fetchData();
            } else {
                const json = await res.json();
                alert(json.error || 'Confirmation failed');
            }
        } catch (err) {
            alert('Request failed');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Acquisition Pipeline</h1>
                    <p className="text-[var(--text-secondary)] mt-1">Manage artifacts from initial submission to formal intake.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => { setVerifyToken(''); setVerifyResult(null); setMoaDraft({ isVerifyModal: true }); }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border border-white/5 flex items-center gap-2"
                    >
                        🔍 Verify Delivery Slip
                    </button>
                </div>
            </header>

            {/* Tab Switcher */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl w-fit">
                <button 
                    onClick={() => setActiveTab('submissions')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'submissions' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-white'}`}
                >
                    Pending Submissions ({submissions.length})
                </button>
                <button 
                    onClick={() => setActiveTab('intakes')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'intakes' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-white'}`}
                >
                    Active Intakes ({displayIntakes.length})
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* List Section */}
                <div className="lg:col-span-8 space-y-8">
                    {activeTab === 'intakes' && (
                        <form onSubmit={handleInternalRegister} className="glass-panel p-6 rounded-2xl flex flex-wrap gap-4 items-end bg-indigo-500/5 animate-in slide-in-from-top-4 duration-300">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[10px] uppercase tracking-wider font-bold text-indigo-400 mb-1">Item Name</label>
                                <input 
                                    type="text" required value={itemName} onChange={(e) => setItemName(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="Object title..."
                                />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[10px] uppercase tracking-wider font-bold text-indigo-400 mb-1">Donor/Source</label>
                                <input 
                                    type="text" required value={sourceInfo} onChange={(e) => setSourceInfo(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="Jefferson Talagtag..."
                                />
                            </div>
                            <div className="w-32">
                                <label className="block text-[10px] uppercase tracking-wider font-bold text-indigo-400 mb-1">Method</label>
                                <select 
                                    value={method} onChange={(e) => setMethod(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="gift">Gift</option>
                                    <option value="loan">Loan</option>
                                    <option value="purchase">Purchase</option>
                                </select>
                            </div>
                            <button 
                                type="submit" disabled={actionLoading}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white h-[42px] px-6 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                            >
                                + Register Internal
                            </button>
                        </form>
                    )}

                    <div className="glass-panel rounded-2xl overflow-hidden min-h-[400px]">
                        <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                            <h3 className="font-semibold text-sm capitalize">{activeTab} Queue</h3>
                            <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-[10px] uppercase tracking-widest text-zinc-500">Live Sync</span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-20 text-center text-zinc-500">Loading pipeline...</div>
                        ) : (activeTab === 'intakes' ? displayIntakes : submissions).length === 0 ? (
                            <div className="p-20 text-center text-zinc-500">No records found in this queue.</div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {(activeTab === 'intakes' ? displayIntakes : submissions).map((item) => (
                                    <button 
                                        key={item.id} 
                                        onClick={() => handleSelectRecord(activeTab.slice(0, -1), item)}
                                        className={`w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors group ${selected?.data?.id === item.id ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : ''}`}
                                    >
                                        <div className="flex items-center gap-4 text-left">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl grayscale group-hover:grayscale-0 transition-all">
                                                {activeTab === 'submissions' ? '📬' : (item.acquisition_method === 'loan' ? '📦' : '🎁')}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-zinc-200">
                                                    {activeTab === 'submissions' ? (item.submitted_by || 'Anonymous') : item.proposed_item_name}
                                                </div>
                                                <div className="text-xs text-zinc-500 mt-0.5">
                                                    {activeTab === 'submissions' 
                                                        ? `From: ${item.expand?.form_id?.title || 'External Form'}` 
                                                        : `Source: ${item.donor_info || item.source_info}`
                                                    } • {new Date(item.created).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[item.status]}`}>
                                            {item.status.replace(/_/g, ' ')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Processing Panel */}
                <div className="lg:col-span-4">
                    <div className="glass-panel rounded-2xl sticky top-8 overflow-hidden min-h-[500px]">
                        {!selected ? (
                            <div className="p-16 text-center text-zinc-500">
                                <div className="text-5xl mb-4 opacity-10">🏛️</div>
                                <p className="text-sm italic">Select a record to view details and process.</p>
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className={`p-6 border-b border-white/5 ${selected.type === 'submission' ? 'bg-amber-500/5' : 'bg-indigo-500/5'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-lg">{selected.type === 'submission' ? 'Review Submission' : 'Process Intake'}</h3>
                                        <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white">✕</button>
                                    </div>
                                    <div className="space-y-3">
                                        <DetailRow label="Record ID" value={selected.data.id} mono />
                                        <DetailRow label="Type" value={selected.type} caps />
                                        <DetailRow label="Status" value={selected.data.status} status />
                                    </div>
                                </div>

                                <div className="p-6 space-y-6">
                                    {selected.type === 'submission' ? (
                                        <div className="space-y-6">
                                            {/* Top Level Identity */}
                                            <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-5">
                                                <label className="text-[9px] uppercase font-bold text-indigo-400 block mb-1">Proposed Artifact</label>
                                                <div className="text-xl font-black text-white tracking-tight">
                                                    {selected.data.data.artifact_name || selected.data.data.item_name || 'Unnamed Submission'}
                                                </div>
                                            </div>

                                            {/* Donor Profile */}
                                            <div>
                                                <h4 className="text-[10px] uppercase font-bold text-zinc-500 mb-3 flex items-center gap-2">
                                                    <span>👤</span> Donor Profile
                                                </h4>
                                                <div className="bg-black/20 rounded-2xl p-4 space-y-3 border border-white/5">
                                                    <DetailRow 
                                                        label="Full Name" 
                                                        value={selected.data.data.donor_first_name 
                                                            ? `${selected.data.data.donor_first_name} ${selected.data.data.donor_last_name || ''}` 
                                                            : (selected.data.submitted_by || 'Anonymous')} 
                                                    />
                                                    <DetailRow 
                                                        label="Email" 
                                                        value={selected.data.data.donor_email || selected.data.email || 'N/A'} 
                                                    />
                                                    <DetailRow label="Phone" value={selected.data.data.donor_phone || 'N/A'} />
                                                    <DetailRow label="Method" value={selected.data.data.acquisition_type || 'GIFT'} caps />
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-[10px] uppercase font-bold text-zinc-500 mb-3">Item Specification</h4>
                                                <div className="space-y-4">
                                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                                        <label className="text-[9px] uppercase font-bold text-zinc-600 block mb-2">Physical Description</label>
                                                        <div className="text-sm text-zinc-200 leading-relaxed italic">
                                                            "{selected.data.data.artifact_description || 'No description provided.'}"
                                                        </div>
                                                    </div>
                                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                                        <label className="text-[9px] uppercase font-bold text-zinc-600 block mb-2">Provenance & History</label>
                                                        <div className="text-sm text-zinc-400 leading-relaxed">
                                                            {selected.data.data.artifact_provenance || 'No provenance history.'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {selected.media?.length > 0 && (
                                                <div className="pt-4">
                                                    <h4 className="text-[10px] uppercase font-bold text-indigo-400 mb-3">Supporting Documents</h4>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {selected.media.map((m) => (
                                                            (m.files || []).map((file, idx) => (
                                                                <div key={`${m.id}-${idx}`} className="group relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                                                                    <img 
                                                                        src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`}
                                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                                                                        <p className="text-[9px] text-white/50 mb-2 font-mono truncate w-full text-center">{file}</p>
                                                                        <a 
                                                                            href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`}
                                                                            target="_blank" 
                                                                            rel="noreferrer"
                                                                            className="px-4 py-2 bg-white text-black rounded-lg text-[9px] font-black uppercase tracking-widest shadow-xl"
                                                                        >
                                                                            View Original
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {selected.items?.length > 0 && (
                                                <div>
                                                    <h4 className="text-[10px] uppercase font-bold text-zinc-500 mb-3">Linked Donation Items ({selected.items.length})</h4>
                                                    <div className="space-y-2">
                                                        {selected.items.map((item) => (
                                                            <div key={item.id} className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3">
                                                                <div className="font-bold text-sm text-indigo-300">{item.item_name}</div>
                                                                {item.description && <div className="text-[11px] text-zinc-400 mt-1 italic">{item.description}</div>}
                                                                <div className="flex justify-between mt-2 text-[10px] uppercase tracking-wider font-bold">
                                                                    <span className="text-zinc-500">Qty: {item.quantity}</span>
                                                                    <span className="text-zinc-500">{item.status}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {selected.data.status === 'pending' && (
                                                <ActionButton 
                                                    label="📥 Process into Intake Pipeline" color="bg-amber-600 shadow-amber-500/20" 
                                                    onClick={() => handleAction(selected.data.id, 'process')} 
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {selected.data.expand?.donation_item_id && (
                                                <div>
                                                    <h4 className="text-[10px] uppercase font-bold text-zinc-500 mb-3">Linked Artifact Info</h4>
                                                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4">
                                                        <div className="font-bold text-sm text-indigo-300 mb-1">{selected.data.expand.donation_item_id.item_name}</div>
                                                        <div className="text-xs text-zinc-400 italic mb-3">
                                                            {selected.data.expand.donation_item_id.description || 'No original description provided.'}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5 text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                                                            <div>QTY: {selected.data.expand.donation_item_id.quantity}</div>
                                                            <div>Initial Status: {selected.data.expand.donation_item_id.status}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {selected.media?.length > 0 && (
                                                <div>
                                                    <h4 className="text-[10px] uppercase font-bold text-indigo-400 mb-3">Attached Visuals</h4>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {selected.media.map((m) => (
                                                            (m.files || []).map((file, idx) => (
                                                                <a 
                                                                    key={`${m.id}-${idx}`} 
                                                                    href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`}
                                                                    target="_blank" rel="noreferrer"
                                                                    className="aspect-square rounded-lg bg-black/40 border border-white/10 overflow-hidden hover:border-indigo-500 transition-colors"
                                                                >
                                                                    <img src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`} className="w-full h-full object-cover" />
                                                                </a>
                                                            ))
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Pipeline Control</h4>
                                            
                                            {selected.data.status === 'under_review' && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <ActionButton 
                                                        label="Approve" color="bg-green-600" 
                                                        onClick={() => handleAction(selected.data.id, 'approve')} 
                                                    />
                                                    <ActionButton 
                                                        label="Reject" color="bg-rose-600" 
                                                        onClick={() => {
                                                            const reason = prompt('Reason for rejection?');
                                                            if (reason) handleAction(selected.data.id, 'reject', { reason });
                                                        }} 
                                                    />
                                                </div>
                                            )}

                                            {selected.data.status === 'approved' && (
                                                <ActionButton 
                                                    label="Generate MOA & Slip" color="bg-indigo-600" 
                                                    onClick={() => handleAction(selected.data.id, 'moa')} 
                                                />
                                            )}

                                            {selected.data.status === 'awaiting_delivery' && (
                                                <div className="space-y-3">
                                                    <ActionButton 
                                                        label="Confirm Delivery" color="bg-green-600" 
                                                        onClick={() => {
                                                            const token = prompt('Enter Verification Token:');
                                                            if (token) handleAction(selected.data.id, 'delivery', { token });
                                                        }} 
                                                    />
                                                    <ActionButton 
                                                        label="Rollback to Terms" color="bg-zinc-700" 
                                                        onClick={() => handleAction(selected.data.id, 'rollback')} 
                                                    />
                                                </div>
                                            )}

                                            {selected.data.status === 'in_custody' && (
                                                <div className="space-y-3 text-center">
                                                    <div className="text-[10px] text-green-400 font-medium bg-green-500/10 p-3 rounded-lg border border-green-500/20 mb-4">
                                                        Artifact Received. Ready for Accessioning.
                                                    </div>
                                                    <ActionButton 
                                                        label="Start Formal Accession" color="bg-white text-black" 
                                                        onClick={() => {
                                                            const notes = prompt('Enter initial curatorial notes:');
                                                            if (notes !== null) handleAction(selected.data.id, 'accession', { handlingInstructions: notes });
                                                        }} 
                                                    />
                                                </div>
                                            )}

                                            {selected.data.status === 'rejected' && (
                                                <ActionButton 
                                                    label="Reopen for Review" color="bg-indigo-600" 
                                                    onClick={() => handleAction(selected.data.id, 'reopen')} 
                                                />
                                            )}

                                            {selected.data.status === 'accessioned' && (
                                                <p className="text-center text-xs text-zinc-500 italic py-4">
                                                    Item has moved to the Accession stage.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Submission Detail Modal (Window) */}
            {selected?.type === 'submission' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="glass-panel w-full max-w-6xl max-h-[90vh] rounded-[40px] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
                        {/* Modal Header */}
                        <header className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] font-black text-amber-500 uppercase tracking-widest">External Submission</span>
                                    <span className="text-[10px] text-zinc-500 font-mono">ID: {selected.data.id}</span>
                                </div>
                                <h2 className="text-3xl font-black text-white tracking-tight">
                                    {selected.data.data.artifact_name || selected.data.data.item_name || 'Unnamed Submission'}
                                </h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setSelected(null)}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => handleAction(selected.data.id, 'process')}
                                    className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-indigo-500/40 transition-all active:scale-95"
                                >
                                    Process into Intake Pipeline
                                </button>
                            </div>
                        </header>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-10">
                            <div className="grid grid-cols-12 gap-12">
                                {/* Left Side: Details */}
                                <div className="col-span-12 lg:col-span-7 space-y-12">
                                    {/* Artifact Specification */}
                                    <section className="space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-xl">📦</div>
                                            <h3 className="text-lg font-black uppercase tracking-widest text-zinc-400">Artifact Specification</h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/5">
                                                <label className="text-[10px] uppercase font-black text-zinc-600 block mb-3">Proposed Acquisition</label>
                                                <div className="text-sm font-bold text-indigo-400 uppercase tracking-wider">
                                                    {selected.data.data.acquisition_type || 'Gift'}
                                                </div>
                                            </div>
                                            <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/5">
                                                <label className="text-[10px] uppercase font-black text-zinc-600 block mb-3">Submission Date</label>
                                                <div className="text-sm font-bold text-zinc-300">
                                                    {new Date(selected.data.created).toLocaleDateString(undefined, { dateStyle: 'long' })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] uppercase font-black text-zinc-600 block mb-3">Physical Description</label>
                                                <div className="bg-white/[0.03] p-8 rounded-[32px] border border-white/5 text-lg text-zinc-200 leading-relaxed font-serif italic">
                                                    "{selected.data.data.artifact_description || 'No physical description provided.'}"
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-black text-zinc-600 block mb-3">Provenance & Historical Background</label>
                                                <div className="text-base text-zinc-400 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-indigo-500/30">
                                                    {selected.data.data.artifact_provenance || 'No historical provenance provided by donor.'}
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Linked Items (if any) */}
                                    {selected.items?.length > 0 && (
                                        <section className="space-y-6">
                                            <h4 className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Inventory Pre-registration</h4>
                                            <div className="space-y-3">
                                                {selected.items.map(item => (
                                                    <div key={item.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex justify-between items-center">
                                                        <div>
                                                            <div className="font-bold text-sm text-white">{item.item_name}</div>
                                                            <div className="text-[10px] text-zinc-500">Qty: {item.quantity}</div>
                                                        </div>
                                                        <span className="text-[9px] font-black uppercase px-2 py-1 bg-zinc-800 rounded border border-white/5">{item.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>

                                {/* Right Side: Media & Profile */}
                                <div className="col-span-12 lg:col-span-5 space-y-12">
                                    {/* Media Gallery */}
                                    <section className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-xl">🖼️</div>
                                            <h3 className="text-lg font-black uppercase tracking-widest text-zinc-400">Donor Attachments</h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {selected.media.length > 0 ? (
                                                selected.media.map((m) => (
                                                    (m.files || []).map((file, idx) => (
                                                        <div key={`${m.id}-${idx}`} className="group relative aspect-video rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                                                            <img 
                                                                src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`}
                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                            />
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center p-4">
                                                                <p className="text-[9px] text-white/50 mb-3 font-mono truncate w-full text-center">{file}</p>
                                                                <a 
                                                                    href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`}
                                                                    target="_blank" rel="noreferrer"
                                                                    className="px-6 py-2 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-transform"
                                                                >
                                                                    Open Full Res
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ))
                                                ))
                                            ) : (
                                                <div className="col-span-2 py-20 text-center border-2 border-dashed border-white/5 rounded-[40px] opacity-20">
                                                    No media attached.
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    {/* Donor Profile Card */}
                                    <section className="bg-indigo-600/5 rounded-[40px] p-8 border border-indigo-500/10 space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-xl">👤</div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-300">Donor Profile</h3>
                                        </div>
                                        
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[9px] uppercase font-black text-zinc-600 block mb-1">Full Legal Name</label>
                                                <div className="text-xl font-bold text-white tracking-tight">
                                                    {selected.data.data.donor_title || ''} {selected.data.data.donor_first_name} {selected.data.data.donor_last_name}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[9px] uppercase font-black text-zinc-600 block mb-1">Email Address</label>
                                                    <div className="text-sm text-indigo-400 font-medium truncate">{selected.data.data.donor_email || selected.data.email}</div>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] uppercase font-black text-zinc-600 block mb-1">Phone Number</label>
                                                    <div className="text-sm text-zinc-300">{selected.data.data.donor_phone || 'N/A'}</div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[9px] uppercase font-black text-zinc-600 block mb-1">Mailing Address</label>
                                                <div className="text-[11px] text-zinc-400 leading-relaxed italic">
                                                    {selected.data.data.donor_address || 'Address not provided.'}
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Verification / MOA Modal */}
            {moaDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="glass-panel w-full max-w-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className={`p-6 border-b border-white/10 flex justify-between items-center ${moaDraft.isVerifyModal ? 'bg-zinc-800' : 'bg-indigo-600'}`}>
                            <h3 className="font-bold text-xl">{moaDraft.isVerifyModal ? 'Verify Delivery Slip' : 'Legal Documents Generated'}</h3>
                            <button onClick={() => setMoaDraft(null)} className="hover:rotate-90 transition-transform">✕</button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            {moaDraft.isVerifyModal ? (
                                <div className="space-y-6">
                                    <form onSubmit={handleVerifyToken} className="flex gap-3">
                                        <input 
                                            type="text" required value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)}
                                            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-lg font-mono text-white focus:outline-none focus:border-indigo-500 uppercase tracking-widest"
                                            placeholder="ENTER TOKEN (E.G. A1B2C3D4)"
                                        />
                                        <button 
                                            type="submit" disabled={isVerifying}
                                            className="bg-indigo-600 hover:bg-indigo-500 px-6 rounded-xl font-bold disabled:opacity-50"
                                        >
                                            {isVerifying ? 'Checking...' : 'Verify'}
                                        </button>
                                    </form>

                                    {verifyResult && (
                                        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center gap-4">
                                                <div className="text-3xl">📦</div>
                                                <div>
                                                    <h4 className="font-bold text-lg text-white">{verifyResult.proposed_item_name}</h4>
                                                    <p className="text-xs text-zinc-400">Donor: {verifyResult.donor_info}</p>
                                                </div>
                                                <div className="ml-auto">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[verifyResult.status]}`}>
                                                        {verifyResult.status.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={confirmVerifiedDelivery} disabled={actionLoading}
                                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl mt-4 transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
                                            >
                                                Confirm Physical Delivery
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="bg-black/40 rounded-2xl p-6 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap border border-white/5">
                                        {moaDraft.moaDraft}
                                    </div>
                                    <div className="grid grid-cols-2 gap-6 items-center">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold text-zinc-500">Verification Token</label>
                                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 font-mono text-lg text-center text-indigo-400">
                                                {moaDraft.qrPayload.token.substring(0, 8).toUpperCase()}
                                            </div>
                                            <p className="text-[10px] text-zinc-500">Provide this code to the donor for delivery.</p>
                                        </div>
                                        <div className="space-y-3">
                                            <DetailRow label="Slip ID" value={moaDraft.deliverySlipId} mono />
                                            <DetailRow label="Contract" value={moaDraft.contractType} caps />
                                            <button 
                                                onClick={() => { setMoaDraft(null); fetchData(); setSelected(null); }}
                                                className="w-full bg-white text-black font-bold py-3 rounded-xl mt-2 hover:bg-zinc-200 transition-all shadow-xl"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRow({ label, value, mono, caps, status }) {
    return (
        <div className="flex justify-between text-xs">
            <span className="text-zinc-500">{label}</span>
            <span className={`text-zinc-200 ${mono ? 'font-mono' : ''} ${caps ? 'capitalize' : ''} ${status ? 'font-bold text-indigo-400' : ''}`}>
                {value}
            </span>
        </div>
    );
}

function ActionButton({ label, color, onClick }) {
    return (
        <button 
            onClick={onClick}
            className={`w-full py-3 ${color} hover:opacity-90 text-white text-xs font-bold rounded-xl transition-all shadow-lg active:scale-95`}
        >
            {label}
        </button>
    );
}
