// apps/panel-admin/src/pages/intakes/pages/OfferItem.jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import Modal from '../../../components/Modal';
import MoaDialog from '../../../components/Intakes/MoaDialog';
import { STATUS_STYLES } from '../../../components/Intakes/IntakeDetail';

// ─────────────────────────────────────────────────────────────────────────────
//  Skeleton Loader
// ─────────────────────────────────────────────────────────────────────────────
function OfferItemSkeleton() {
    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 animate-pulse">
            <div className="space-y-6 pt-4">
                <div className="h-4 bg-gray-200 rounded w-28" />
                <div className="flex items-center gap-3 mt-2">
                    <div className="h-8 bg-gray-200 rounded w-1/3" />
                    <div className="h-6 bg-gray-200 rounded w-20" />
                </div>
                <div className="border border-gray-200 rounded-lg mt-4">
                    <div className="h-14 bg-gray-50 border-b border-gray-200" />
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-24" />
                                    <div className="h-5 bg-gray-100 rounded w-3/4" />
                                </div>
                            ))}
                        </div>
                        {[...Array(2)].map((_, i) => (
                            <div key={i} className="space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-32" />
                                <div className="h-24 bg-gray-100 rounded-md" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Small presentational helpers
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, value, mono = false }) {
    if (!value && value !== 0) return null;
    return (
        <div>
            <label className="text-sm font-medium text-gray-500 block mb-1">{label}</label>
            <div className={`text-base text-gray-900 ${mono ? 'font-mono' : ''}`}>
                {value}
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="space-y-4 pt-6 border-t border-gray-200 first:border-0 first:pt-0">
            {title && (
                <div className="text-lg font-semibold text-gray-900">{title}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {children}
            </div>
        </div>
    );
}

function TextBlock({ label, value }) {
    if (!value) return null;
    return (
        <div className="col-span-full">
            <label className="text-sm font-medium text-gray-500 block mb-2">{label}</label>
            <div className="text-base text-gray-900 bg-gray-50 border border-gray-200 px-5 py-4 rounded-md whitespace-pre-wrap">
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

    const executeAction = async (action, body = {}) => {
        setModal(prev => ({ ...prev, isOpen: false }));
        setActionLoading(true);
        try {
            let endpoint = '';
            let method   = 'POST';

            if (action === 'accept_and_issue') {
                endpoint = `/api/v1/acquisitions/intakes/external/${id}/accept-and-issue`;
            } else if (action === 'approve_and_generate') {
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

    if (loading) {
        return <OfferItemSkeleton />;
    }

    if (!submission) {
        return (
            <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <button onClick={() => navigate(`/intakes?tab=${fromTab}`)} className="self-start text-sm font-medium text-blue-600 hover:text-blue-800 mt-4 flex items-center gap-1.5">
                    <span>←</span> Back to Intakes
                </button>
                <p className="text-gray-500 text-base">Record not found.</p>
            </div>
        );
    }

    const pd      = submission.data || {};
    const isAnon  = pd.is_anonymous === true;
    const fullName = `${pd.donor_first_name || ''} ${pd.donor_last_name || ''}`.trim();
    const donorDisplay  = isAnon ? 'Anonymous Donor' : (fullName || submission.submitted_by || '—');
    const artifactTitle = pd.artifact_name || 'Unnamed Offer';
    const acqType       = (pd.acquisition_type || 'Gift');
    const isLoan        = acqType.toLowerCase() === 'loan';

    const knownKeys = new Set([
        'artifact_name','artifact_description','artifact_provenance',
        'acquisition_type','loan_end_date','is_anonymous',
        'donor_first_name','donor_last_name','donor_email','donor_phone'
    ]);
    const extraFields = Object.entries(pd).filter(([k]) => !knownKeys.has(k));

    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">

            <section className="flex items-start border-b border-gray-200 pb-6 mb-2">
                <div className="flex-1">
                    <button
                        onClick={() => navigate(`/intakes?tab=${fromTab}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1.5 mb-3"
                    >
                        <span>←</span> Back to Intakes
                    </button>
                    <div className="flex items-center gap-4 flex-wrap">
                        <h1 className="text-2xl font-bold text-gray-900">{artifactTitle}</h1>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border ${STATUS_STYLES[submission.status] || STATUS_STYLES.pending}`}>
                            {submission.status?.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <p className="text-base text-gray-500 mt-2">
                        {submission.form_title || 'Donation Offer'} &mdash; Submitted {submission.created ? new Date(submission.created).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                    </p>
                </div>
            </section>

            <div className="border border-gray-200 bg-white rounded-lg shadow-sm">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3 rounded-t-lg">
                    <span className="text-sm font-semibold text-gray-700">Submission Details</span>
                    <span className="text-sm text-gray-500 font-mono">#{submission.id}</span>
                </div>

                <div className="p-6 space-y-8">
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

                    <Section title="Acquisition Details">
                        <Field label="Acquisition Type" value={acqType} />
                        {isLoan && <Field label="Loan Return Date" value={pd.loan_end_date ? new Date(pd.loan_end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No end date specified'} />}
                        <Field label="Date Submitted" value={submission.created ? new Date(submission.created).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
                        <Field label="Source Form" value={submission.form_title} />
                    </Section>

                    <div className="space-y-4 pt-6 border-t border-gray-200">
                        <div className="text-lg font-semibold text-gray-900">Artifact Details</div>
                        <TextBlock label="Physical Description" value={pd.artifact_description || 'No description provided.'} />
                        <TextBlock label="Provenance / Historical Background" value={pd.artifact_provenance || 'No provenance information provided.'} />
                    </div>

                    {extraFields.length > 0 && (
                        <div className="space-y-4 pt-6 border-t border-gray-200">
                            <div className="text-lg font-semibold text-gray-900">Additional Form Responses</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
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

                    {items.length > 0 && (
                        <div className="space-y-4 pt-6 border-t border-gray-200">
                            <div className="text-lg font-semibold text-gray-900">Submitted Items ({items.length})</div>
                            <div className="border border-gray-200 rounded-md overflow-hidden">
                                <table className="w-full text-base text-left">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            {['Item Name', 'Description', 'Status'].map(h => (
                                                <th key={h} className="py-3 px-4 text-sm font-semibold text-gray-600">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, i) => (
                                            <tr key={i} className="border-b border-gray-100 last:border-0">
                                                <td className="py-4 px-4 font-medium text-gray-900">{item.proposed_item_name || item.name || '—'}</td>
                                                <td className="py-4 px-4 text-gray-600">{item.description || '—'}</td>
                                                <td className="py-4 px-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border ${STATUS_STYLES[item.status] || STATUS_STYLES.pending}`}>
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

                    {media.length > 0 && (
                        <div className="space-y-4 pt-6 border-t border-gray-200">
                            <div className="text-lg font-semibold text-gray-900">Attached Documents & Photos ({media.length})</div>
                            <div className="flex gap-4 overflow-x-auto pb-2">
                                {media.map(m => (
                                    <a
                                        key={m.id}
                                        href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/submission/${id}/${m.file_name}`}
                                        target="_blank" rel="noreferrer"
                                        className="relative flex-shrink-0 w-32 h-32 border border-gray-200 rounded-md overflow-hidden group bg-gray-100"
                                    >
                                        <img
                                            src={`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/submission/${id}/${m.file_name}`}
                                            className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                                            alt="Attachment"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 bg-gray-900/70 p-2 text-xs text-white font-mono truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            {m.file_name}
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Action footer ── */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-wrap rounded-b-lg">
                    {actionLoading && <span className="text-sm text-gray-500 font-medium self-center mr-auto">Processing…</span>}

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
                                className="px-5 py-2.5 bg-white border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors rounded-md disabled:opacity-50"
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
                                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors rounded-md flex items-center gap-2 disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Accept &amp; Issue Documents
                            </button>
                        </>
                    )}

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
                                className="px-5 py-2.5 bg-white border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors rounded-md disabled:opacity-50"
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
                                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors rounded-md disabled:opacity-50"
                            >
                                Approve &amp; Generate MOA
                            </button>
                        </>
                    )}

                    {submission.status === 'rejected' && (
                        <button
                            onClick={() => handleAction('reopen')}
                            disabled={actionLoading}
                            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors rounded-md disabled:opacity-50"
                        >
                            Reopen for Review
                        </button>
                    )}

                    {submission.status === 'archived' && (
                        <button
                            onClick={() => handleAction('reopen')}
                            disabled={actionLoading}
                            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors rounded-md disabled:opacity-50"
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