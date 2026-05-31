import { useState } from 'react';
import { 
    Box, 
    MapPin, 
    History, 
    ShieldCheck, 
    FileText, 
    X,
    TrendingUp,
    Activity,
    ClipboardList
} from 'lucide-react';
import FormRenderer from '../FormRenderer';
import MovementForm from './MovementForm';

export const ITEM_STATUS_COLORS = {
    active: 'bg-green-50 text-green-700 border-green-200',
    deaccessioned: 'bg-zinc-50 text-zinc-500 border-zinc-300',
    archived: 'bg-zinc-50 text-zinc-500 border-zinc-300',
    loaned: 'bg-blue-50 text-blue-700 border-blue-200',
    maintenance: 'bg-amber-50 text-amber-700 border-amber-200'
};

export default function InventoryDetail({
    selected,
    activeTab,
    locations,
    apiFetch,
    setSelected,
    actionLoading,
    setSearchParams,
    movementTrails,
    healthLogs,
    valuations,
    auditLogs,
    conservationLogs,
    exhibitionHistory,
    fetchDetails,
    handleDeaccession,
    handleValuation,
    handleMovementSubmit
}) {
    const [detailTab, setDetailTab] = useState('provenance');
    const [showMovementForm, setShowMovementForm] = useState(false);
    const [showHealthForm, setShowHealthForm] = useState(false);
    const [showConservationForm, setShowConservationForm] = useState(false);

    if (!selected) {
        return (
            <div className="h-[700px] bg-zinc-50 border border-zinc-300 rounded-sm flex flex-col items-center justify-center gap-4 text-center p-12">
                <Box className="w-12 h-12 text-zinc-200" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300">
                    Select an artifact to view complete archival manifest
                </p>
            </div>
        );
    }

    const handleSpotCheck = () => {
        const notes = prompt("Enter audit notes (e.g. Verified by spot check):");
        if (notes !== null) {
            apiFetch(`/api/v1/acquisitions/inventory/${selected.id}/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    objectFound: true, 
                    auditedLocation: selected.current_location, 
                    discrepancyNotes: notes 
                })
            })
            .then(res => {
                if (res.ok) fetchDetails(selected, false);
            })
            .catch(err => console.error("Spot check log failed", err));
        }
    };

    return (
        <div className="bg-white border border-zinc-300 rounded-sm shadow-xl flex flex-col h-[700px] overflow-hidden animate-in slide-in-from-right-4 duration-500">
            {/* Detail Header */}
            <div className="p-8 border-b border-zinc-300 bg-zinc-50 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="px-3 py-1 bg-black text-[#D4AF37] text-[9px] font-black uppercase tracking-widest rounded-sm">
                            Artifact Record
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 font-bold">SHA: {selected.id.substring(0,8)}</span>
                    </div>
                    <h2 className="text-3xl font-serif text-black uppercase tracking-tight leading-tight">
                        {selected.expand?.accession_id?.expand?.intake_id?.proposed_item_name || 'Unnamed Artifact'}
                    </h2>
                </div>
                <button 
                    onClick={() => { setSelected(null); setSearchParams({ tab: activeTab }); }}
                    className="p-3 bg-white border border-zinc-300 rounded-sm hover:bg-zinc-50 transition-all text-zinc-400 hover:text-black"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Detail Body (Tabs) */}
            <div className="flex border-b border-zinc-300 bg-white px-8 flex-wrap max-h-24 overflow-y-auto">
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
                        className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border-b-2 ${detailTab === tab.id ? 'border-[#D4AF37] text-black bg-zinc-50' : 'border-transparent text-zinc-400 hover:text-black'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-10">
                {detailTab === 'provenance' && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                        <div className="grid grid-cols-2 gap-10">
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2">Archival Identity</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Catalog Number</label>
                                        <div className="text-sm font-bold text-black font-mono">{selected.catalog_number}</div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Accession Reference</label>
                                        <div className="text-sm font-bold text-black font-mono">{selected.expand?.accession_id?.accession_number}</div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Permanent Location</label>
                                        <div className="flex items-center gap-2 text-sm font-bold text-black">
                                            <MapPin className="w-4 h-4 text-[#D4AF37]" />
                                            {selected.current_location || 'Receiving Bay'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Acquisition Method</label>
                                        <div className="text-sm font-bold text-black uppercase tracking-wider">
                                            {selected.expand?.accession_id?.contract_type?.replace(/_/g, ' ') || 'N/A'}
                                        </div>
                                    </div>
                                    {selected.expand?.accession_id?.contract_type?.toLowerCase() === 'loan' && (
                                        <div>
                                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Loan Ends</label>
                                            <div className="text-xs text-amber-600 font-bold uppercase tracking-wider">
                                                {selected.expand?.accession_id?.expand?.intake_id?.loan_end_date 
                                                    ? new Date(selected.expand.accession_id.expand.intake_id.loan_end_date).toLocaleDateString() 
                                                    : 'No Limit'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2">Technical Specs</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Dimensions</label>
                                        <div className="text-sm text-black">{selected.expand?.accession_id?.dimensions || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Materials</label>
                                        <div className="text-sm text-black">{selected.expand?.accession_id?.materials || 'N/A'}</div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <section className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2">Historical Significance</h4>
                            <p className="text-sm text-black leading-relaxed font-serif italic bg-zinc-50 p-6 border border-zinc-300 rounded-sm">
                                {selected.expand?.accession_id?.historical_significance || 'Archival research is ongoing for this specimen.'}
                            </p>
                        </section>
                    </div>
                )}

                {detailTab === 'trails' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Movement History</h4>
                            {selected.status !== 'deaccessioned' && (
                                <button 
                                    onClick={() => setShowMovementForm(true)}
                                    className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37] hover:text-black transition-colors"
                                >
                                    + Record Movement
                                </button>
                            )}
                        </div>

                        {showMovementForm && (
                            <div className="bg-zinc-50 border border-zinc-300 rounded-sm p-8 mb-8 animate-in slide-in-from-top-4 duration-300 relative">
                                <button onClick={() => setShowMovementForm(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-black">✕</button>
                                <MovementForm 
                                    locations={locations}
                                    actionLoading={actionLoading}
                                    onCancel={() => setShowMovementForm(false)}
                                    onSubmit={(data) => {
                                        handleMovementSubmit(data);
                                        setShowMovementForm(false);
                                    }}
                                />
                            </div>
                        )}

                        <div className="space-y-0.5">
                            {movementTrails.map((trail, i) => (
                                <div key={i} className="flex gap-6 p-6 bg-white border border-zinc-300 group hover:bg-zinc-50 transition-all rounded-sm">
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 border border-zinc-200">
                                            <MapPin className="w-4 h-4" />
                                        </div>
                                        {i < movementTrails.length - 1 && <div className="w-0.5 flex-1 bg-zinc-100 mt-2"></div>}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex justify-between">
                                            <div className="text-xs font-black uppercase text-black">{trail.to_location}</div>
                                            <div className="text-[10px] font-mono text-zinc-400">{new Date(trail.created).toLocaleDateString()}</div>
                                        </div>
                                        <p className="text-xs text-zinc-500 font-light italic">"{trail.reason}"</p>
                                        <div className="text-[9px] uppercase font-bold text-zinc-400">Authorized by: {trail.authorized_by || 'MB-SERVER'}</div>
                                    </div>
                                </div>
                            ))}
                            {movementTrails.length === 0 && (
                                <div className="py-20 text-center text-[10px] uppercase font-black tracking-widest text-zinc-300">No movement recorded</div>
                            )}
                        </div>
                    </div>
                )}

                {detailTab === 'reports' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Condition Assessment Registry</h4>
                            {selected.status !== 'deaccessioned' && (
                                <button 
                                    onClick={() => setShowHealthForm(true)}
                                    className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37] hover:text-black transition-colors"
                                >
                                    + New Assessment
                                </button>
                            )}
                        </div>

                        {showHealthForm && (
                            <div className="bg-zinc-50 border border-zinc-300 rounded-sm p-8 mb-8 animate-in slide-in-from-top-4 duration-300 relative">
                                <button onClick={() => setShowHealthForm(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-black">✕</button>
                                <FormRenderer 
                                    slug="artifact-health"
                                    compact={true}
                                    hideHeader={true}
                                    customFetch={apiFetch}
                                    prefillData={{ artifact_id: selected.id }}
                                    onSuccess={() => { setShowHealthForm(false); fetchDetails(selected, false); }}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                            {healthLogs.map((log, i) => (
                                <div key={i} className="p-6 border border-zinc-300 rounded-sm bg-zinc-50/50 hover:bg-zinc-50 transition-all flex justify-between items-start">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest border ${
                                                log.condition === 'Excellent' ? 'bg-green-50 text-green-700 border-green-200' :
                                                log.condition === 'Fair' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                'bg-red-50 text-red-700 border-red-200'
                                            }`}>
                                                {log.condition}
                                            </span>
                                            <span className="text-[10px] font-mono text-zinc-400">{new Date(log.created).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm text-zinc-600 font-light italic leading-relaxed">"{log.notes}"</p>
                                        <div className="text-[9px] uppercase font-bold text-zinc-400">Reporter: {log.reporter_name || 'MB-STAFF'}</div>
                                    </div>
                                </div>
                            ))}
                            {healthLogs.length === 0 && (
                                <div className="py-20 text-center text-[10px] uppercase font-black tracking-widest text-zinc-300">No condition reports found</div>
                            )}
                        </div>
                    </div>
                )}

                {detailTab === 'valuations' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Market Appraisal History</h4>
                            {selected.status !== 'deaccessioned' && (
                                <button 
                                    onClick={handleValuation}
                                    className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37] hover:text-black transition-colors"
                                >
                                    + Add Valuation
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-0.5">
                            {valuations.map((v, i) => (
                                <div key={i} className="p-8 border border-zinc-300 rounded-sm bg-white flex justify-between items-center group hover:bg-zinc-50 transition-all">
                                    <div>
                                        <div className="text-2xl font-serif text-black mb-1">PHP {v.amount.toLocaleString()}</div>
                                        <div className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{v.reason}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-mono text-zinc-400 uppercase">{new Date(v.created).toLocaleDateString()}</div>
                                        <div className="text-[9px] text-[#A68A27] font-bold uppercase tracking-tighter mt-1">Verified Appraisal</div>
                                    </div>
                                </div>
                            ))}
                            {valuations.length === 0 && (
                                <div className="py-20 text-center text-[10px] uppercase font-black tracking-widest text-zinc-300">No financial data on record</div>
                            )}
                        </div>
                    </div>
                )}

                {detailTab === 'audits' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Compliance Audits</h4>
                            {selected.status !== 'deaccessioned' && (
                                <button 
                                    onClick={handleSpotCheck}
                                    className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37] hover:text-black transition-colors"
                                >
                                    + Record Spot Check
                                </button>
                            )}
                        </div>

                        <div className="space-y-0.5">
                            {auditLogs.map((a, i) => (
                                <div key={i} className="p-6 border border-zinc-300 rounded-sm bg-white hover:bg-zinc-50 transition-all flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <ShieldCheck className={`w-4 h-4 text-green-500`} />
                                            <div className="text-sm font-black text-black">VERIFIED</div>
                                        </div>
                                        <p className="text-xs text-zinc-500 font-light italic">"{a.discrepancy_notes || a.notes || 'Object found in correct location.'}"</p>
                                        <div className="text-[9px] uppercase font-bold text-zinc-400 mt-2">Auditor: {a.audited_by || 'MB-STAFF'} • Loc: {a.audited_location || selected.current_location}</div>
                                    </div>
                                    <div className="text-[10px] font-mono text-zinc-400">{new Date(a.created || a.audit_date).toLocaleDateString()}</div>
                                </div>
                            ))}
                            {auditLogs.length === 0 && (
                                <div className="py-20 text-center text-[10px] uppercase font-black tracking-widest text-zinc-300">No audits recorded</div>
                            )}
                        </div>
                    </div>
                )}

                {detailTab === 'conservation' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Conservation Treatments</h4>
                            {selected.status !== 'deaccessioned' && (
                                <button 
                                    onClick={() => setShowConservationForm(!showConservationForm)}
                                    className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37] hover:text-black transition-colors"
                                >
                                    + Add Treatment Log
                                </button>
                            )}
                        </div>

                        {showConservationForm && (
                            <div className="bg-zinc-50 border border-zinc-300 rounded-sm p-8 mb-8 animate-in slide-in-from-top-4 duration-300 relative">
                                <button onClick={() => setShowConservationForm(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-black">✕</button>
                                <FormRenderer 
                                    slug="artifact-conservation"
                                    compact={true}
                                    hideHeader={true}
                                    customFetch={apiFetch}
                                    prefillData={{ artifact_id: selected.id }}
                                    onSuccess={() => { setShowConservationForm(false); fetchDetails(selected, false); }}
                                />
                            </div>
                        )}

                        <div className="space-y-0.5">
                            {conservationLogs.map((c, i) => (
                                <div key={i} className="p-6 border border-zinc-300 rounded-sm bg-white hover:bg-zinc-50 transition-all flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Activity className="w-4 h-4 text-[#D4AF37]" />
                                            <div className="text-xs font-black uppercase text-black">{c.treatment_objective || 'Conservation Log'}</div>
                                        </div>
                                        <p className="text-xs text-zinc-600 mb-1">{c.treatment}</p>
                                        <p className="text-[10px] text-zinc-500 italic">Findings: {c.findings}</p>
                                        <div className="text-[9px] uppercase font-bold text-zinc-400 mt-2">Conservator: {c.conservator_name || 'MB-STAFF'}</div>
                                    </div>
                                    <div className="text-[10px] font-mono text-zinc-400">{new Date(c.created || c.created_at).toLocaleDateString()}</div>
                                </div>
                            ))}
                            {conservationLogs.length === 0 && (
                                <div className="py-20 text-center text-[10px] uppercase font-black tracking-widest text-zinc-300">No conservation logs</div>
                            )}
                        </div>
                    </div>
                )}

                {detailTab === 'exhibitions' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Exhibition History</h4>
                        </div>
                        <div className="space-y-0.5">
                            {exhibitionHistory.map((e, i) => (
                                <div key={i} className="p-6 border border-zinc-300 rounded-sm bg-white hover:bg-zinc-50 transition-all flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <div className="text-sm font-black text-black uppercase tracking-wider">{e.exhibition_title || e.title}</div>
                                        <span className="px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest border border-zinc-200 bg-zinc-50 text-zinc-600">
                                            {e.exhibition_status || e.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-zinc-500">Role/Notes: {e.notes || 'Featured artifact'}</div>
                                    <div className="text-[9px] uppercase font-bold text-zinc-400 mt-2 font-mono">
                                        {new Date(e.start_date || e.start).toLocaleDateString()} - {new Date(e.end_date || e.end).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                            {exhibitionHistory.length === 0 && (
                                <div className="py-20 text-center text-[10px] uppercase font-black tracking-widest text-zinc-300">No exhibition history</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Actions Bar */}
            <div className="p-6 bg-zinc-50 border-t border-zinc-300 flex justify-end gap-3 flex-wrap">
                {selected.status !== 'deaccessioned' && (
                    <button 
                        onClick={() => handleDeaccession(selected.id)}
                        className="px-6 py-3 bg-white border border-red-200 text-red-700 text-[9px] font-black uppercase tracking-widest rounded-sm hover:bg-red-50 transition-all"
                    >
                        Deaccession Artifact
                    </button>
                )}
                <a 
                    href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/acquisitions/inventory/${selected.id}/export`}
                    target="_blank" rel="noreferrer"
                    className="px-6 py-3 bg-white border border-zinc-300 text-black text-[9px] font-black uppercase tracking-widest rounded-sm hover:bg-zinc-100 transition-all block text-center"
                >
                    Export Ledger
                </a>
                {detailTab === 'reports' && healthLogs.length > 0 && (
                    <a 
                        href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/acquisitions/inventory/${selected.id}/export-condition`}
                        target="_blank" rel="noreferrer"
                        className="px-6 py-3 bg-white border border-zinc-300 text-black text-[9px] font-black uppercase tracking-widest rounded-sm hover:bg-zinc-100 transition-all block text-center"
                    >
                        Export Condition Report
                    </a>
                )}
                {selected.status === 'deaccessioned' && (
                    <a 
                        href={`${import.meta.env.VITE_API_BASE_URL}/api/v1/acquisitions/inventory/${selected.id}/export-deaccession`}
                        target="_blank" rel="noreferrer"
                        className="px-6 py-3 bg-white border border-zinc-300 text-black text-[9px] font-black uppercase tracking-widest rounded-sm hover:bg-zinc-100 transition-all block text-center"
                    >
                        Export Certificate
                    </a>
                )}
                <button className="px-6 py-3 bg-black text-[#D4AF37] text-[9px] font-black uppercase tracking-widest rounded-sm hover:bg-zinc-900 transition-all">
                    Print ID Label
                </button>
            </div>
        </div>
    );
}
