import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';

// --- Theme Status Colors ---
const STATUS_STYLES = {
    pending: 'text-[#A68A27] bg-[#D4AF37]/10 border-[#D4AF37]/30',
    under_review: 'text-[#A68A27] bg-[#D4AF37]/10 border-[#D4AF37]/30',
    awaiting_delivery: 'text-zinc-600 bg-zinc-100 border-zinc-300',
    in_custody: 'text-zinc-600 bg-zinc-100 border-zinc-300',
    approved: 'text-green-700 bg-green-50 border-green-200',
    accessioned: 'text-black bg-zinc-200 border-black',
    rejected: 'text-red-700 bg-red-50 border-red-200',
    processed: 'text-black bg-zinc-100 border-zinc-300',
    archived: 'text-zinc-400 bg-white border-zinc-200'
};

export default function Intakes() {
    const { apiFetch } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const { events } = useSSE('intakes');
    const [activeTab, setActiveTab] = useState('submissions'); // 'submissions' | 'intakes'
    
    // Lists
    const [intakes, setIntakes] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    
    // States
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [selected, setSelected] = useState(null); 
    
    // UI Helpers
    const [moaDraft, setMoaDraft] = useState(null);
    const [verifyToken, setVerifyToken] = useState('');
    const [verifyResult, setVerifyResult] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);

    // Internal Form
    const [isRegistering, setIsRegistering] = useState(false);
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
                const donationOnly = sJson.data.items.filter(s => s.expand?.form_id?.type === 'donation');
                setSubmissions(donationOnly);
            }
        } catch (err) {
            console.error("Failed to fetch acquisition data", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    const handleSelectRecord = async (type, item) => {
        setActionLoading(true);
        setSelected(null); // Clear previous
        try {
            let endpoint = type === 'submission' 
                ? `/api/v1/forms/admin/submissions/${item.id}` 
                : `/api/v1/acquisitions/intakes/${item.id}?expand=donation_item_id`;
            let mediaType = type === 'submission' ? 'submission' : 'intake';

            const res = await apiFetch(endpoint);
            const json = await res.json();
            
            if (json.status === 'success') {
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
                                caption: 'Donor Documents'
                            });
                        }
                        setSelected({ type, data: json.data.submission, items: json.data.items, media: [...submissionMedia, ...(mData.data?.items || [])] });
                    } else {
                        setSelected({ type, data: json.data, media: mData.data?.items || [] });
                    }
                } catch (e) {
                    setSelected({ type, data: type === 'submission' ? json.data.submission : json.data, media: [] });
                }
            }
        } catch (err) {
            console.error("Failed to fetch details", err);
        } finally {
            setActionLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (events.length > 0) fetchData();
    }, [events, fetchData]);

    // Handle initial selection from URL params
    useEffect(() => {
        const id = searchParams.get('id');
        if (id && intakes.length > 0) {
            const item = intakes.find(i => i.id === id);
            if (item) {
                setActiveTab('intakes');
                handleSelectRecord('intake', item);
            }
        }
    }, [searchParams, intakes, handleSelectRecord]);

    const displayIntakes = [...intakes].sort((a, b) => new Date(b.created) - new Date(a.created));

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
            setItemName(''); setSourceInfo(''); setMethod('gift'); setIsRegistering(false);
            fetchData();
        } catch (error) {
            alert('Error creating record.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAction = async (id, action, body = {}) => {
        if (action !== 'moa' && !confirm(`Are you sure you want to proceed with: ${action.replace(/-/g, ' ')}?`)) return;
        setActionLoading(true);
        try {
            let endpoint = selected.type === 'submission' 
                ? `/api/v1/acquisitions/intakes/external/${id}` 
                : `/api/v1/acquisitions/intakes/${id}/${action === 'moa' ? 'generate-moa' : (action === 'delivery' ? 'confirm-delivery' : action)}`;
            
            if (action === 'accession') endpoint = `/api/v1/acquisitions/accessions/from-intake/${id}`;

            const res = await apiFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: Object.keys(body).length ? JSON.stringify(body) : undefined
            });
            const json = await res.json();
            
            if (res.ok) {
                if (action === 'moa') setMoaDraft(json);
                else { fetchData(); setSelected(null); }
            } else {
                alert(json.error || 'Action failed.');
            }
        } catch (err) {
            alert('System request failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleVerifyToken = async (e) => {
        if (e) e.preventDefault();
        setIsVerifying(true); setVerifyResult(null);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/delivery/verify/${verifyToken}`);
            const json = await res.json();
            if (res.ok) setVerifyResult(json.data);
            else alert(json.error || 'Invalid code.');
        } catch (err) {
            alert('Verification failed.');
        } finally {
            setIsVerifying(false);
        }
    };

    const confirmVerifiedDelivery = async () => {
        if (!verifyResult) return;
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/intakes/${verifyResult.id}/confirm-delivery`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: verifyToken })
            });
            if (res.ok) {
                setVerifyResult(null); setVerifyToken(''); setMoaDraft(null); fetchData();
            } else {
                const json = await res.json(); alert(json.error || 'Failed to confirm.');
            }
        } catch (err) {
            alert('Request failed.');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            
            {/* --- Header --- */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-zinc-200 pb-6">
                <div>
                    <h1 className="text-2xl font-serif text-black uppercase tracking-widest">Acquisitions</h1>
                    <p className="text-sm text-zinc-500 mt-1 font-light">Evaluate, review, and process artifact intake.</p>
                </div>
                <button 
                    onClick={() => { setVerifyToken(''); setVerifyResult(null); setMoaDraft({ isVerifyModal: true }); }}
                    className="bg-black hover:bg-zinc-800 text-white px-5 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Verify Delivery
                </button>
            </header>

            {/* --- Main Workspace (Two Columns) --- */}
            <div className="flex flex-col lg:flex-row gap-8 items-start">
                
                {/* LEFT: Queue (List) */}
                <div className="w-full lg:w-1/3 flex flex-col gap-4">
                    
                    {/* Tabs */}
                    <div className="flex border-b border-zinc-200">
                        <button 
                            onClick={() => { setActiveTab('submissions'); setSelected(null); }}
                            className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'submissions' ? 'border-[#D4AF37] text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                        >
                            Public Offers
                        </button>
                        <button 
                            onClick={() => { setActiveTab('intakes'); setSelected(null); }}
                            className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'intakes' ? 'border-[#D4AF37] text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                        >
                            Active Processing
                        </button>
                    </div>

                    {/* Internal Registration Trigger */}
                    {activeTab === 'intakes' && (
                        <button 
                            onClick={() => setIsRegistering(!isRegistering)}
                            className="w-full py-3 border border-dashed border-zinc-300 text-zinc-500 text-xs font-bold uppercase tracking-widest hover:border-black hover:text-black transition-colors rounded-sm"
                        >
                            + Add Manual Intake
                        </button>
                    )}

                    {/* Internal Registration Form */}
                    {isRegistering && activeTab === 'intakes' && (
                        <form onSubmit={handleInternalRegister} className="bg-zinc-50 border border-zinc-200 p-4 rounded-sm space-y-4">
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Artifact Name</label>
                                <input type="text" required value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Donor / Source</label>
                                <input type="text" required value={sourceInfo} onChange={(e) => setSourceInfo(e.target.value)} className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-600 mb-1">Method</label>
                                <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full border border-zinc-300 rounded-sm px-3 py-2 text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none bg-white">
                                    <option value="gift">Gift</option>
                                    <option value="loan">Loan</option>
                                    <option value="purchase">Purchase</option>
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsRegistering(false)} className="flex-1 py-2 text-xs font-bold uppercase text-zinc-500 hover:text-black">Cancel</button>
                                <button type="submit" disabled={actionLoading} className="flex-1 py-2 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-zinc-800 disabled:opacity-50">Save</button>
                            </div>
                        </form>
                    )}

                    {/* List */}
                    <div className="border border-zinc-200 bg-white rounded-sm divide-y divide-zinc-100 h-[600px] overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-xs text-zinc-400 uppercase tracking-widest">Updating Database...</div>
                        ) : (activeTab === 'intakes' ? displayIntakes : submissions).length === 0 ? (
                            <div className="p-8 text-center text-xs text-zinc-400 uppercase tracking-widest">No pending records.</div>
                        ) : (
                            (activeTab === 'intakes' ? displayIntakes : submissions).map((item) => {
                                const isSelected = selected?.data?.id === item.id;
                                return (
                                    <button 
                                        key={item.id} 
                                        onClick={() => handleSelectRecord(activeTab.slice(0, -1), item)}
                                        className={`w-full p-4 text-left transition-colors flex flex-col gap-2 border-l-2 ${isSelected ? 'bg-zinc-50 border-[#D4AF37]' : 'bg-white border-transparent hover:bg-zinc-50'}`}
                                    >
                                        <div className="flex justify-between items-start w-full">
                                            <div className="font-bold text-sm text-black line-clamp-1 pr-4">
                                                {activeTab === 'submissions' ? (item.submitted_by || 'Anonymous Offer') : item.proposed_item_name}
                                            </div>
                                            <span className={`flex-shrink-0 px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-widest border ${STATUS_STYLES[item.status] || STATUS_STYLES.pending}`}>
                                                {item.status.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <div className="text-xs text-zinc-500 font-light line-clamp-1">
                                            {activeTab === 'submissions' ? item.expand?.form_id?.title : item.donor_info || item.source_info}
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
                        <div className="h-[600px] border border-zinc-200 bg-zinc-50 flex items-center justify-center rounded-sm">
                            <p className="text-sm font-serif italic text-zinc-400">Select a record from the queue to view details.</p>
                        </div>
                    ) : (
                        <div className="border border-zinc-200 bg-white rounded-sm flex flex-col h-[600px]">
                            
                            {/* Detail Header */}
                            <div className="p-6 border-b border-zinc-200 bg-zinc-50 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Record ID: {selected.data.id}</span>
                                        <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-widest border ${STATUS_STYLES[selected.data.status]}`}>
                                            {selected.data.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-serif text-black uppercase tracking-wider leading-tight">
                                        {selected.type === 'submission' ? (selected.data.data.artifact_name || 'Unnamed Offer') : selected.data.proposed_item_name}
                                    </h2>
                                </div>
                            </div>

                            {/* Detail Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                
                                {/* Donor & Acquisition Info */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-1">Source / Donor</label>
                                        <div className="text-sm text-black font-medium">
                                            {selected.type === 'submission' 
                                                ? `${selected.data.data.donor_first_name || ''} ${selected.data.data.donor_last_name || ''}`.trim() || selected.data.submitted_by 
                                                : selected.data.donor_info || selected.data.source_info}
                                        </div>
                                        <div className="text-xs text-zinc-500 mt-1">
                                            {selected.data.data?.donor_email || selected.data.email || 'No email provided'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-1">Method</label>
                                        <div className="text-sm text-black font-medium uppercase tracking-wider">
                                            {selected.type === 'submission' ? selected.data.data.acquisition_type || 'Gift' : selected.data.acquisition_method}
                                        </div>
                                        <div className="text-xs text-zinc-500 mt-1">
                                            Logged: {new Date(selected.data.created).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Texts */}
                                <div className="space-y-4 pt-4 border-t border-zinc-100">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-2">Physical Description</label>
                                        <div className="text-sm text-black leading-relaxed font-serif bg-zinc-50 p-4 border border-zinc-200">
                                            {selected.type === 'submission' ? selected.data.data.artifact_description : selected.data.description || 'No description provided.'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-2">Provenance / History</label>
                                        <div className="text-sm text-black leading-relaxed bg-zinc-50 p-4 border border-zinc-200">
                                            {selected.type === 'submission' ? selected.data.data.artifact_provenance : selected.data.provenance || 'No historical background provided.'}
                                        </div>
                                    </div>
                                </div>

                                {/* Media */}
                                {selected.media?.length > 0 && (
                                    <div className="pt-4 border-t border-zinc-100">
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-3">Attached Documents & Photos</label>
                                        <div className="flex gap-4 overflow-x-auto pb-2">
                                            {selected.media.map(m => (m.files || []).map((file, idx) => (
                                                <a 
                                                    key={`${m.id}-${idx}`} 
                                                    href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`}
                                                    target="_blank" rel="noreferrer"
                                                    className="relative flex-shrink-0 w-32 h-32 border border-zinc-200 rounded-sm overflow-hidden group bg-zinc-100"
                                                >
                                                    <img src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${m.collectionId}/${m.id}/${file}`} className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" alt="Attachment" />
                                                    <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[8px] text-white font-mono truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {file}
                                                    </div>
                                                </a>
                                            )))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Actions Footer */}
                            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-3">
                                {actionLoading && <span className="text-xs text-zinc-400 uppercase tracking-widest self-center mr-auto ml-2">Processing...</span>}
                                
                                {selected.data.status === 'pending' && selected.type === 'submission' && (
                                    <button onClick={() => handleAction(selected.data.id, 'process')} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm">
                                        Move to Intake Pipeline
                                    </button>
                                )}
                                
                                {selected.data.status === 'under_review' && (
                                    <>
                                        <button onClick={() => { const r = prompt('Reason for rejection?'); if(r) handleAction(selected.data.id, 'reject', { reason: r }); }} className="px-6 py-3 bg-white border border-red-200 text-red-700 text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-colors rounded-sm">
                                            Decline Offer
                                        </button>
                                        <button onClick={() => handleAction(selected.data.id, 'approve')} className="px-6 py-3 bg-black text-[#D4AF37] text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 transition-colors rounded-sm">
                                            Approve Acquisition
                                        </button>
                                    </>
                                )}

                                {selected.data.status === 'approved' && (
                                    <button onClick={() => handleAction(selected.data.id, 'moa')} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm">
                                        Issue Deed of Gift & Slip
                                    </button>
                                )}

                                {selected.data.status === 'awaiting_delivery' && (
                                    <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold self-center mr-4">
                                        Pending physical delivery. Use "Verify Delivery" button.
                                    </div>
                                )}

                                {selected.data.status === 'in_custody' && (
                                    <button onClick={() => { const n = prompt('Enter condition notes:'); if(n!==null) handleAction(selected.data.id, 'accession', { handlingInstructions: n }); }} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm">
                                        Begin Formal Accession
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- Document Generator / Verifier Modal --- */}
            {moaDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-xl border border-zinc-200 rounded-sm shadow-2xl flex flex-col max-h-[90vh]">
                        
                        <div className="p-6 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                            <h3 className="font-serif text-xl text-black tracking-wide">
                                {moaDraft.isVerifyModal ? 'Delivery Verification' : 'Legal Documentation'}
                            </h3>
                            <button onClick={() => { setMoaDraft(null); fetchData(); }} className="text-zinc-400 hover:text-black">✕</button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto">
                            {moaDraft.isVerifyModal ? (
                                <div className="space-y-6">
                                    <p className="text-sm text-zinc-500">Ask the donor for the 8-character verification code printed on their delivery slip.</p>
                                    <form onSubmit={handleVerifyToken} className="flex gap-3">
                                        <input 
                                            type="text" required value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)}
                                            className="flex-1 border border-zinc-300 rounded-sm px-4 py-3 text-lg font-mono text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] uppercase tracking-widest"
                                            placeholder="ENTER CODE"
                                        />
                                        <button type="submit" disabled={isVerifying} className="bg-black hover:bg-zinc-800 text-white px-8 rounded-sm font-bold uppercase tracking-widest text-xs disabled:opacity-50">
                                            {isVerifying ? 'Checking' : 'Verify'}
                                        </button>
                                    </form>

                                    {verifyResult && (
                                        <div className="bg-zinc-50 border border-zinc-200 rounded-sm p-6 space-y-6 mt-6">
                                            <div>
                                                <h4 className="font-bold text-lg text-black">{verifyResult.proposed_item_name}</h4>
                                                <p className="text-sm text-zinc-500">Donor: {verifyResult.donor_info}</p>
                                            </div>
                                            <button 
                                                onClick={confirmVerifiedDelivery} disabled={actionLoading}
                                                className="w-full bg-black hover:bg-zinc-800 text-[#D4AF37] font-bold py-4 rounded-sm uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
                                            >
                                                Confirm Physical Receipt
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6 text-center">
                                    <div className="w-16 h-16 mx-auto bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-serif text-black mb-2">Documents Generated</h4>
                                        <p className="text-sm text-zinc-500">The Deed of Gift and Delivery Slip have been sent to the donor's email.</p>
                                    </div>
                                    <div className="bg-zinc-50 p-6 border border-zinc-200 rounded-sm text-left space-y-4">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-1">Donor Verification Code</label>
                                            <div className="font-mono text-xl text-black">{moaDraft.qrPayload.token.substring(0, 8).toUpperCase()}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-1">Slip Reference</label>
                                            <div className="text-sm text-zinc-600">{moaDraft.deliverySlipId}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => { setMoaDraft(null); fetchData(); setSelected(null); }} className="w-full bg-black text-white font-bold py-4 rounded-sm uppercase tracking-widest text-xs hover:bg-zinc-800 transition-colors">
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}