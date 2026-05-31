import { STATUS_STYLES } from './IntakeDetail'; // We'll export STATUS_STYLES from IntakeDetail

export default function IntakeList({
    submissions,
    intakes,
    activeTab,
    setActiveTab,
    selected,
    handleSelectRecord,
    loading,
    setSearchParams,
    isRegistering,
    setIsRegistering,
    setSelected
}) {
    let list = [];
    if (activeTab === 'submissions') list = submissions.filter(s => s.status !== 'archived');
    else if (activeTab === 'intakes') list = intakes.filter(i => i.status !== 'rejected');
    else if (activeTab === 'archive') {
        list = [
            ...submissions.filter(s => s.status === 'archived').map(s => ({ ...s, _type: 'submission' })),
            ...intakes.filter(i => i.status === 'rejected').map(i => ({ ...i, _type: 'intake' }))
        ];
    }

    return (
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
                ) : list.length === 0 ? (
                    <div className="p-12 text-center text-xs text-zinc-400 italic">No records found.</div>
                ) : (
                    list.sort((a, b) => new Date(b.created || b.created_at) - new Date(a.created || a.created_at)).map((item) => {
                        const isSelected = selected?.data?.id === item.id;
                        const type = item._type || activeTab.slice(0, -1);
                        return (
                            <button 
                                key={item.id} 
                                onClick={() => handleSelectRecord(type, item, true)}
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
                    })
                )}
            </div>
        </div>
    );
}
