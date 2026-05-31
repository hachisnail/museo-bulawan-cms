import { STATUS_STYLES } from './AccessionDetail';

export default function AccessionList({
    activeTab,
    setActiveTab,
    accessions,
    archived,
    selected,
    setSelected,
    loading,
    setSearchParams,
    fetchArchiveMedia
}) {
    const displayList = activeTab === 'active' ? accessions : archived;

    return (
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
            {/* Tabs */}
            <div className="flex border-b border-zinc-200">
                <button 
                    onClick={() => { setActiveTab('active'); setSelected(null); setSearchParams({ tab: 'active' }); }}
                    className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'active' ? 'border-[#D4AF37] text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                >
                    Active Registry ({accessions.length})
                </button>
                <button 
                    onClick={() => { setActiveTab('archive'); setSelected(null); setSearchParams({ tab: 'archive' }); }}
                    className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'archive' ? 'border-[#D4AF37] text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                >
                    Archive ({archived.length})
                </button>
            </div>

            {/* List */}
            <div className="border border-zinc-200 bg-white rounded-sm divide-y divide-zinc-100 h-[700px] overflow-y-auto">
                {loading ? (
                    <div className="p-8 text-center text-xs text-zinc-400 uppercase tracking-widest animate-pulse">Updating Registry...</div>
                ) : displayList.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-400 italic">No records found.</div>
                ) : (
                    displayList.map((item) => {
                        const isSelected = selected?.id === item.id;
                        const title = activeTab === 'active' 
                            ? item.expand?.intake_id?.proposed_item_name 
                            : item.expand?.accession_id?.expand?.intake_id?.proposed_item_name;
                        const number = activeTab === 'active' ? item.accession_number : item.catalog_number;
                        
                        return (
                            <button 
                                key={item.id} 
                                onClick={() => {
                                    setSelected(item);
                                    setSearchParams({ id: item.id, tab: activeTab });
                                    if (activeTab === 'archive') fetchArchiveMedia(item);
                                }}
                                className={`w-full p-4 text-left transition-colors flex flex-col gap-2 border-l-4 ${isSelected ? 'bg-zinc-50 border-[#D4AF37]' : 'bg-white border-transparent hover:bg-zinc-50'}`}
                            >
                                <div className="flex justify-between items-start w-full">
                                    <div className="font-bold text-sm text-black line-clamp-1 pr-4">
                                        {title || 'Unnamed Artifact'}
                                    </div>
                                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-widest border ${activeTab === 'active' ? STATUS_STYLES[item.status] : STATUS_STYLES.archived}`}>
                                        {activeTab === 'active' ? item.status.replace(/_/g, ' ') : 'Archived'}
                                    </span>
                                </div>
                                <div className="text-xs text-zinc-500 font-mono">
                                    REF: {number}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
