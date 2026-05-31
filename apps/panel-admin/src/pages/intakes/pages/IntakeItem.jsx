import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import Modal from '../../../components/Modal';
import MoaDialog from '../../../components/Intakes/MoaDialog';
import { STATUS_STYLES } from '../../../components/Intakes/IntakeDetail';

// ─────────────────────────────────────────────────────────────────────────────
//  Skeleton
// ─────────────────────────────────────────────────────────────────────────────
function IntakeItemSkeleton() {
    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-6">
            {/* Back link */}
            <div className="h-4 bg-gray-200 rounded w-28" />
            {/* Title + badge */}
            <div className="flex items-center gap-3">
                <div className="h-8 bg-gray-200 rounded w-1/2" />
                <div className="h-6 bg-gray-200 rounded w-20" />
            </div>
            {/* Card */}
            <div className="border border-gray-200 rounded-sm">
                {/* Header strip */}
                <div className="h-14 bg-gray-100 border-b border-gray-200" />
                <div className="p-6 space-y-6">
                    {/* Two-col grid */}
                    <div className="grid grid-cols-2 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="space-y-2">
                                <div className="h-3 bg-gray-200 rounded w-24" />
                                <div className="h-5 bg-gray-100 rounded w-3/4" />
                            </div>
                        ))}
                    </div>
                    {/* Text blocks */}
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-3 bg-gray-200 rounded w-32" />
                            <div className="h-24 bg-gray-100 rounded-sm" />
                        </div>
                    ))}
                    {/* Media row */}
                    <div className="flex gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="w-32 h-32 bg-gray-100 rounded-sm flex-shrink-0" />
                        ))}
                    </div>
                </div>
                {/* Footer */}
                <div className="h-16 bg-gray-50 border-t border-gray-200 flex items-center justify-end px-6 gap-3">
                    <div className="h-9 w-32 bg-gray-200 rounded-sm" />
                    <div className="h-9 w-40 bg-gray-200 rounded-sm" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Small presentational helpers
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, value }) {
    if (!value && value !== 0) return null;
    return (
        <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-1">{label}</label>
            <div className="text-sm text-black font-medium">{value}</div>
        </div>
    );
}

