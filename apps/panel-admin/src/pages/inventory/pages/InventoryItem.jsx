import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { useSSE } from '../../../hooks/useSSE';
import Modal from '../../../components/Modal';
import FormRenderer from '../../../components/FormRenderer';
import MovementForm from '../components/MovementForm';
import { 
    Box, 
    MapPin, 
    History, 
    ShieldCheck, 
    FileText, 
    TrendingUp,
    Activity,
    ClipboardList
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  Badge Styles Helper
// ─────────────────────────────────────────────────────────────────────────────
const getStatusStyles = (status) => {
    switch (status?.toLowerCase()) {
        case 'maintenance':
            return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'loaned':
            return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'active':
            return 'bg-zinc-800 text-white border-zinc-900';
        case 'deaccessioned':
            return 'bg-red-100 text-red-800 border-red-200';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Skeleton Loader
// ─────────────────────────────────────────────────────────────────────────────
function InventoryItemSkeleton() {
    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 animate-pulse">
            <div className="space-y-6 pt-4">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="flex items-center gap-3 mt-2">
                    <div className="h-8 bg-gray-200 rounded w-1/3" />
                    <div className="h-6 bg-gray-200 rounded w-24" />
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
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Presentational helpers
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, value, mono = false }) {
    if (!value && value !== 0) return null;
    return (
        <div>
            <label className="text-xs font-black text-zinc-500 uppercase tracking-widest block mb-1">{label}</label>
            <div className={`text-sm font-semibold text-gray-900 ${mono ? 'font-mono' : ''}`}>
                {value}
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="space-y-4 pt-6 border-t border-gray-200 first:border-0 first:pt-0">
            {title && (
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2">{title}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {children}
            </div>
        </div>
    );
}

function TextBlock({ label, value, italic = false }) {
    if (!value) return null;
    return (
        <div className="col-span-full">
            <label className="text-xs font-black text-zinc-500 uppercase tracking-widest block mb-1">{label}</label>
            <div className={`text-sm text-black leading-relaxed p-4 bg-zinc-50 border border-zinc-200 rounded whitespace-pre-wrap ${italic ? 'font-serif italic' : ''}`}>
                {value}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Page Component
// ─────────────────────────────────────────────────────────────────────────────
export default function InventoryItem() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { apiFetch } = useAuth();
    const { events } = useSSE('inventory');

    const backTab = searchParams.get('tab') || 'Artifact';

    const [loading, setLoading] = useState(true);
    const [artifact, setArtifact] = useState(null);
    const [detailTab, setDetailTab] = useState('provenance');

    // Subsystems logs state
    const [movementTrails, setMovementTrails] = useState([]);
    const [healthLogs, setHealthLogs] = useState([]);
    const [valuations, setValuations] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [conservationLogs, setConservationLogs] = useState([]);
    const [exhibitionHistory, setExhibitionHistory] = useState([]);
    const [locations, setLocations] = useState([]);

    // Subsystem sub-forms visibility
    const [showMovementForm, setShowMovementForm] = useState(false);
    const [showHealthForm, setShowHealthForm] = useState(false);
    const [showConservationForm, setShowConservationForm] = useState(false);

    // Modal Actions state
    const [actionLoading, setActionLoading] = useState(false);
    const [modal, setModal] = useState({ 
        isOpen: false, 
        title: '', 
        message: '', 
        type: 'alert', 
        variant: 'info', 
        onConfirm: null, 
        promptValue: '' 
    });

    // ── Fetch Details & Subsystems data ──
    const fetchDetails = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [itemRes, mRes, hRes, vRes, aRes, cRes, eRes] = await Promise.all([
                apiFetch(`/api/v1/acquisitions/inventory/${id}?expand=accession_id.intake_id`),
                apiFetch(`/api/v1/acquisitions/inventory/${id}/movement`),
                apiFetch(`/api/v1/acquisitions/inventory/${id}/condition-reports`),
                apiFetch(`/api/v1/acquisitions/inventory/${id}/valuations`),
                apiFetch(`/api/v1/acquisitions/inventory/${id}/audits`),
                apiFetch(`/api/v1/acquisitions/inventory/${id}/conservation`),
                apiFetch(`/api/v1/acquisitions/inventory/${id}/exhibitions`)
            ]);

            const itemJson = await itemRes.json();
            const mJson = await mRes.json();
            const hJson = await hRes.json();
            const vJson = await vRes.json();
            const aJson = await aRes.json();
            const cJson = await cRes.json();
            const eJson = await eRes.json();

            if (itemJson.status === 'success') setArtifact(itemJson.data);
            if (mJson.status === 'success') setMovementTrails(mJson.data.items || []);
            if (hJson.status === 'success') setHealthLogs(hJson.data.items || []);
            if (vJson.status === 'success') setValuations(vJson.data.items || []);
            if (aJson.status === 'success') setAuditLogs(aJson.data.items || []);
            if (cJson.status === 'success') setConservationLogs(cJson.data.items || []);
            if (eJson.status === 'success') setExhibitionHistory(eJson.data.items || []);
        } catch (err) {
            console.error("Failed to fetch detailed artifact record", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch, id]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    // Live update on real-time SSE triggers
    useEffect(() => {
        if (events.length > 0) fetchDetails(true);
    }, [events, fetchDetails]);

    // Fetch locations mapping for movement transfer
    useEffect(() => {
        apiFetch('/api/v1/acquisitions/locations')
            .then(res => res.json())
            .then(json => {
                if (json.status === 'success') setLocations(json.data);
            })
            .catch(() => {});
    }, [apiFetch]);

    // ── Conflict Handling ──
    const handleConflict = (json) => {
        setModal({
            isOpen: true,
            title: 'Conflict Detected',
            message: `This record was modified by another staff member while you were editing.
            
Current Database Values:
${json.currentRecord ? JSON.stringify(json.currentRecord, null, 2) : 'Record has been updated.'}
 
Would you like to reload the latest record and try again?`,
            type: 'confirm',
            variant: 'warning',
            onConfirm: () => {
                fetchDetails();
            }
        });
    };

    // ── Actions handlers ──
    const handleDeaccession = () => {
        setModal({
            isOpen: true,
            title: 'Deaccession Artifact',
            message: 'Provide a reason for removing this artifact from the permanent collection:',
            type: 'prompt',
            variant: 'warning',
            promptValue: '',
            onConfirm: async (reason) => {
                if (!reason) return;
                setActionLoading(true);
                try {
                    const res = await apiFetch(`/api/v1/acquisitions/inventory/${id}/deaccession`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason })
                    });
                    const json = await res.json();
                    
                    if (res.ok) {
                        setModal({ isOpen: true, title: 'Success', message: 'Artifact deaccessioned.', type: 'alert', variant: 'success' });
                        fetchDetails(true);
                    } else {
                        if (res.status === 409) {
                            handleConflict(json);
                        } else {
                            setModal({ isOpen: true, title: 'Action Failed', message: json.error || json.message || 'Operation failed.', type: 'alert', variant: 'error' });
                        }
                    }
                } catch (err) {
                    setModal({ isOpen: true, title: 'Error', message: 'Deaccession failed.', type: 'alert', variant: 'error' });
                } finally { 
                    setActionLoading(false); 
                }
            }
        });
    };

    const handleValuation = () => {
        setModal({
            isOpen: true,
            title: 'Add Market Valuation',
            message: 'Enter appraised value (PHP):',
            type: 'prompt',
            promptValue: '',
            onConfirm: (amount) => {
                if (!amount) return;
                setModal({
                    isOpen: true,
                    title: 'Appraisal Reason',
                    message: 'Enter valuation reason (e.g. Insurance, Market assessment):',
                    type: 'prompt',
                    promptValue: '',
                    onConfirm: async (reason) => {
                        if (!reason) return;
                        setActionLoading(true);
                        try {
                            const res = await apiFetch(`/api/v1/acquisitions/inventory/${id}/valuations`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ amount: parseFloat(amount), reason })
                            });
                            const json = await res.json();

                            if (res.ok) {
                                setModal({ isOpen: true, title: 'Success', message: 'Appraisal recorded.', type: 'alert', variant: 'success' });
                                fetchDetails(true);
                            } else {
                                if (res.status === 409) {
                                    handleConflict(json);
                                } else {
                                    setModal({ isOpen: true, title: 'Action Failed', message: json.error || json.message || 'Operation failed.', type: 'alert', variant: 'error' });
                                }
                            }
                        } catch (err) {
                            setModal({ isOpen: true, title: 'Error', message: 'Appraisal request failed.', type: 'alert', variant: 'error' });
                        } finally { 
                            setActionLoading(false); 
                        }
                    }
                });
            }
        });
    };

    const handleMovementSubmit = async (movementData) => {
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/inventory/${id}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(movementData)
            });
            const json = await res.json();

            if (res.ok) {
                setModal({ isOpen: true, title: 'Success', message: 'Movement registered successfully.', type: 'alert', variant: 'success' });
                setShowMovementForm(false);
                fetchDetails(true);
            } else {
                if (res.status === 409) {
                    handleConflict(json);
                } else {
                    setModal({ isOpen: true, title: 'Action Failed', message: json.error || json.message || 'Transfer failed.', type: 'alert', variant: 'error' });
                }
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Location transfer request failed.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleSpotCheck = () => {
        const notes = prompt("Enter audit notes (e.g. Verified by spot check):");
        if (notes !== null) {
            apiFetch(`/api/v1/acquisitions/inventory/${id}/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    objectFound: true, 
                    auditedLocation: artifact.current_location, 
                    discrepancyNotes: notes 
                })
            })
            .then(res => {
                if (res.ok) {
                    setModal({ isOpen: true, title: 'Success', message: 'Compliance audit recorded.', type: 'alert', variant: 'success' });
                    fetchDetails(true);
                }
            })
            .catch(err => console.error("Spot check log failed", err));
        }
    };

    if (loading) return <InventoryItemSkeleton />;
    if (!artifact) {
        return (
            <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <button onClick={() => navigate(`/inventory?tab=${backTab}`)} className="self-start text-sm font-medium text-blue-600 hover:text-blue-800 mt-4 flex items-center gap-1.5">
                    <span>←</span> Back to Inventory
                </button>
                <p className="text-gray-500 text-base">Record not found.</p>
            </div>
        );
    }

    const accession = artifact.expand?.accession_id || {};
    const intake = accession.expand?.intake_id || {};

    const isAnon = intake.is_anonymous === true;
    const fullName = `${intake.donor_first_name || ''} ${intake.donor_last_name || ''}`.trim();
    const donorName = isAnon ? 'Anonymous Donor' : (fullName || accession.submitted_by || '—');

    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">

            {/* ── Page Header ── */}
            <section className="flex items-start border-b border-gray-200 pb-6 mb-2">
                <div className="flex-1">
                    <button
                        onClick={() => navigate(`/inventory?tab=${backTab}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1.5 mb-3"
                    >
                        <span>←</span> Back to Inventory
                    </button>
                    <div className="flex items-center gap-4 flex-wrap">
                        <h1 className="text-2xl font-bold text-gray-900">{intake.proposed_item_name || 'Unnamed Artifact'}</h1>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border ${getStatusStyles(artifact.status)}`}>
                            {artifact.status === 'deaccessioned' ? 'Deaccessioned' : (artifact.status === 'loaned' ? 'On Display' : (artifact.status === 'maintenance' ? 'Under Maintenance' : 'In Storage'))}
                        </span>
                    </div>
                    <p className="text-base text-gray-500 mt-2">
                        Acquired on {artifact.created ? new Date(artifact.created).toLocaleDateString() : 'N/A'} &mdash; Origin: {intake.origin || 'N/A'}
                    </p>
                </div>
            </section>

            {/* ── Detail Card ── */}
            <div className="border border-gray-200 bg-white rounded-lg shadow-sm">
                
                {/* Card Header */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-700">Master Record Manifest</span>
                        <span className="text-sm text-gray-500 font-mono">#{artifact.catalog_number}</span>
                    </div>
                    <span className="text-xs text-zinc-400 font-mono">SHA: {artifact.id.substring(0, 8)}</span>
                </div>

                {/* Subsystem Tabs */}
                <div className="flex border-b border-gray-200 bg-white px-6 flex-wrap overflow-x-auto">
                    {[
                        { id: 'provenance', label: 'Provenance', icon: <FileText className="w-3.5 h-3.5" /> },
                        { id: 'trails', label: 'Movement Trails', icon: <History className="w-3.5 h-3.5" /> },
                        { id: 'reports', label: 'Condition Reports', icon: <ClipboardList className="w-3.5 h-3.5" /> },
                        { id: 'valuations', label: 'Market Valuation', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                        { id: 'audits', label: 'Compliance Audits', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
                        { id: 'conservation', label: 'Conservation', icon: <Activity className="w-3.5 h-3.5" /> },
                        { id: 'exhibitions', label: 'Exhibitions', icon: <MapPin className="w-3.5 h-3.5" /> }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setDetailTab(tab.id)}
                            className={`px-5 py-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 ${
                                detailTab === tab.id 
                                    ? 'border-[#D4AF37] text-black bg-zinc-50' 
                                    : 'border-transparent text-zinc-400 hover:text-black'
                            }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Active Tab Panel */}
                <div className="p-6 min-h-[350px]">
                    
                    {/* Provenance Panel */}
                    {detailTab === 'provenance' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <Section title="Archival Identity">
                                <Field label="Catalog Number" value={artifact.catalog_number} />
                                <Field label="Accession Reference" value={accession.accession_number} />
                                <Field label="Permanent Location" value={artifact.current_location || 'Receiving Bay'} />
                                <Field label="Acquisition Method" value={accession.contract_type?.replace(/_/g, ' ')} />
                                {accession.contract_type?.toLowerCase() === 'loan' && (
                                    <Field label="Loan Ends" value={intake.loan_end_date ? new Date(intake.loan_end_date).toLocaleDateString() : 'No Limit'} />
                                )}
                            </Section>

                            <Section title="Technical Specifications">
                                <Field label="Dimensions" value={accession.dimensions || 'N/A'} />
                                <Field label="Materials" value={accession.materials || 'N/A'} />
                            </Section>

                            <Section title="Historical Significance & Story">
                                <TextBlock label="Story Summary" value={accession.historical_significance || 'Ongoing archival research.'} italic={true} />
                            </Section>
                        </div>
                    )}

                    {/* Movement Trails Panel */}
                    {detailTab === 'trails' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Movement History</h4>
                                {artifact.status !== 'deaccessioned' && (
                                    <button 
                                        onClick={() => setShowMovementForm(true)}
                                        className="text-xs font-bold text-blue-600 hover:underline"
                                    >
                                        + Record Movement
                                    </button>
                                )}
                            </div>

                            {showMovementForm && (
                                <div className="bg-zinc-50 border border-zinc-200 rounded p-6 relative animate-in slide-in-from-top-4 duration-300">
                                    <button onClick={() => setShowMovementForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black">✕</button>
                                    <MovementForm 
                                        locations={locations}
                                        actionLoading={actionLoading}
                                        onCancel={() => setShowMovementForm(false)}
                                        onSubmit={handleMovementSubmit}
                                    />
                                </div>
                            )}

                            <div className="space-y-4">
                                {movementTrails.map((trail, i) => (
                                    <div key={i} className="flex gap-4 p-4 border border-gray-200 rounded bg-white hover:bg-gray-50/50 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 border border-zinc-200">
                                            <MapPin className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between items-start">
                                                <div className="text-sm font-semibold text-gray-900">{trail.to_location}</div>
                                                <div className="text-xs font-mono text-zinc-400">{trail.created_at || trail.created ? new Date(trail.created_at || trail.created).toLocaleDateString() : ''}</div>
                                            </div>
                                            <p className="text-xs text-zinc-500 italic">"{trail.reason}"</p>
                                            <div className="text-[10px] text-zinc-400">Moved by: {trail.moved_by_name || trail.authorized_by || 'Staff'}</div>
                                        </div>
                                    </div>
                                ))}
                                {movementTrails.length === 0 && (
                                    <div className="py-12 text-center text-gray-400 italic">No movement logged.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Condition Reports Panel */}
                    {detailTab === 'reports' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Condition Assessments</h4>
                                {artifact.status !== 'deaccessioned' && (
                                    <button 
                                        onClick={() => setShowHealthForm(true)}
                                        className="text-xs font-bold text-blue-600 hover:underline"
                                    >
                                        + New Assessment
                                    </button>
                                )}
                            </div>

                            {showHealthForm && (
                                <div className="bg-zinc-50 border border-zinc-200 rounded p-6 relative animate-in slide-in-from-top-4 duration-300">
                                    <button onClick={() => setShowHealthForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black">✕</button>
                                    <FormRenderer 
                                        slug="artifact-health"
                                        compact={true}
                                        hideHeader={true}
                                        customFetch={apiFetch}
                                        prefillData={{ artifact_id: artifact.id }}
                                        onSuccess={() => { setShowHealthForm(false); fetchDetails(true); }}
                                    />
                                </div>
                            )}

                            <div className="space-y-4">
                                {healthLogs.map((log, i) => (
                                    <div key={i} className="p-4 border border-gray-200 rounded bg-white hover:bg-gray-50/50 transition-colors flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider border ${
                                                    log.condition === 'Excellent' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    log.condition === 'Fair' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                    {log.condition}
                                                </span>
                                                <span className="text-xs font-mono text-zinc-400">{new Date(log.created_at || log.created).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-zinc-600 font-light italic">"{log.notes}"</p>
                                            <div className="text-[10px] text-zinc-400">Reporter: {log.reporter_name || 'MB-STAFF'}</div>
                                        </div>
                                    </div>
                                ))}
                                {healthLogs.length === 0 && (
                                    <div className="py-12 text-center text-gray-400 italic">No health assessments on record.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Market Valuation Panel */}
                    {detailTab === 'valuations' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Financial Valuations</h4>
                                {artifact.status !== 'deaccessioned' && (
                                    <button 
                                        onClick={handleValuation}
                                        className="text-xs font-bold text-blue-600 hover:underline"
                                    >
                                        + Record Valuation
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {valuations.map((v, i) => (
                                    <div key={i} className="p-4 border border-gray-200 rounded bg-white flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                                        <div>
                                            <div className="text-lg font-bold text-gray-900">PHP {v.amount.toLocaleString()}</div>
                                            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{v.reason}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-mono text-zinc-400">{new Date(v.created_at || v.created).toLocaleDateString()}</div>
                                            <div className="text-[9px] text-[#A68A27] font-bold uppercase tracking-widest mt-1">Appraised</div>
                                        </div>
                                    </div>
                                ))}
                                {valuations.length === 0 && (
                                    <div className="py-12 text-center text-gray-400 italic">No valuation history on record.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Compliance Audits Panel */}
                    {detailTab === 'audits' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Ledger Audits</h4>
                                {artifact.status !== 'deaccessioned' && (
                                    <button 
                                        onClick={handleSpotCheck}
                                        className="text-xs font-bold text-blue-600 hover:underline"
                                    >
                                        + Record Spot Check
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                {auditLogs.map((a, i) => (
                                    <div key={i} className="p-4 border border-gray-200 rounded bg-white hover:bg-gray-50/50 transition-colors flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <ShieldCheck className="w-4 h-4 text-green-500" />
                                                <div className="text-xs font-bold text-gray-900 uppercase">VERIFIED LOCATION</div>
                                            </div>
                                            <p className="text-xs text-zinc-500 italic">"{a.discrepancy_notes || a.notes || 'Object found in correct location.'}"</p>
                                            <div className="text-[10px] text-zinc-400 mt-2">
                                                Auditor: {a.audited_by_name || 'MB-STAFF'} • Location: {a.audited_location || artifact.current_location}
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-zinc-400">{new Date(a.created_at || a.created || a.audit_date).toLocaleDateString()}</div>
                                    </div>
                                ))}
                                {auditLogs.length === 0 && (
                                    <div className="py-12 text-center text-gray-400 italic">No spot checks recorded.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Conservation Treatment Panel */}
                    {detailTab === 'conservation' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Conservation Treatments</h4>
                                {artifact.status !== 'deaccessioned' && (
                                    <button 
                                        onClick={() => setShowConservationForm(!showConservationForm)}
                                        className="text-xs font-bold text-blue-600 hover:underline"
                                    >
                                        + Record Treatment
                                    </button>
                                )}
                            </div>

                            {showConservationForm && (
                                <div className="bg-zinc-50 border border-zinc-200 rounded p-6 relative animate-in slide-in-from-top-4 duration-300">
                                    <button onClick={() => setShowConservationForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black">✕</button>
                                    <FormRenderer 
                                        slug="artifact-conservation"
                                        compact={true}
                                        hideHeader={true}
                                        customFetch={apiFetch}
                                        prefillData={{ artifact_id: artifact.id }}
                                        onSuccess={() => { setShowConservationForm(false); fetchDetails(true); }}
                                    />
                                </div>
                            )}

                            <div className="space-y-4">
                                {conservationLogs.map((c, i) => (
                                    <div key={i} className="p-4 border border-gray-200 rounded bg-white hover:bg-gray-50/50 transition-colors flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Activity className="w-4 h-4 text-[#D4AF37]" />
                                                <div className="text-xs font-bold text-gray-900 uppercase">{c.treatment_objective || 'Conservation Log'}</div>
                                            </div>
                                            <p className="text-xs text-zinc-700">{c.treatment}</p>
                                            {c.findings && <p className="text-[10px] text-zinc-500 italic mt-1">Findings: {c.findings}</p>}
                                            <div className="text-[10px] text-zinc-400 mt-2">Conservator: {c.conservator_name_resolved || c.conservator_name || 'MB-STAFF'}</div>
                                        </div>
                                        <div className="text-xs font-mono text-zinc-400">{new Date(c.created_at || c.created).toLocaleDateString()}</div>
                                    </div>
                                ))}
                                {conservationLogs.length === 0 && (
                                    <div className="py-12 text-center text-gray-400 italic">No conservation treatments logged.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Exhibitions Panel */}
                    {detailTab === 'exhibitions' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Exhibitions History</h4>

                            <div className="space-y-4">
                                {exhibitionHistory.map((e, i) => (
                                    <div key={i} className="p-4 border border-gray-200 rounded bg-white hover:bg-gray-50/50 transition-colors flex flex-col gap-1.5">
                                        <div className="flex justify-between items-start">
                                            <div className="text-sm font-semibold text-gray-900">{e.exhibition_title || e.title}</div>
                                            <span className="px-2 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-wider border border-zinc-200 bg-zinc-50 text-zinc-600">
                                                {e.exhibition_status || e.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-zinc-500">Details: {e.notes || 'Featured exhibit piece'}</div>
                                        <div className="text-[10px] text-zinc-400 font-mono">
                                            Dates: {new Date(e.start_date || e.start).toLocaleDateString()} - {new Date(e.end_date || e.end).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                                {exhibitionHistory.length === 0 && (
                                    <div className="py-12 text-center text-gray-400 italic">No exhibition records found.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Action Footer ── */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-wrap items-center rounded-b-lg">
                    {artifact.status !== 'deaccessioned' && (
                        <button 
                            onClick={handleDeaccession}
                            className="px-5 py-2.5 bg-white border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 hover:text-red-800 transition-colors rounded-md"
                        >
                            Deaccession Artifact
                        </button>
                    )}

                    <a 
                        href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/acquisitions/inventory/${artifact.id}/export`}
                        target="_blank" rel="noreferrer"
                        className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 hover:text-gray-900 transition-colors rounded-md"
                    >
                        Export Ledger
                    </a>

                    {detailTab === 'reports' && healthLogs.length > 0 && (
                        <a 
                            href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/acquisitions/inventory/${artifact.id}/export-condition`}
                            target="_blank" rel="noreferrer"
                            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 hover:text-gray-900 transition-colors rounded-md"
                        >
                            Export Condition Report
                        </a>
                    )}

                    {artifact.status === 'deaccessioned' && (
                        <a 
                            href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/acquisitions/inventory/${artifact.id}/export-deaccession`}
                            target="_blank" rel="noreferrer"
                            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 hover:text-gray-900 transition-colors rounded-md"
                        >
                            Export Certificate
                        </a>
                    )}

                    <button 
                        onClick={() => window.print()}
                        className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors rounded-md"
                    >
                        Print ID Label
                    </button>
                </div>
            </div>

            {/* ── Realtime Confirmation Modal ── */}
            <Modal
                {...modal}
                onClose={() => setModal({ ...modal, isOpen: false })}
                onInputChange={(val) => setModal({ ...modal, promptValue: val })}
                inputValue={modal.promptValue}
            />
        </div>
    );
}