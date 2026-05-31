import { Search, MapPin } from 'lucide-react';
import { ITEM_STATUS_COLORS } from './InventoryDetail';

export default function InventoryList({
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    filteredInventory,
    selected,
    fetchDetails,
    loading,
    setSearchParams
}) {
    return (
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
            {/* Tabs */}
            <div className="flex border-b border-zinc-300">
                <button 
                    onClick={() => { setActiveTab('active'); setSearchParams({ tab: 'active' }); }}
                    className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'active' ? 'border-[#D4AF37] text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                >
                    Collection
                </button>
                <button 
                    onClick={() => { setActiveTab('archived'); setSearchParams({ tab: 'archived' }); }}
                    className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'archived' ? 'border-[#D4AF37] text-black' : 'border-transparent text-zinc-400 hover:text-black'}`}
                >
                    Deaccessioned
                </button>
            </div>

            {/* Search */}
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-black transition-colors" />
                <input 
                    type="text" 
                    placeholder="Filter collection..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-sm pl-10 pr-4 py-2.5 text-sm text-black focus:outline-none focus:border-[#D4AF37] transition-all"
                />
            </div>

            {/* List Container */}
            <div className="bg-white border border-zinc-300 rounded-sm divide-y divide-zinc-200 h-[700px] overflow-y-auto shadow-sm">
                {loading ? (
                    <div className="p-12 text-center flex flex-col items-center gap-4">
                        <div className="w-5 h-5 border-2 border-zinc-200 border-t-black rounded-full animate-spin" />
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">Verifying Ledger...</div>
                    </div>
                ) : filteredInventory.length === 0 ? (
                    <div className="p-12 text-center text-xs text-zinc-400 italic">No artifacts found.</div>
                ) : (
                    filteredInventory.map(item => (
                        <button 
                            key={item.id}
                            onClick={() => fetchDetails(item, true)}
                            className={`w-full p-5 text-left transition-all border-l-4 flex flex-col gap-2 ${selected?.id === item.id ? 'bg-zinc-50 border-[#D4AF37]' : 'border-transparent hover:bg-zinc-50'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="font-bold text-sm text-black line-clamp-1 pr-4 uppercase">
                                    {item.expand?.accession_id?.expand?.intake_id?.proposed_item_name || 'Unnamed Artifact'}
                                </div>
                                <span className={`flex-shrink-0 px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest border ${ITEM_STATUS_COLORS[item.status] || ITEM_STATUS_COLORS.active}`}>
                                    {item.status}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                                <span className="font-mono">#{item.catalog_number}</span>
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-[#D4AF37]" /> {item.current_location || 'Receiving'}
                                </span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
