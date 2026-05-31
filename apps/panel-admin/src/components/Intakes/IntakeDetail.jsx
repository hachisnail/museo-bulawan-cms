import { useState } from 'react';

// --- Theme Status Colors ---
export const STATUS_STYLES = {
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

export default function IntakeDetail({
    selected,
    locations,
    showLocationSelect,
    setShowLocationSelect,
    apiFetch,
    handleSelectRecord,
    handleAction,
    actionLoading,
    setModal
}) {
    if (!selected) {
        return (
            <div className="h-[600px] border border-zinc-200 bg-zinc-50 flex items-center justify-center rounded-sm">
                <p className="text-sm font-serif italic text-zinc-400">Select a record from the queue to view details.</p>
            </div>
        );
    }

    const isDeliveryPending = selected.type === 'intake' &&
        ['gift', 'loan', 'bequest'].includes((selected.data.acquisition_method || '').toLowerCase()) &&
        ['under_review', 'approved', 'awaiting_delivery'].includes(selected.data.status);

    return (
        <div className="border border-zinc-200 bg-white rounded-sm flex flex-col h-[600px]">
            <div className="p-6 border-b border-zinc-200 bg-zinc-50 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-mono">Record ID: {selected.data.id}</span>
                        <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-widest border ${STATUS_STYLES[selected.data.status] || STATUS_STYLES.pending}`}>
                            {selected.data.status.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <h2 className="text-2xl font-serif text-black uppercase tracking-wider leading-tight">
                        {selected.type === 'submission' ? (selected.data.data?.artifact_name || 'Unnamed Offer') : selected.data.proposed_item_name}
                    </h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-1">Source / Donor</label>
                        <div className="text-sm text-black font-medium">
                            {selected.type === 'submission' 
                                ? (selected.data.data?.is_anonymous === true ? 'Anonymous Donor' : `${selected.data.data?.donor_first_name || ''} ${selected.data.data?.donor_last_name || ''}`.trim() || selected.data.submitted_by)
                                : selected.data.donor_info || selected.data.source_info}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                            {selected.type === 'submission'
                                ? (selected.data.data?.is_anonymous === true ? 'Anonymous (Email Hidden)' : selected.data.data?.donor_email || 'No email provided')
                                : (getIntakeDonorEmail(selected.data) || 'No email provided')}
                        </div>
                        {selected.type === 'submission' && selected.data.data?.is_anonymous !== true && selected.data.data?.donor_phone && (
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
                            {selected.type === 'submission' ? selected.data.data?.acquisition_type || 'Gift' : selected.data.acquisition_method}
                        </div>
                        {((selected.type === 'submission' ? selected.data.data?.acquisition_type : selected.data.acquisition_method)?.toLowerCase() === 'loan') && (
                            <div className="text-xs text-amber-600 font-bold mt-1 uppercase tracking-wider">
                                Loan Return: {selected.type === 'submission'
                                    ? (selected.data.data?.loan_end_date ? new Date(selected.data.data.loan_end_date).toLocaleDateString() : 'No Limit')
                                    : (selected.data.loan_end_date ? new Date(selected.data.loan_end_date).toLocaleDateString() : 'No Limit')}
                            </div>
                        )}
                        <div className="text-xs text-zinc-500 mt-1">
                            Logged: {new Date(selected.data.created || selected.data.created_at).toLocaleDateString()}
                        </div>
                    </div>
                    <div className="col-span-2 pt-4 border-t border-zinc-100 flex items-center justify-between">
                        <div>
                            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-1">Current Physical Location</label>
                            {isDeliveryPending ? (
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Awaiting Delivery — Not Yet Received</span>
                                    </span>
                                </div>
                            ) : (
                                <div className="text-sm text-black font-bold flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[#D4AF37]"></span>
                                    {selected.data.current_location || 'Not Specified (Check Receiving)'}
                                </div>
                            )}
                        </div>
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
                            {selected.type === 'submission' ? selected.data.data?.artifact_description : selected.data.description || 'No description provided.'}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-2">Provenance / History</label>
                        <div className="text-sm text-black leading-relaxed bg-zinc-50 p-4 border border-zinc-200">
                            {selected.type === 'submission' ? selected.data.data?.artifact_provenance : selected.data.provenance || 'No historical background provided.'}
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
                                onConfirm: (val) => handleAction(selected.data.id, 'reject', { reason: val }) 
                            })} 
                            className="px-6 py-3 bg-white border border-red-200 text-red-700 text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-colors rounded-sm"
                        >
                            Decline Offer
                        </button>
                        <button 
                            onClick={() => {
                                const itemName = selected.data.data?.artifact_name || 
                                    (selected.data.data?.is_anonymous ? 'Anonymous Offer' : 
                                    `${selected.data.data?.donor_first_name || ''} ${selected.data.data?.donor_last_name || ''}`.trim()) ||
                                    'this offer';
                                setModal({
                                    isOpen: true,
                                    title: 'Accept Donation & Issue Documents',
                                    message: `Accept "${itemName}" and immediately generate the Deed of Gift and Delivery Slip for the donor? This will send documents to the donor's email.`,
                                    type: 'confirm',
                                    variant: 'info',
                                    onConfirm: () => handleAction(selected.data.id, 'accept_and_issue')
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
                                const donor = selected.type === 'submission' ? `${selected.data.data?.donor_first_name || ''} ${selected.data.data?.donor_last_name || ''}`.trim() : selected.data.donor_info;
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
                        <button onClick={() => setModal({ isOpen: true, title: 'Start Accessioning', message: 'Enter curatorial instructions for handling this artifact:', type: 'prompt', variant: 'info', onConfirm: (val) => handleAction(selected.data.id, 'accession', { handlingInstructions: val }) })} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm">
                            Start Accessioning
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
