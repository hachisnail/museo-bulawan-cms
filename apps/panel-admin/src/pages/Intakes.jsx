import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';
import DocxPreview from '../components/DocxPreview';
import Modal from '../components/Modal';
import QRCode from 'qrcode';

// --- Helper Functions to extract donor details from expanded objects ---
const getIntakeDonorEmail = (intake) => {
    if (intake.expand?.donor_account_id?.email) {
        return intake.expand.donor_account_id.email;
    }
    if (intake.expand?.submission_id) {
        const sub = intake.expand.submission_id;
        const subData = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data;
        return subData?.donor_email || subData?.email;
    }
    return null;
};

const getIntakeDonorPhone = (intake) => {
    if (intake.expand?.donor_account_id?.phone) {
        return intake.expand.donor_account_id.phone;
    }
    if (intake.expand?.submission_id) {
        const sub = intake.expand.submission_id;
        const subData = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data;
        return subData?.donor_phone || subData?.phone;
    }
    return null;
};

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
    const [method, setMethod] = useState('gift');

    // Custom Modal State
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info', onConfirm: null, promptValue: '' });
    const [locations, setLocations] = useState([]);
    const [showLocationSelect, setShowLocationSelect] = useState(false);
    
    // Lists
    const [intakes, setIntakes] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    
    // States
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [selected, setSelected] = useState(null); 
    
    // UI Helpers
    const [moaDraft, setMoaDraft] = useState(null);
    const [clientQrImage, setClientQrImage] = useState('');
    const [verifyToken, setVerifyToken] = useState('');
    const [verifyResult, setVerifyResult] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [scanActive, setScanActive] = useState(false);
    const scannerRef = useRef(null);

    // Internal Form
    const [isRegistering, setIsRegistering] = useState(false);
    const [itemName, setItemName] = useState('');
    const [sourceInfo, setSourceInfo] = useState('');
    const [internalDescription, setInternalDescription] = useState('');
    const [loanEndDate, setLoanEndDate] = useState('');

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [iRes, sRes] = await Promise.all([
                apiFetch('/api/v1/acquisitions/intakes?expand=donation_item_id'),
                apiFetch('/api/v1/forms/admin/submissions?status=pending&expand=form_id')
            ]);
            const iJson = await iRes.json();
            const sJson = await sRes.json();
            
            if (iJson.status === 'success') setIntakes(iJson.data.items);
            if (sJson.status === 'success') {
                const enriched = sJson.data.items.map(s => {
                    let parsedData = {};
                    if (s.data && typeof s.data === 'string') {
                        try { parsedData = JSON.parse(s.data); } catch(e) {}
                    } else if (s.data && typeof s.data === 'object') {
                        parsedData = s.data;
                    }
                    return { ...s, parsedData };
                });
                const donationOnly = enriched.filter(s => 
                    s.form_slug === 'donation-form' || 
                    s.expand?.form_id?.type === 'donation'
                );
                setSubmissions(donationOnly);
            }

            const lRes = await apiFetch('/api/v1/acquisitions/locations');
            const lJson = await lRes.json();
            if (lJson.status === 'success') setLocations(lJson.data);
        } catch (err) {
            console.error("Failed to fetch acquisition data", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    const handleSelectRecord = async (type, item) => {
        setActionLoading(true);
        setSelected(null); // Clear previous
        setIsRegistering(false); // Dismiss registration form
        setSearchParams({ id: item.id, tab: activeTab });
        try {
            let endpoint = type === 'submission' 
                ? `/api/v1/forms/admin/submissions/${item.id}` 
                : `/api/v1/acquisitions/intakes/${item.id}?expand=donation_item_id,donor_account_id,submission_id`;
            let mediaType = type === 'submission' ? 'submission' : 'intake';

            const res = await apiFetch(endpoint);
            const json = await res.json();
            
            if (json.status === 'success') {
                try {
                    const mRes = await apiFetch(`/api/v1/media/${mediaType}/${item.id}`);
                    const mData = await mRes.json();
                    
                    if (type === 'submission') {
                        const sub = json.data.submission;
                        if (sub && typeof sub.data === 'string') {
                            try {
                                sub.data = JSON.parse(sub.data);
                            } catch (e) {
                                console.error("Error parsing submission data JSON", e);
                            }
                        }
                        setSelected({ type, data: sub, items: json.data.items, media: mData.data?.items || [] });
                    } else {
                        setSelected({ type, data: json.data, media: mData.data?.items || [] });
                    }
                } catch (e) {
                    let sub = type === 'submission' ? json.data.submission : json.data;
                    if (type === 'submission' && sub && typeof sub.data === 'string') {
                        try {
                            sub.data = JSON.parse(sub.data);
                        } catch (err2) {}
                    }
                    setSelected({ type, data: sub, media: [] });
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
        if (events.length > 0) fetchData(true);
    }, [events, fetchData]);

    // Handle initial selection from URL params
    useEffect(() => {
        const id = searchParams.get('id');
        const tab = searchParams.get('tab');
        if (id) {
            if (tab && tab !== activeTab) {
                setActiveTab(tab);
                return;
            }
            
            let item = null;
            let type = 'intake';
            
            if (activeTab === 'submissions') {
                item = submissions.find(s => s.id === id);
                type = 'submission';
            } else if (activeTab === 'intakes') {
                item = intakes.find(i => i.id === id);
                type = 'intake';
            } else if (activeTab === 'archive') {
                item = intakes.find(i => i.id === id) || submissions.find(s => s.id === id);
                type = item?.proposed_item_name ? 'intake' : 'submission';
            }
            
            if (item && selected?.data?.id !== id) {
                handleSelectRecord(type, item);
            }
        }
    }, [searchParams, intakes, submissions, activeTab, selected, handleSelectRecord]);

    // Client-side QR Code generation fallback
    useEffect(() => {
        if (moaDraft?.qrPayload?.token && !moaDraft.qrImageBase64) {
            QRCode.toDataURL(moaDraft.qrPayload.token, {
                width: 250,
                margin: 2,
                color: {
                    dark: '#1A1A1A',
                    light: '#FFFFFF'
                }
            }).then(url => {
                setClientQrImage(url);
            }).catch(err => {
                console.error("Failed to generate QR client-side", err);
            });
        } else {
            setClientQrImage('');
        }
    }, [moaDraft]);

    // Dynamic scanner logic
    useEffect(() => {
        let isCurrent = true;
        
        const initScanner = () => {
            if (!document.getElementById("qr-reader")) {
                // Retry in next tick if element is not in DOM yet
                setTimeout(initScanner, 50);
                return;
            }
            if (window.Html5Qrcode && isCurrent) {
                try {
                    const html5Qrcode = new window.Html5Qrcode("qr-reader");
                    scannerRef.current = html5Qrcode;
                    html5Qrcode.start(
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 }
                        },
                        async (decodedText) => {
                            const cleanToken = decodedText.trim().toUpperCase();
                            setVerifyToken(cleanToken);
                            setScanActive(false);
                            
                            // Automatically fetch verification result if token has correct length (8)
                            if (cleanToken.length === 8) {
                                setIsVerifying(true);
                                try {
                                    const res = await apiFetch(`/api/v1/acquisitions/delivery/verify/${cleanToken}`);
                                    const json = await res.json();
                                    if (res.ok) setVerifyResult(json.data);
                                } catch (e) {
                                    console.error("Scanner verify fetch failed", e);
                                } finally {
                                    setIsVerifying(false);
                                }
                            }
                        },
                        () => {} // Silent scan error
                    ).catch(err => {
                        console.error("Failed to start QR scanner:", err);
                        setScanActive(false);
                    });
                } catch (e) {
                    console.error("Error setting up Html5Qrcode:", e);
                    setScanActive(false);
                }
            }
        };

        if (scanActive && moaDraft?.isVerifyModal) {
            if (!window.Html5Qrcode) {
                // Prevent duplicate loading scripts
                const existingScript = document.getElementById('html5-qrcode-script');
                if (!existingScript) {
                    const script = document.createElement('script');
                    script.id = 'html5-qrcode-script';
                    script.src = "https://unpkg.com/html5-qrcode";
                    script.onload = initScanner;
                    document.body.appendChild(script);
                } else {
                    // Wait for it to load
                    const checkInterval = setInterval(() => {
                        if (window.Html5Qrcode) {
                            clearInterval(checkInterval);
                            initScanner();
                        }
                    }, 100);
                }
            } else {
                initScanner();
            }
        } else {
            if (scannerRef.current) {
                const currentScanner = scannerRef.current;
                if (currentScanner.isScanning) {
                    currentScanner.stop().catch(() => {});
                }
                scannerRef.current = null;
            }
        }

        return () => {
            isCurrent = false;
            if (scannerRef.current) {
                const currentScanner = scannerRef.current;
                if (currentScanner.isScanning) {
                    currentScanner.stop().catch(() => {});
                }
                scannerRef.current = null;
            }
        };
    }, [scanActive, moaDraft, apiFetch]);

    const handleInternalRegister = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await apiFetch('/api/v1/acquisitions/intakes/internal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    itemName, 
                    sourceInfo,
                    description: internalDescription,
                    method, 
                    loanEndDate: method === 'loan' ? loanEndDate : null 
                })
            });
            if (!res.ok) throw new Error('Failed to create intake');
            setItemName(''); setSourceInfo(''); setInternalDescription(''); setMethod('gift'); setLoanEndDate(''); setIsRegistering(false);
            fetchData();
        } catch (error) {
            setModal({ isOpen: true, title: 'Error', message: 'Error creating record.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleAction = async (id, action, body = {}) => {
        // Actions that open the MOA modal directly — skip generic confirm dialog
        const skipConfirm = ['moa', 'approve_and_generate', 'accept_and_issue'];
        if (!skipConfirm.includes(action)) {
            setModal({
                isOpen: true,
                title: 'Confirm Action',
                message: `Are you sure you want to proceed with: ${action.replace(/-/g, ' ')}?`,
                type: 'confirm',
                onConfirm: () => executeAction(id, action, body)
            });
            return;
        }
        executeAction(id, action, body);
    };

    const executeAction = async (id, action, body = {}) => {
        setModal({ ...modal, isOpen: false });
        setActionLoading(true);
        try {
            if (action === 'approve_and_generate') {
                const appRes = await apiFetch(`/api/v1/acquisitions/intakes/${id}/approve`, { method: 'POST' });
                if (!appRes.ok) throw new Error('Failed to approve intake');
                
                const moaRes = await apiFetch(`/api/v1/acquisitions/intakes/${id}/generate-moa`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: Object.keys(body).length ? JSON.stringify(body) : undefined
                });
                const json = await moaRes.json();
                if (moaRes.ok) setMoaDraft(json);
                else throw new Error(json.error || 'Failed to generate MOA');
            } else if (action === 'accept_and_issue') {
                // One-click path: process submission → approve → generate MOA in a single API call
                const res = await apiFetch(`/api/v1/acquisitions/intakes/external/${id}/accept-and-issue`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: Object.keys(body).length ? JSON.stringify(body) : undefined
                });
                const json = await res.json();
                if (res.ok) {
                    setMoaDraft(json);
                    fetchData();
                } else {
                    throw new Error(json.error || 'Failed to accept and issue documents');
                }
            } else {
                let endpoint = '';
                if (selected.type === 'submission') {
                    if (action === 'process') endpoint = `/api/v1/acquisitions/intakes/external/${id}`;
                    else if (action === 'reject') endpoint = `/api/v1/acquisitions/submissions/${id}/reject`;
                    else if (action === 'reopen') endpoint = `/api/v1/acquisitions/submissions/${id}/reopen`;
                } else {
                    endpoint = `/api/v1/acquisitions/intakes/${id}/${action === 'moa' ? 'generate-moa' : (action === 'delivery' ? 'confirm-delivery' : action)}`;
                }
                
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
                    setModal({
                        isOpen: true,
                        title: 'Action Failed',
                        message: json.error || 'The requested operation could not be completed.',
                        type: 'alert',
                        variant: 'error'
                    });
                }
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: err.message || 'System request failed.', type: 'alert', variant: 'error' });
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
            else setModal({ isOpen: true, title: 'Verification Failed', message: json.error || 'Invalid code.', type: 'alert', variant: 'error' });
        } catch (err) {
            setModal({ isOpen: true, title: 'Verification Failed', message: 'Verification failed.', type: 'alert', variant: 'error' });
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
                const json = await res.json(); setModal({ isOpen: true, title: 'Error', message: json.error || 'Failed to confirm.', type: 'alert', variant: 'error' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Request failed.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            
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

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-full lg:w-1/3 flex flex-col gap-4">
                    <div className="flex border-b border-zinc-200">
                        <button 
                            onClick={() => { setActiveTab('submissions'); setSelected(null); setSearchParams({ tab: 'submissions' }); }}
                            className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'submissions' ? 'border-[#D4AF37] text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                        >
                            Offers ({submissions.filter(s => s.status !== 'archived').length})
                        </button>
                        <button 
                            onClick={() => { setActiveTab('intakes'); setSelected(null); setSearchParams({ tab: 'intakes' }); }}
                            className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'intakes' ? 'border-[#D4AF37] text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                        >
                            Intakes ({intakes.filter(i => i.status !== 'rejected').length})
                        </button>
                        <button 
                            onClick={() => { setActiveTab('archive'); setSelected(null); setSearchParams({ tab: 'archive' }); }}
                            className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'archive' ? 'border-[#D4AF37] text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                        >
                            Archive
                        </button>
                    </div>

                    <div className="border border-zinc-200 bg-white rounded-sm divide-y divide-zinc-100 h-[700px] overflow-y-auto">
                        {activeTab === 'intakes' && !isRegistering && (
                            <button 
                                onClick={() => { setIsRegistering(true); setSelected(null); }}
                                className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-black transition-colors border-b border-zinc-100 bg-zinc-50/50"
                            >
                                + Add Manual Intake
                            </button>
                        )}

                        {loading ? (
                            <div className="p-8 text-center text-xs text-zinc-400 uppercase tracking-widest animate-pulse">Updating Registry...</div>
                        ) : (
                            (() => {
                                let list = [];
                                if (activeTab === 'submissions') list = submissions.filter(s => s.status !== 'archived');
                                else if (activeTab === 'intakes') list = intakes.filter(i => i.status !== 'rejected');
                                else if (activeTab === 'archive') {
                                    list = [
                                        ...submissions.filter(s => s.status === 'archived').map(s => ({ ...s, _type: 'submission' })),
                                        ...intakes.filter(i => i.status === 'rejected').map(i => ({ ...i, _type: 'intake' }))
                                    ];
                                }

                                if (list.length === 0) return <div className="p-12 text-center text-xs text-zinc-400 italic">No records found.</div>;

                                return list.sort((a, b) => new Date(b.created) - new Date(a.created)).map((item) => {
                                    const isSelected = selected?.data?.id === item.id;
                                    const type = item._type || activeTab.slice(0, -1);
                                    return (
                                        <button 
                                            key={item.id} 
                                            onClick={() => handleSelectRecord(type, item)}
                                            className={`w-full p-5 text-left transition-colors flex flex-col gap-2 border-l-4 ${isSelected ? 'bg-zinc-50 border-[#D4AF37]' : 'bg-white border-transparent hover:bg-zinc-50'}`}
                                        >
                                            <div className="flex justify-between items-start w-full">
                                                <div className="font-bold text-[13px] text-black line-clamp-1 pr-4">
                                                    {type === 'submission' ? (
                                                        item.parsedData?.artifact_name || 
                                                        (item.parsedData?.is_anonymous === true ? 'Anonymous Offer' : `${item.parsedData?.donor_first_name || ''} ${item.parsedData?.donor_last_name || ''}`.trim()) || 
                                                        item.submitted_by || 'Anonymous Offer'
                                                    ) : item.proposed_item_name}
                                                </div>
                                                <span className={`flex-shrink-0 px-2 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-widest border ${STATUS_STYLES[item.status] || STATUS_STYLES.pending}`}>
                                                    {item.status.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">
                                                {type === 'submission' ? (item.form_title || item.expand?.form_id?.title || 'Standard Submission') : item.donor_info || item.source_info}
                                            </div>
                                        </button>
                                    );
                                });
                            })()
                        )}
                    </div>
                </div>

                <div className="w-full lg:w-2/3">
                    {isRegistering ? (
                        <div className="border border-zinc-200 bg-white rounded-sm flex flex-col h-[600px] p-8 shadow-sm">
                            <div className="border-b border-zinc-200 pb-4 mb-6 flex justify-between items-center bg-zinc-50 -mx-8 -mt-8 p-8 rounded-t-sm">
                                <div>
                                    <h2 className="text-2xl font-serif text-black uppercase tracking-wider leading-tight">Register Manual Intake</h2>
                                    <p className="text-xs text-zinc-500 mt-1 font-light">Record an offline or legacy acquisition directly.</p>
                                </div>
                                <button onClick={() => setIsRegistering(false)} className="p-3 bg-white border border-zinc-300 rounded-sm hover:bg-zinc-50 transition-all text-zinc-400 hover:text-black">✕</button>
                            </div>
                            <form onSubmit={handleInternalRegister} className="flex-1 flex flex-col justify-between space-y-6 overflow-y-auto pr-1">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Artifact / Item Name</label>
                                        <input 
                                            type="text" required value={itemName} onChange={(e) => setItemName(e.target.value)}
                                            className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-medium"
                                            placeholder="e.g. Pre-colonial Gold Mask"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Source / Donor Information</label>
                                        <input 
                                            type="text" required value={sourceInfo} onChange={(e) => setSourceInfo(e.target.value)}
                                            className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-medium"
                                            placeholder="e.g. Donated by Jefferson Reyes, Purchased from Sotheby's"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Description <span className="text-zinc-300 font-normal normal-case">(optional)</span></label>
                                        <textarea
                                            value={internalDescription} onChange={(e) => setInternalDescription(e.target.value)}
                                            rows={3}
                                            placeholder="Brief physical description or provenance notes..."
                                            className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all resize-none placeholder:text-zinc-400 font-light"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Acquisition Method</label>
                                            <select 
                                                value={method} onChange={(e) => setMethod(e.target.value)}
                                                className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-medium"
                                            >
                                                <option value="gift">Gift</option>
                                                <option value="loan">Loan</option>
                                                <option value="purchase">Purchase</option>
                                                <option value="existing">Existing in Collection</option>
                                            </select>
                                        </div>
                                        {method === 'loan' && (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Loan End Date</label>
                                                <input 
                                                    type="date" required value={loanEndDate} onChange={(e) => setLoanEndDate(e.target.value)}
                                                    className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-medium"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button type="submit" disabled={actionLoading} className="w-full py-4 bg-black text-[#D4AF37] rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all flex items-center justify-center gap-2 mt-auto">
                                    {actionLoading ? 'Saving...' : 'Save Manual Intake Record'}
                                </button>
                            </form>
                        </div>
                    ) : !selected ? (
                        <div className="h-[600px] border border-zinc-200 bg-zinc-50 flex items-center justify-center rounded-sm">
                            <p className="text-sm font-serif italic text-zinc-400">Select a record from the queue to view details.</p>
                        </div>
                    ) : (
                        <div className="border border-zinc-200 bg-white rounded-sm flex flex-col h-[600px]">
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

                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                <div className="grid grid-cols-2 gap-6">
                                                                   <div>
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-1">Source / Donor</label>
                                        <div className="text-sm text-black font-medium">
                                            {selected.type === 'submission' 
                                                ? (selected.data.data.is_anonymous === true ? 'Anonymous Donor' : `${selected.data.data.donor_first_name || ''} ${selected.data.data.donor_last_name || ''}`.trim() || selected.data.submitted_by)
                                                : selected.data.donor_info || selected.data.source_info}
                                        </div>
                                        <div className="text-xs text-zinc-500 mt-1">
                                            {selected.type === 'submission'
                                                ? (selected.data.data.is_anonymous === true ? selected.data.data.donor_email : selected.data.data?.donor_email || 'No email provided')
                                                : (getIntakeDonorEmail(selected.data) || 'No email provided')}
                                        </div>
                                        {selected.type === 'submission' && selected.data.data.is_anonymous !== true && selected.data.data.donor_phone && (
                                            <div className="text-[11px] text-zinc-500 mt-1">Phone: {selected.data.data.donor_phone}</div>
                                        )}
                                        {selected.type === 'intake' && getIntakeDonorPhone(selected.data) && (
                                            <div className="text-[11px] text-zinc-500 mt-1">Phone: {getIntakeDonorPhone(selected.data)}</div>
                                        )}
                                        {selected.type === 'intake' && (
                                            <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
                                                <label className="text-[9px] uppercase font-bold tracking-widest text-zinc-400 block">Visitor Portal</label>
                                                {selected.data.donor_account_id ? (
                                                    <div className="flex items-center gap-2 text-xs text-green-700 font-bold bg-green-50 border border-green-200/50 px-2 py-1.5 rounded-sm">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                                        Active Portal Account Linked
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200/50 px-2 py-1.5 rounded-sm">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                                                        Account Provisioned on Approval
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-1">Method</label>
                                        <div className="text-sm text-black font-medium uppercase tracking-wider">
                                            {selected.type === 'submission' ? selected.data.data.acquisition_type || 'Gift' : selected.data.acquisition_method}
                                        </div>
                                        {((selected.type === 'submission' ? selected.data.data.acquisition_type : selected.data.acquisition_method)?.toLowerCase() === 'loan') && (
                                            <div className="text-xs text-amber-600 font-bold mt-1 uppercase tracking-wider">
                                                Loan Return: {selected.type === 'submission'
                                                    ? (selected.data.data.loan_end_date ? new Date(selected.data.data.loan_end_date).toLocaleDateString() : 'No Limit')
                                                    : (selected.data.loan_end_date ? new Date(selected.data.loan_end_date).toLocaleDateString() : 'No Limit')}
                                            </div>
                                        )}
                                        <div className="text-xs text-zinc-500 mt-1">
                                            Logged: {new Date(selected.data.created).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="col-span-2 pt-4 border-t border-zinc-100 flex items-center justify-between">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-1">Current Physical Location</label>
                                            {(() => {
                                                // For donation/loan intakes not yet delivered, the artifact is not in the museum.
                                                // Only show a real location once status is in_custody or beyond.
                                                const isDeliveryPending = selected.type === 'intake' &&
                                                    ['gift', 'loan', 'bequest'].includes((selected.data.acquisition_method || '').toLowerCase()) &&
                                                    ['under_review', 'approved', 'awaiting_delivery'].includes(selected.data.status);

                                                if (isDeliveryPending) {
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-sm">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Awaiting Delivery — Not Yet Received</span>
                                                            </span>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="text-sm text-black font-bold flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-[#D4AF37]"></span>
                                                        {selected.data.current_location || 'Not Specified (Check Receiving)'}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        {/* Set Location: only available once the artifact is physically in the museum */}
                                        {selected.type === 'intake' &&
                                            ['in_custody', 'accessioned', 'processed'].includes(selected.data.status) && (
                                            <div className="relative">
                                                <button 
                                                    onClick={() => setShowLocationSelect(!showLocationSelect)}
                                                    className="text-[9px] font-black uppercase tracking-[0.2em] text-[#A68A27] bg-[#D4AF37]/10 px-3 py-1.5 rounded-sm hover:bg-[#D4AF37]/20 transition-all border border-[#D4AF37]/30"
                                                >
                                                    Set Location
                                                </button>
                                                
                                                {showLocationSelect && (
                                                    <div className="absolute right-0 bottom-full mb-2 w-64 bg-white border border-zinc-300 rounded-sm shadow-2xl z-50 p-2 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                        <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500 p-3 border-b border-zinc-200 bg-zinc-50">Select Pre-set Location</div>
                                                        <div className="max-h-48 overflow-y-auto">
                                                            {locations.map(loc => (
                                                                <button 
                                                                    key={loc.id}
                                                                    onClick={async () => {
                                                                        setShowLocationSelect(false);
                                                                        try {
                                                                            const res = await apiFetch(`/api/v1/acquisitions/intakes/${selected.data.id}/location`, {
                                                                                method: 'PATCH',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({ location: loc.name })
                                                                            });
                                                                            if (res.ok) handleSelectRecord('intake', selected.data);
                                                                        } catch (e) {}
                                                                    }}
                                                                    className="w-full text-left p-3 hover:bg-zinc-50 transition-colors flex flex-col gap-0.5 rounded-sm"
                                                                >
                                                                    <div className="text-[10px] font-bold text-black">{loc.name}</div>
                                                                    <div className="text-[8px] text-zinc-400 uppercase tracking-tighter">{loc.type}</div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

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

                                {selected.media?.length > 0 && (
                                    <div className="pt-4 border-t border-zinc-100">
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-3">Attached Documents & Photos</label>
                                        <div className="flex gap-4 overflow-x-auto pb-2">
                                            {selected.media.map(m => (
                                                <a 
                                                    key={m.id} 
                                                    href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${selected.type === 'submission' ? 'submission' : 'intake'}/${selected.data.id}/${m.file_name}`}
                                                    target="_blank" rel="noreferrer"
                                                    className="relative flex-shrink-0 w-32 h-32 border border-zinc-200 rounded-sm overflow-hidden group bg-zinc-100"
                                                >
                                                    <img src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${selected.type === 'submission' ? 'submission' : 'intake'}/${selected.data.id}/${m.file_name}`} className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" alt="Attachment" />
                                                    <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[8px] text-white font-mono truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {m.file_name}
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-3">
                                {actionLoading && <span className="text-xs text-zinc-400 uppercase tracking-widest self-center mr-auto ml-2">Processing...</span>}
                                
                                {selected.data.status === 'pending' && selected.type === 'submission' && (
                                    <>
                                        <button 
                                            onClick={() => setModal({ 
                                                isOpen: true, 
                                                title: 'Decline Offer', 
                                                message: 'Provide a reason for declining this donation offer:', 
                                                type: 'prompt', 
                                                variant: 'warning', 
                                                onConfirm: (val) => executeAction(selected.data.id, 'reject', { reason: val }) 
                                            })} 
                                            className="px-6 py-3 bg-white border border-red-200 text-red-700 text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-colors rounded-sm"
                                        >
                                            Decline Offer
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const itemName = selected.data.parsedData?.artifact_name || 
                                                    (selected.data.parsedData?.is_anonymous ? 'Anonymous Offer' : 
                                                    `${selected.data.parsedData?.donor_first_name || ''} ${selected.data.parsedData?.donor_last_name || ''}`.trim()) ||
                                                    'this offer';
                                                setModal({
                                                    isOpen: true,
                                                    title: 'Accept Donation & Issue Documents',
                                                    message: `Accept "${itemName}" and immediately generate the Deed of Gift and Delivery Slip for the donor? This will send documents to the donor's email.`,
                                                    type: 'confirm',
                                                    variant: 'info',
                                                    onConfirm: () => executeAction(selected.data.id, 'accept_and_issue')
                                                });
                                            }}
                                            className="px-6 py-3 bg-black text-[#D4AF37] text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 transition-colors rounded-sm flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Accept &amp; Issue Documents
                                        </button>
                                    </>
                                )}
                                
                                {selected.data.status === 'rejected' && (
                                    <button onClick={() => handleAction(selected.data.id, 'reopen')} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm">
                                        Reopen for Review
                                    </button>
                                )}

                                {selected.data.status === 'archived' && (
                                    <button onClick={() => handleAction(selected.data.id, 'reopen')} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm">
                                        Restore Submission
                                    </button>
                                )}

                                {selected.data.status === 'under_review' && (
                                    <>
                                        <button onClick={() => setModal({ isOpen: true, title: 'Decline Offer', message: 'Provide a reason for rejection:', type: 'prompt', variant: 'warning', onConfirm: (val) => handleAction(selected.data.id, 'reject', { reason: val }) })} className="px-6 py-3 bg-white border border-red-200 text-red-700 text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-colors rounded-sm">
                                            Decline Offer
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const donor = selected.type === 'submission' ? `${selected.data.data.donor_first_name} ${selected.data.data.donor_last_name}` : selected.data.donor_info;
                                                setModal({ isOpen: true, title: 'Approve Acquisition', message: `Approve and generate legal documents for ${donor}?`, type: 'confirm', onConfirm: () => handleAction(selected.data.id, 'approve_and_generate', { donorName: donor }) });
                                            }} 
                                            className="px-6 py-3 bg-black text-[#D4AF37] text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 transition-colors rounded-sm"
                                        >
                                            Approve & Generate MOA
                                        </button>
                                    </>
                                )}

                                {selected.data.status === 'approved' && (
                                    <button onClick={() => handleAction(selected.data.id, 'moa')} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm">
                                        Issue Deed of Gift & Slip
                                    </button>
                                )}

                                {selected.data.status === 'awaiting_delivery' && (
                                    <div className="flex items-center gap-3 w-full justify-end">
                                        <button 
                                            onClick={() => handleAction(selected.data.id, 'rollback')}
                                            className="px-4 py-3 bg-white border border-zinc-200 text-zinc-500 text-xs font-bold uppercase tracking-widest hover:text-black transition-colors rounded-sm"
                                            title="Return to Review if documents need correction"
                                        >
                                            Rollback to Review
                                        </button>
                                        <div className="flex-1" />
                                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mr-2 text-right">
                                            Awaiting physical delivery
                                        </div>
                                        <a 
                                            href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/acquisitions/intakes/${selected.data.id}/export-moa`}
                                            target="_blank" rel="noreferrer"
                                            className="px-6 py-3 bg-white border border-zinc-300 text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors rounded-sm flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            Export MOA for Printing
                                        </a>
                                    </div>
                                )}

                                {selected.data.status === 'in_custody' && (
                                    <div className="flex gap-3">
                                        <a 
                                            href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/acquisitions/intakes/${selected.data.id}/export-moa`}
                                            target="_blank" rel="noreferrer"
                                            className="px-6 py-3 bg-white border border-zinc-300 text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors rounded-sm flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            Print MOA
                                        </a>
                                        <button onClick={() => setModal({ isOpen: true, title: 'Accession Artifact', message: 'Enter condition notes:', type: 'prompt', variant: 'info', onConfirm: (val) => handleAction(selected.data.id, 'accession', { handlingInstructions: val }) })} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm">
                                            Begin Formal Accession
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {moaDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
                    <div className={`bg-white w-full ${moaDraft.docxData ? 'max-w-4xl' : 'max-w-xl'} border border-zinc-200 rounded-sm shadow-2xl flex flex-col max-h-[90vh]`}>
                        
                        <div className="p-6 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                            <h3 className="font-serif text-xl text-black tracking-wide">
                                {moaDraft.isVerifyModal ? 'Delivery Verification' : 'Legal Documentation'}
                            </h3>
                            <button onClick={() => { setMoaDraft(null); setScanActive(false); setVerifyToken(''); setVerifyResult(null); fetchData(); }} className="text-zinc-400 hover:text-black">✕</button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto">
                            {moaDraft.isVerifyModal ? (
                                <div className="space-y-6">
                                    <p className="text-sm text-zinc-500">Ask the donor for the 8-character verification code printed on their delivery slip, or scan the QR code from their portal.</p>
                                    
                                    {scanActive && (
                                         <div className="relative border border-zinc-300 rounded-sm bg-black overflow-hidden aspect-square max-w-sm mx-auto mb-4">
                                             <div id="qr-reader" className="w-full h-full"></div>
                                         </div>
                                    )}
                                    
                                    <div className="flex justify-center">
                                         <button 
                                             type="button" 
                                             onClick={() => setScanActive(!scanActive)} 
                                             className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-sm transition-all cursor-pointer ${scanActive ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100' : 'border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'}`}
                                         >
                                             {scanActive ? 'Stop Camera' : 'Scan QR Code'}
                                         </button>
                                    </div>

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
                                <div className="space-y-6">
                                    <div className="flex flex-col lg:flex-row gap-8">
                                        {moaDraft.docxData && (
                                            <div className="flex-1">
                                                <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-3">Document Preview (Template Based)</label>
                                                <DocxPreview base64Data={moaDraft.docxData} />
                                            </div>
                                        )}

                                        <div className={`w-full ${moaDraft.docxData ? 'lg:w-80' : ''} space-y-6`}>
                                            <div className="w-16 h-16 mx-auto bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <div className="text-center">
                                                <h4 className="text-xl font-serif text-black mb-2">Documents Generated</h4>
                                                <p className="text-sm text-zinc-500">The Deed of Gift and Delivery Slip have been sent to the donor.</p>
                                            </div>

                                            <button onClick={() => { setMoaDraft(null); fetchData(); setSelected(null); }} className="w-full bg-black hover:bg-zinc-800 text-[#D4AF37] font-bold py-4 rounded-sm uppercase tracking-widest text-xs transition-colors cursor-pointer">
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Modal 
                {...modal} 
                onClose={() => setModal({ ...modal, isOpen: false })}
                onInputChange={(val) => setModal({ ...modal, promptValue: val })}
                inputValue={modal.promptValue}
            />
        </div>
    );
}