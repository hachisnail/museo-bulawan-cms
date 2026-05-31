import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import Modal from '../../../components/Modal';
import MoaDialog from '../../../components/Intakes/MoaDialog';
import { STATUS_STYLES } from '../../../components/Intakes/IntakeDetail';

// ─────────────────────────────────────────────────────────────────────────────
//  Small presentational helpers
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, value, mono = false, serif = false }) {
    if (!value && value !== 0) return null;
    return (
        <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-1">{label}</label>
            <div className={`text-sm text-black ${mono ? 'font-mono' : ''} ${serif ? 'font-serif leading-relaxed' : 'font-medium'}`}>
                {value}
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="space-y-4 pt-6 border-t border-zinc-100 first:border-0 first:pt-0">
            {title && (
                <div className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-400">{title}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {children}
            </div>
        </div>
    );
}

function TextBlock({ label, value }) {
    if (!value) return null;
    return (
        <div className="col-span-full">
            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-2">{label}</label>
            <div className="text-sm text-black font-serif leading-relaxed bg-zinc-50 border border-zinc-200 px-5 py-4 rounded-sm whitespace-pre-wrap">
                {value}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function OfferItem() {
    const { id }         = useParams();
    const [searchParams] = useSearchParams();
    const navigate       = useNavigate();
    const { apiFetch }   = useAuth();

    const fromTab = searchParams.get('tab') || 'submissions';

    const [submission,    setSubmission]    = useState(null);
    const [items,         setItems]         = useState([]);
    const [media,         setMedia]         = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [moaDraft,      setMoaDraft]      = useState(null);
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
            const res  = await apiFetch(`/api/v1/forms/admin/submissions/${id}`);
            const json = await res.json();
            if (json.status === 'success') {
                const sub = json.data.submission;
                if (sub && typeof sub.data === 'string') {
                    try { sub.data = JSON.parse(sub.data); } catch (e) {}
                }
                setSubmission(sub);
                setItems(json.data.items || []);

                const mRes  = await apiFetch(`/api/v1/media/submission/${id}`);
                const mData = await mRes.json();
                setMedia(mData.data?.items || []);
            }
        } catch (err) {
            console.error('Failed to fetch offer submission', err);
        } finally {
            setLoading(false);
        }
    }, [id, apiFetch]);

    useEffect(() => { fetchRecord(); }, [fetchRecord]);

    // ------------------------------------------------------------------ //
    //  Actions
    // ------------------------------------------------------------------ //
    const executeAction = async (action, body = {}) => {
        setModal(prev => ({ ...prev, isOpen: false }));
        setActionLoading(true);
        try {
            let endpoint = '';
            let method   = 'POST';

            if (action === 'accept_and_issue') {
                endpoint = `/api/v1/acquisitions/intakes/external/${id}/accept-and-issue`;
            } else if (action === 'approve_and_generate') {
                // Two-step: approve then generate MOA
                const appRes = await apiFetch(`/api/v1/acquisitions/intakes/${id}/approve`, { method: 'POST' });
                if (!appRes.ok) { const j = await appRes.json(); throw new Error(j.message || 'Failed to approve'); }
                const moaRes = await apiFetch(`/api/v1/acquisitions/intakes/${id}/generate-moa`, {
                    method, headers: { 'Content-Type': 'application/json' },
                    body: Object.keys(body).length ? JSON.stringify(body) : undefined
                });
                const j = await moaRes.json();
                if (moaRes.ok) setMoaDraft(j);
                else throw new Error(j.message || 'Failed to generate MOA');
                return;
            } else if (action === 'reject') {
                endpoint = `/api/v1/acquisitions/submissions/${id}/reject`;
            } else if (action === 'reopen') {
                endpoint = `/api/v1/acquisitions/submissions/${id}/reopen`;
            }

            const res = await apiFetch(endpoint, {
                method, headers: { 'Content-Type': 'application/json' },
                body: Object.keys(body).length ? JSON.stringify(body) : undefined
            });
            const j = await res.json();

            if (res.ok) {
                if (action === 'accept_and_issue') { setMoaDraft(j); fetchRecord(); }
                else navigate(`/intakes?tab=${fromTab}`);
            } else {
                setModal({
                    isOpen: true, title: 'Action Failed', type: 'alert', variant: 'error',
                    message: j.error || j.message || 'Operation could not be completed.'
                });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', type: 'alert', variant: 'error', message: err.message || 'Request failed.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleAction = (action, body = {}) => {
        const skipConfirm = ['accept_and_issue', 'approve_and_generate'];
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
    //  Loading skeleton
    // ------------------------------------------------------------------ //
    if (loading) {
        return (
            <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="animate-pulse space-y-4 pt-4">
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-8 bg-gray-200 rounded w-2/3" />
                    <div className="h-[600px] bg-gray-100 rounded-sm border border-gray-200 mt-4" />
                </div>
            </div>
        );
    }

    if (!submission) {
        return (
            <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <button onClick={() => navigate(`/intakes?tab=${fromTab}`)} className="self-start text-sm font-semibold text-gray-500 hover:text-black mt-4 flex items-center gap-1.5">
                    <span>←</span> Back to Intakes
                </button>
                <p className="text-zinc-400 text-sm italic">Record not found.</p>
            </div>
        );
    }

    // ------------------------------------------------------------------ //
    //  Derived display data
    // ------------------------------------------------------------------ //
    const pd      = submission.data || {};
    const isAnon  = pd.is_anonymous === true;
    const fullName = `${pd.donor_first_name || ''} ${pd.donor_last_name || ''}`.trim();
    const donorDisplay  = isAnon ? 'Anonymous Donor' : (fullName || submission.submitted_by || '—');
    const artifactTitle = pd.artifact_name || 'Unnamed Offer';
    const acqType       = (pd.acquisition_type || 'Gift');
    const isLoan        = acqType.toLowerCase() === 'loan';

    // Build a "catch-all" list of any extra form fields not already shown
    const knownKeys = new Set([
        'artifact_name','artifact_description','artifact_provenance',
        'acquisition_type','loan_end_date','is_anonymous',
        'donor_first_name','donor_last_name','donor_email','donor_phone'
    ]);
    const extraFields = Object.entries(pd).filter(([k]) => !knownKeys.has(k));

    // ------------------------------------------------------------------ //
    //  Render
    // ------------------------------------------------------------------ //
    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* ── Page header ── */}
            <section className="flex items-start border-b border-gray-100 pb-4 mb-4">
                <div className="flex-1">
                    <button
                        onClick={() => navigate(`/intakes?tab=${fromTab}`)}
                        className="text-sm font-semibold text-gray-500 hover:text-black transition-colors flex items-center gap-1.5 mb-2"
                    >
                        <span>←</span> Back to Intakes
                    </button>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-3xl font-bold text-black tracking-tight">{artifactTitle}</h1>
                        <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest border ${STATUS_STYLES[submission.status] || STATUS_STYLES.pending}`}>
                            {submission.status?.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                        {submission.form_title || 'Donation Offer'} &mdash; Submitted {submission.created ? new Date(submission.created).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                    </p>
                </div>
            </section>

            {/* ── Detail card ── */}
            <div className="border border-zinc-200 bg-white rounded-sm">

                {/* Card header */}
                <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex items-center gap-3">
                    <span className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400">Submission</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{submission.id}</span>
                </div>

                <div className="p-6 space-y-8">

                    {/* ── 1. Donor information ── */}
                    <Section title="Donor Information">
                        <Field label="Donor Name" value={donorDisplay} />
                        <Field label="Anonymity" value={isAnon ? 'Anonymous — identity withheld' : 'Identity disclosed'} />
                        {!isAnon && (
                            <>
                                <Field label="Email Address" value={pd.donor_email} />
                                <Field label="Phone Number"  value={pd.donor_phone} />
                            </>
                        )}
                        <Field label="Submitted By (Portal Account)" value={!isAnon && submission.submitted_by !== fullName ? submission.submitted_by : null} />
                    </Section>

                    {/* ── 2. Acquisition details ── */}
                    <Section title="Acquisition Details">
                        <Field label="Acquisition Type" value={acqType} />
                        {isLoan && <Field label="Loan Return Date" value={pd.loan_end_date ? new Date(pd.loan_end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No end date specified'} />}
                        <Field label="Date Submitted" value={submission.created ? new Date(submission.created).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
                        <Field label="Source Form" value={submission.form_title} />
                    </Section>

                    {/* ── 3. Artifact details ── */}
                    <div className="space-y-4 pt-6 border-t border-zinc-100">
                        <div className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-400">Artifact Details</div>
                        <TextBlock label="Physical Description" value={pd.artifact_description || 'No description provided.'} />
                        <TextBlock label="Provenance / Historical Background" value={pd.artifact_provenance || 'No provenance information provided.'} />
                    </div>

                    {/* ── 4. Additional form fields (catch-all) ── */}
                    {extraFields.length > 0 && (
                        <div className="space-y-4 pt-6 border-t border-zinc-100">
                            <div className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-400">Additional Form Responses</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                {extraFields.map(([key, val]) => (
                                    <Field
                                        key={key}
                                        label={key.replace(/_/g, ' ')}
                                        value={typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val || '—')}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── 5. Donation items (if multi-item submission) ── */}
                    {items.length > 0 && (
                        <div className="space-y-3 pt-6 border-t border-zinc-100">
                            <div className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-400">Submitted Items ({items.length})</div>
                            <div className="border border-zinc-200 rounded-sm overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-zinc-50 border-b border-zinc-200">
                                        <tr>
                                            {['Item Name', 'Description', 'Status'].map(h => (
                                                <th key={h} className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, i) => (
                                            <tr key={i} className="border-b border-zinc-100 last:border-0">
                                                <td className="py-3 px-4 font-medium text-black">{item.proposed_item_name || item.name || '—'}</td>
                                                <td className="py-3 px-4 text-zinc-500 font-serif">{item.description || '—'}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider border ${STATUS_STYLES[item.status] || STATUS_STYLES.pending}`}>
                                                        {item.status?.replace(/_/g, ' ') || '—'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── 6. Attached media ── */}
                    {media.length > 0 && (
                        <div className="space-y-3 pt-6 border-t border-zinc-100">
                            <div className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-400">Attached Documents & Photos ({media.length})</div>
                            <div className="flex gap-4 overflow-x-auto pb-2">
                                {media.map(m => (
                                    <a
                                        key={m.id}
                                        href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/submission/${id}/${m.file_name}`}
                                        target="_blank" rel="noreferrer"
                                        className="relative flex-shrink-0 w-32 h-32 border border-zinc-200 rounded-sm overflow-hidden group bg-zinc-100"
                                    >
                                        <img
                                            src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/submission/${id}/${m.file_name}`}
                                            className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                                            alt="Attachment"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[8px] text-white font-mono truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            {m.file_name}
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Action footer ── */}
                <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-3 flex-wrap">
                    {actionLoading && <span className="text-xs text-zinc-400 uppercase tracking-widest self-center mr-auto">Processing…</span>}

                    {/* Pending: decline + accept */}
                    {submission.status === 'pending' && (
                        <>
                            <button
                                onClick={() => setModal({
                                    isOpen: true, title: 'Decline Offer',
                                    message: 'Provide a reason for declining this donation offer:',
                                    type: 'prompt', variant: 'warning',
                                    onConfirm: (val) => handleAction('reject', { reason: val })
                                })}
                                disabled={actionLoading}
                                className="px-6 py-3 bg-white border border-red-200 text-red-700 text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-colors rounded-sm disabled:opacity-50"
                            >
                                Decline Offer
                            </button>
                            <button
                                onClick={() => {
                                    const name = isAnon ? 'Anonymous Offer' : (artifactTitle || 'this offer');
                                    setModal({
                                        isOpen: true, title: 'Accept Donation & Issue Documents',
                                        message: `Accept "${name}" and generate the Deed of Gift and Delivery Slip? Documents will be sent to the donor's email.`,
                                        type: 'confirm', variant: 'info',
                                        onConfirm: () => handleAction('accept_and_issue')
                                    });
                                }}
                                disabled={actionLoading}
                                className="px-6 py-3 bg-black text-[#D4AF37] text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 transition-colors rounded-sm flex items-center gap-2 disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Accept &amp; Issue Documents
                            </button>
                        </>
                    )}

                    {/* Under review: decline + approve & generate MOA */}
                    {submission.status === 'under_review' && (
                        <>
                            <button
                                onClick={() => setModal({
                                    isOpen: true, title: 'Decline Offer',
                                    message: 'Provide a reason for rejection:',
                                    type: 'prompt', variant: 'warning',
                                    onConfirm: (val) => handleAction('reject', { reason: val })
                                })}
                                disabled={actionLoading}
                                className="px-6 py-3 bg-white border border-red-200 text-red-700 text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-colors rounded-sm disabled:opacity-50"
                            >
                                Decline Offer
                            </button>
                            <button
                                onClick={() => {
                                    const donor = isAnon ? 'the donor' : (fullName || 'the donor');
                                    setModal({
                                        isOpen: true, title: 'Approve Acquisition',
                                        message: `Approve and generate legal documents for ${donor}?`,
                                        type: 'confirm',
                                        onConfirm: () => handleAction('approve_and_generate', { donorName: donor })
                                    });
                                }}
                                disabled={actionLoading}
                                className="px-6 py-3 bg-black text-[#D4AF37] text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 transition-colors rounded-sm disabled:opacity-50"
                            >
                                Approve &amp; Generate MOA
                            </button>
                        </>
                    )}

                    {/* Rejected: reopen */}
                    {submission.status === 'rejected' && (
                        <button
                            onClick={() => handleAction('reopen')}
                            disabled={actionLoading}
                            className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm disabled:opacity-50"
                        >
                            Reopen for Review
                        </button>
                    )}

                    {/* Archived: restore */}
                    {submission.status === 'archived' && (
                        <button
                            onClick={() => handleAction('reopen')}
                            disabled={actionLoading}
                            className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm disabled:opacity-50"
                        >
                            Restore Submission
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