function TextBlock({ label, value }) {
    if (!value) return null;
    return (
        <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-2">{label}</label>
            <div className="text-sm text-black font-serif leading-relaxed bg-zinc-50 border border-zinc-200 px-5 py-4 rounded-sm whitespace-pre-wrap">
                {value}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Page
// ─────────────────────────────────────────────────────────────────────────────
export default function IntakeItem() {
    const { id }         = useParams();
    const [searchParams] = useSearchParams();
    const navigate       = useNavigate();
    const { apiFetch }   = useAuth();

    const fromTab = searchParams.get('tab') || 'intakes';

    const [intake,         setIntake]         = useState(null);
    const [media,          setMedia]          = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [actionLoading,  setActionLoading]  = useState(false);
    const [locations,      setLocations]      = useState([]);
    const [showLocSelect,  setShowLocSelect]  = useState(false);
    const [moaDraft,       setMoaDraft]       = useState(null);
    const [modal, setModal] = useState({
        isOpen: false, title: '', message: '', type: 'alert',
        variant: 'info', onConfirm: null, promptValue: ''
    });

    // ------------------------------------------------------------------ //
    //  Fetch
    // ------------------------------------------------------------------ //
    const fetchRecord = useCallback(async () => {
        setLoading(true);
        try {
            const res  = await apiFetch(
                `/api/v1/acquisitions/intakes/${id}?expand=donation_item_id,donor_account_id,submission_id`
            );
            const json = await res.json();
            if (json.status === 'success') {
                setIntake(json.data);
                const mRes  = await apiFetch(`/api/v1/media/intake/${id}`);
                const mData = await mRes.json();
                setMedia(mData.data?.items || []);
            }
        } catch (err) {
            console.error('Failed to fetch intake', err);
        } finally {
            setLoading(false);
        }
    }, [id, apiFetch]);

    const fetchLocations = useCallback(async () => {
        try {
            const res  = await apiFetch('/api/v1/acquisitions/locations');
            const json = await res.json();
            if (json.status === 'success') setLocations(json.data);
        } catch (e) {}
    }, [apiFetch]);

    useEffect(() => {
        fetchRecord();
        fetchLocations();
    }, [fetchRecord, fetchLocations]);

    // ------------------------------------------------------------------ //
    //  Helpers from IntakeDetail
    // ------------------------------------------------------------------ //
    const getDonorEmail = (i) => {
        if (i?.expand?.donor_account_id?.email) return i.expand.donor_account_id.email;
        if (i?.expand?.submission_id) {
            const sub = i.expand.submission_id;
            const d = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data;
            return d?.donor_email || d?.email;
        }
        return null;
    };

    const getDonorPhone = (i) => {
        if (i?.expand?.donor_account_id?.phone) return i.expand.donor_account_id.phone;
        if (i?.expand?.submission_id) {
            const sub = i.expand.submission_id;
            const d = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data;
            return d?.donor_phone || d?.phone;
        }
        return null;
    };

    // Pull description/provenance from linked submission if not on intake itself
    const getSubmissionData = () => {
        if (!intake?.expand?.submission_id) return {};
        const sub = intake.expand.submission_id;
        return typeof sub.data === 'string' ? JSON.parse(sub.data) : (sub.data || {});
    };

    // ------------------------------------------------------------------ //
    //  Actions
    // ------------------------------------------------------------------ //
    const executeAction = async (action, body = {}) => {
        setModal(prev => ({ ...prev, isOpen: false }));
        setActionLoading(true);
        try {
            if (action === 'approve_and_generate') {
                const appRes = await apiFetch(`/api/v1/acquisitions/intakes/${id}/approve`, { method: 'POST' });
                if (!appRes.ok) { const j = await appRes.json(); throw new Error(j.message || 'Failed to approve'); }
                const moaRes = await apiFetch(`/api/v1/acquisitions/intakes/${id}/generate-moa`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: Object.keys(body).length ? JSON.stringify(body) : undefined
                });
                const j = await moaRes.json();
                if (moaRes.ok) setMoaDraft(j);
                else throw new Error(j.message || 'Failed to generate MOA');

            } else if (action === 'accept_and_issue') {
                const res = await apiFetch(`/api/v1/acquisitions/intakes/external/${id}/accept-and-issue`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: Object.keys(body).length ? JSON.stringify(body) : undefined
                });
                const j = await res.json();
                if (res.ok) { setMoaDraft(j); fetchRecord(); }
                else throw new Error(j.message || 'Failed to accept and issue documents');

            } else {
                let endpoint = `/api/v1/acquisitions/intakes/${id}/${
                    action === 'moa'      ? 'generate-moa'    :
                    action === 'delivery' ? 'confirm-delivery' : action
                }`;
                if (action === 'accession') endpoint = `/api/v1/acquisitions/accessions/from-intake/${id}`;

                const res = await apiFetch(endpoint, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: Object.keys(body).length ? JSON.stringify(body) : undefined
                });
                const j = await res.json();
                if (res.ok) {
                    if (action === 'moa') setMoaDraft(j);
                    else navigate(`/intakes?tab=${fromTab}`);
                } else {
                    setModal({
                        isOpen: true, title: res.status === 409 ? 'Conflict Detected' : 'Action Failed',
                        type: res.status === 409 ? 'confirm' : 'alert',
                        variant: res.status === 409 ? 'warning' : 'error',
                        message: res.status === 409
                            ? 'This record was modified by another user. Reload?'
                            : (j.error || j.message || 'Operation could not be completed.'),
                        onConfirm: res.status === 409 ? () => fetchRecord() : null
                    });
                }
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', type: 'alert', variant: 'error', message: err.message || 'Request failed.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleAction = (action, body = {}) => {
        const skipConfirm = ['moa', 'approve_and_generate', 'accept_and_issue'];
        if (!skipConfirm.includes(action)) {
            setModal({
                isOpen: true, title: 'Confirm Action', type: 'confirm',
                message: `Are you sure you want to: ${action.replace(/_/g, ' ')}?`,
                onConfirm: () => executeAction(action, body)
            });
            return;
        }
        executeAction(action, body);
    };

    // ------------------------------------------------------------------ //
    //  Render states
    // ------------------------------------------------------------------ //
    if (loading) return <IntakeItemSkeleton />;

    if (!intake) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <button onClick={() => navigate(`/intakes?tab=${fromTab}`)} className="text-sm font-semibold text-gray-500 hover:text-black flex items-center gap-1.5 mb-4">
                    <span>←</span> Back to Intakes
                </button>
                <p className="text-zinc-400 text-sm italic">Intake record not found.</p>
            </div>
        );
    }

    // ------------------------------------------------------------------ //
    //  Derived display data
    // ------------------------------------------------------------------ //
    const subData   = getSubmissionData();
    const donorEmail = getDonorEmail(intake);
    const donorPhone = getDonorPhone(intake);
    const acqMethod  = intake.acquisition_method || 'Unknown';
    const isLoan     = acqMethod.toLowerCase() === 'loan';
    const isDeliveryPending = ['gift', 'loan', 'bequest'].includes(acqMethod.toLowerCase()) &&
        ['under_review', 'approved', 'awaiting_delivery'].includes(intake.status);

    const description = intake.description || subData.artifact_description || 'No description provided.';
    const provenance  = intake.provenance   || subData.artifact_provenance   || 'No provenance information provided.';

    // All intake media + any submission-linked media
    const allMedia = media;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

            {/* ── Page header ── */}
            <div className="mb-6">
                <button
                    onClick={() => navigate(`/intakes?tab=${fromTab}`)}
                    className="text-sm font-semibold text-gray-500 hover:text-black transition-colors flex items-center gap-1.5 mb-3"
                >
                    <span>←</span> Back to Intakes
                </button>
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-3xl font-bold text-black tracking-tight">{intake.proposed_item_name || 'Unnamed Record'}</h1>
                    <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest border ${STATUS_STYLES[intake.status] || STATUS_STYLES.pending}`}>
                        {intake.status?.replace(/_/g, ' ')}
                    </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                    Intake Record &mdash; Logged {intake.created ? new Date(intake.created).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </p>
            </div>

            {/* ── Detail card ── */}
            <div className="border border-zinc-200 bg-white rounded-sm">

                {/* Card header bar */}
                <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex items-center gap-3">
                    <span className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400">Record</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{intake.id}</span>
                    {intake.donor_account_id ? (
                        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-green-700 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Portal Account Linked
                        </span>
                    ) : (
                        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-zinc-400 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                            No portal account
                        </span>
                    )}
                </div>

                <div className="p-6 space-y-8">

                    {/* ── 1. Donor / Source ── */}
                    <div className="space-y-4">
                        <div className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-400">Donor / Source Information</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <Field label="Donor / Source Name" value={intake.donor_info || intake.source_info || '—'} />
                            <Field label="Email Address"   value={donorEmail} />
                            <Field label="Phone Number"    value={donorPhone} />
                            <Field label="Acquisition Type" value={acqMethod} />
                            {isLoan && (
                                <Field
                                    label="Loan Return Date"
                                    value={intake.loan_end_date
                                        ? new Date(intake.loan_end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                        : 'No end date specified'}
                                />
                            )}
                            <Field
                                label="Date Logged"
                                value={intake.created
                                    ? new Date(intake.created).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                                    : '—'}
                            />
                        </div>
                    </div>

                    {/* ── 2. Physical location ── */}
                    <div className="space-y-3 pt-6 border-t border-zinc-100">
                        <div className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-400">Physical Location</div>
                        <div className="flex items-center justify-between">
                            {isDeliveryPending ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-sm text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                    Awaiting Delivery — Not Yet Received
                                </span>
                            ) : (
                                <div className="text-sm text-black font-bold flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                                    {intake.current_location || 'Not Specified (Check Receiving)'}
                                </div>
                            )}

                            {/* Set location dropdown */}
                            {['in_custody', 'accessioned', 'processed'].includes(intake.status) && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowLocSelect(!showLocSelect)}
                                        className="text-[9px] font-black uppercase tracking-[0.2em] text-[#A68A27] bg-[#D4AF37]/10 px-3 py-1.5 rounded-sm hover:bg-[#D4AF37]/20 transition-all border border-[#D4AF37]/30"
                                    >
                                        Set Location
                                    </button>
                                    {showLocSelect && (
                                        <div className="absolute right-0 bottom-full mb-2 w-64 bg-white border border-zinc-300 rounded-sm shadow-2xl z-50 p-2">
                                            <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500 p-3 border-b border-zinc-200 bg-zinc-50">
                                                Select Pre-set Location
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {locations.map(loc => (
                                                    <button
                                                        key={loc.id}
                                                        onClick={async () => {
                                                            setShowLocSelect(false);
                                                            try {
                                                                const res = await apiFetch(`/api/v1/acquisitions/intakes/${id}/location`, {
                                                                    method: 'PATCH',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ location: loc.name })
                                                                });
                                                                if (res.ok) fetchRecord();
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

                    {/* ── 3. Artifact description & provenance ── */}
                    <div className="space-y-4 pt-6 border-t border-zinc-100">
                        <div className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-400">Artifact Details</div>
                        <TextBlock label="Physical Description" value={description} />
                        <TextBlock label="Provenance / Historical Background" value={provenance} />
                    </div>

                    {/* ── 4. Linked submission data (if any extra form fields exist) ── */}
                    {intake.expand?.submission_id && (() => {
                        const sd = getSubmissionData();
                        const known = new Set(['artifact_name','artifact_description','artifact_provenance',
                            'acquisition_type','loan_end_date','is_anonymous',
                            'donor_first_name','donor_last_name','donor_email','donor_phone']);
                        const extra = Object.entries(sd).filter(([k]) => !known.has(k));
                        if (!extra.length) return null;
                        return (
                            <div className="space-y-4 pt-6 border-t border-zinc-100">
                                <div className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-400">Additional Submission Responses</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    {extra.map(([key, val]) => (
                                        <Field
                                            key={key}
                                            label={key.replace(/_/g, ' ')}
                                            value={typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val || '—')}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── 5. Attached media ── */}
                    {allMedia.length > 0 && (
                        <div className="space-y-3 pt-6 border-t border-zinc-100">
                            <div className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-400">
                                Attached Photos &amp; Documents ({allMedia.length})
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {allMedia.map(m => {
                                    const url = `${import.meta.env.VITE_API_BASE_URL}/api/v1/files/intake/${id}/${m.file_name}`;
                                    return (
                                        <a
                                            key={m.id}
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="relative aspect-square border border-zinc-200 rounded-sm overflow-hidden group bg-zinc-100 block"
                                        >
                                            <img
                                                src={url}
                                                alt={m.file_name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </div>
                                            <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1.5 text-[8px] text-white font-mono truncate">
                                                {m.file_name}
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Action footer ── */}
                <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-3 flex-wrap items-center">
                    {actionLoading && (
                        <span className="text-xs text-zinc-400 uppercase tracking-widest mr-auto">Processing…</span>
                    )}

                    {intake.status === 'approved' && (
                        <button
                            onClick={() => handleAction('moa')}
                            disabled={actionLoading}
                            className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm disabled:opacity-50"
                        >
                            Issue Deed of Gift &amp; Slip
                        </button>
                    )}

                    {intake.status === 'awaiting_delivery' && (
                        <>
                            <button
                                onClick={() => handleAction('rollback')}
                                disabled={actionLoading}
                                className="px-4 py-3 bg-white border border-zinc-200 text-zinc-500 text-xs font-bold uppercase tracking-widest hover:text-black transition-colors rounded-sm disabled:opacity-50"
                            >
                                Rollback to Review
                            </button>
                            <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                                Awaiting physical delivery
                            </div>
                            <a
                                href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/acquisitions/intakes/${id}/export-moa`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-6 py-3 bg-white border border-zinc-300 text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors rounded-sm flex items-center gap-2"
                            >
                                <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Export MOA for Printing
                            </a>
                        </>
                    )}

                    {intake.status === 'in_custody' && (
                        <>
                            <a
                                href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/acquisitions/intakes/${id}/export-moa`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-6 py-3 bg-white border border-zinc-300 text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors rounded-sm flex items-center gap-2"
                            >
                                <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Print MOA
                            </a>
                            <button
                                onClick={() => setModal({
                                    isOpen: true, title: 'Start Accessioning',
                                    message: 'Enter curatorial instructions for handling this artifact:',
                                    type: 'prompt', variant: 'info',
                                    onConfirm: (val) => handleAction('accession', { handlingInstructions: val })
                                })}
                                disabled={actionLoading}
                                className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm disabled:opacity-50"
                            >
                                Start Accessioning
                            </button>
                        </>
                    )}

                    {intake.status === 'rejected' && (
                        <button
                            onClick={() => handleAction('reopen')}
                            disabled={actionLoading}
                            className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm disabled:opacity-50"
                        >
                            Reopen for Review
                        </button>
                    )}
                </div>
            </div>

            {moaDraft && (
                <MoaDialog
                    moaDraft={moaDraft}
                    onClose={() => setMoaDraft(null)}
                    apiFetch={apiFetch}
                    setModal={setModal}
                    fetchData={fetchRecord}
                    setSelected={() => {}}
                />
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
