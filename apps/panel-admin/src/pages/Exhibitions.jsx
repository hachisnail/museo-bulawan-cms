import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/authContext';
import { Calendar, MapPin, ClipboardList, Plus, Search, X, CheckCircle2, History } from 'lucide-react';
import Modal from '../components/Modal';

export default function Exhibitions() {
    const { apiFetch } = useAuth();
    const [exhibitions, setExhibitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });
    
    const [formData, setFormData] = useState({
        title: '',
        venue: '',
        startDate: '',
        endDate: '',
        description: '',
        status: 'planning'
    });

    const [inventorySearch, setInventorySearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/v1/acquisitions/exhibitions');
            const data = await res.json();
            if (data.status === 'success') {
                setExhibitions(data.data.items);
            }
        } catch (err) {
            console.error("Failed to fetch exhibitions", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    const fetchDetails = async (id) => {
        try {
            const res = await apiFetch(`/api/v1/acquisitions/exhibitions/${id}`);
            const data = await res.json();
            if (data.status === 'success') {
                setSelected(data.data);
                // Map snake_case from API to camelCase for the form
                setFormData({
                    title: data.data.title || '',
                    venue: data.data.venue || '',
                    startDate: data.data.start_date ? data.data.start_date.split('T')[0] : '',
                    endDate: data.data.end_date ? data.data.end_date.split('T')[0] : '',
                    description: data.data.description || '',
                    status: data.data.status || 'planning'
                });
            }
        } catch (err) {}
    };

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const method = selected?.id && isEditing ? 'PATCH' : 'POST';
            const endpoint = selected?.id && isEditing 
                ? `/api/v1/acquisitions/exhibitions/${selected.id}` 
                : '/api/v1/acquisitions/exhibitions';
            
            const res = await apiFetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setModal({ isOpen: true, title: 'Success', message: 'Exhibition record synchronized.', type: 'alert', variant: 'success' });
                setIsEditing(false);
                fetchData();
                if (selected?.id) fetchDetails(selected.id);
                else setSelected(null);
            } else {
                setModal({ isOpen: true, title: 'Error', message: 'Failed to save record.', type: 'alert', variant: 'error' });
            }
        } catch (err) { 
            setModal({ isOpen: true, title: 'Error', message: 'Network failure.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const searchInventory = async () => {
        if (!inventorySearch.trim()) return;
        try {
            const res = await apiFetch('/api/v1/acquisitions/inventory?expand=accession_id');
            const data = await res.json();
            if (data.status === 'success') {
                const results = data.data.items.filter(item => 
                    item.catalog_number.includes(inventorySearch) || 
                    item.expand?.accession_id?.expand?.intake_id?.proposed_item_name?.toLowerCase().includes(inventorySearch.toLowerCase())
                );
                setSearchResults(results);
            }
        } catch (err) {}
    };

    const addArtifact = async (inventoryId) => {
        try {
            const res = await apiFetch(`/api/v1/acquisitions/exhibitions/${selected.id}/artifacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inventoryId, displayNotes: '' })
            });
            if (res.ok) {
                fetchDetails(selected.id);
                setInventorySearch('');
                setSearchResults([]);
            }
        } catch (err) {}
    };

    const removeArtifact = async (inventoryId) => {
        try {
            const res = await apiFetch(`/api/v1/acquisitions/exhibitions/${selected.id}/artifacts/${inventoryId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchDetails(selected.id);
            }
        } catch (err) {}
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-zinc-300 pb-6">
                <div>
                    <h1 className="text-3xl font-serif text-black uppercase tracking-tight">Exhibition Registry</h1>
                    <p className="text-[10px] text-zinc-400 mt-2 uppercase font-black tracking-[0.3em]">Curation & Public Display History</p>
                </div>
                {!selected && (
                    <button 
                        onClick={() => {
                            setSelected(null);
                            setFormData({ title: '', venue: '', startDate: '', endDate: '', description: '', status: 'planning' });
                            setIsEditing(true);
                        }}
                        className="px-6 py-3 bg-black text-[#D4AF37] text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-zinc-900 transition-all flex items-center gap-2 shadow-xl shadow-black/10"
                    >
                        <Plus className="w-4 h-4" /> Plan Exhibition
                    </button>
                )}
                {selected && (
                    <button 
                        onClick={() => { setSelected(null); setIsEditing(false); }}
                        className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black transition-colors flex items-center gap-2 group"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Registry
                    </button>
                )}
            </header>

            <div className="grid grid-cols-12 gap-10">
                {/* List Side */}
                {!selected && !isEditing && (
                    <div className="col-span-12 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {loading ? (
                                <div className="col-span-full py-40 text-center text-[10px] text-zinc-300 uppercase tracking-[0.5em] animate-pulse">Syncing Event Logs...</div>
                            ) : exhibitions.length === 0 ? (
                                <div className="col-span-full py-40 text-center border border-zinc-300 rounded-sm bg-zinc-50">
                                    <div className="text-4xl mb-6 opacity-20">🖼️</div>
                                    <div className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">No active or planned exhibitions found</div>
                                </div>
                            ) : (
                                exhibitions.map(e => (
                                    <button 
                                        key={e.id}
                                        onClick={() => fetchDetails(e.id)}
                                        className="bg-white border border-zinc-300 rounded-sm p-8 text-left hover:shadow-xl hover:shadow-black/5 transition-all group relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <div className={`px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest border ${
                                                e.status === 'active' ? 'bg-green-50 text-green-600 border-green-100' : 
                                                e.status === 'planning' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                'bg-zinc-50 text-zinc-500 border-zinc-300'
                                            }`}>
                                                {e.status}
                                            </div>
                                            <span className="text-[10px] text-zinc-300 font-mono">{e.start_date ? new Date(e.start_date).getFullYear() : 'TBD'}</span>
                                        </div>
                                        <h3 className="text-xl font-serif text-black mb-2 group-hover:text-[#A68A27] transition-colors">{e.title}</h3>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 uppercase font-black tracking-widest">
                                            <MapPin className="w-3 h-3 text-[#D4AF37]" /> {e.venue}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Detail Side / Form */}
                {(selected || isEditing) && (
                    <div className="col-span-12 animate-in slide-in-from-right-4 duration-500">
                        <div className="border border-zinc-300 bg-white rounded-sm shadow-sm overflow-hidden">
                            <div className="p-10 border-b border-zinc-300 bg-zinc-50 flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-serif text-black uppercase tracking-tight">
                                        {isEditing ? (selected ? 'Modify Exhibition Plan' : 'New Exhibition Protocol') : selected.title}
                                    </h2>
                                    {!isEditing && <p className="text-[10px] text-[#A68A27] font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2"><MapPin className="w-3 h-3" /> {selected.venue}</p>}
                                </div>
                                {!isEditing && (
                                    <button 
                                        onClick={() => setIsEditing(true)}
                                        className="px-6 py-2 bg-black text-[#D4AF37] text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-zinc-900 transition-all shadow-lg"
                                    >
                                        Edit Record
                                    </button>
                                )}
                            </div>

                            <div className="p-10">
                                {isEditing ? (
                                    <form onSubmit={handleSave} className="space-y-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Exhibition Title</label>
                                                <input 
                                                    required
                                                    type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] transition-all"
                                                    placeholder="Official title..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Status</label>
                                                <select 
                                                    value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] transition-all"
                                                >
                                                    <option value="planning">Planning / Research</option>
                                                    <option value="active">Active / On Display</option>
                                                    <option value="completed">Completed / Archived</option>
                                                    <option value="cancelled">Cancelled</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Venue</label>
                                                <input 
                                                    required
                                                    type="text" value={formData.venue} onChange={e => setFormData({...formData, venue: e.target.value})}
                                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] transition-all"
                                                    placeholder="e.g. Gallery A"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Start Date</label>
                                                <input 
                                                    type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})}
                                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">End Date</label>
                                                <input 
                                                    type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})}
                                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Curatorial Objectives</label>
                                            <textarea 
                                                rows="5" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                                                className="w-full bg-zinc-50 border border-zinc-200 rounded-sm p-6 text-sm text-black leading-relaxed font-serif italic focus:outline-none focus:border-[#D4AF37] transition-all resize-none"
                                                placeholder="Provide detailed exhibition scope..."
                                            />
                                        </div>

                                        <div className="flex gap-4 pt-6 border-t border-zinc-100">
                                            <button 
                                                type="submit" 
                                                disabled={actionLoading}
                                                className="flex-1 py-4 bg-black text-[#D4AF37] text-[10px] font-black uppercase tracking-widest rounded-sm shadow-xl hover:bg-zinc-900 transition-all disabled:opacity-50"
                                            >
                                                {actionLoading ? 'Synchronizing Registry...' : 'Authorize Exhibition Record'}
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => { setIsEditing(false); if(!selected) setSelected(null); }} 
                                                className="px-10 py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="space-y-16">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                                            <section className="space-y-3">
                                                <h4 className="text-[9px] uppercase font-black text-zinc-400 tracking-widest flex items-center gap-2"><Calendar className="w-3 h-3" /> Event Duration</h4>
                                                <p className="text-lg text-black font-serif italic">
                                                    {selected.start_date ? new Date(selected.start_date).toLocaleDateString() : 'TBD'} — {selected.end_date ? new Date(selected.end_date).toLocaleDateString() : 'TBD'}
                                                </p>
                                            </section>
                                            <section className="space-y-3">
                                                <h4 className="text-[9px] uppercase font-black text-zinc-400 tracking-widest flex items-center gap-2"><ClipboardList className="w-3 h-3" /> Manifest Count</h4>
                                                <p className="text-lg text-black font-bold uppercase tracking-tight">{selected.artifacts?.length || 0} Artifacts Selected</p>
                                            </section>
                                            <section className="space-y-3">
                                                <h4 className="text-[9px] uppercase font-black text-zinc-400 tracking-widest flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Registry Status</h4>
                                                <div className="flex">
                                                    <span className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest border ${
                                                        selected.status === 'active' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                                                    }`}>
                                                        {selected.status}
                                                    </span>
                                                </div>
                                            </section>
                                        </div>

                                        <section className="space-y-6">
                                            <h4 className="text-[9px] uppercase font-black text-zinc-400 tracking-widest border-b border-zinc-100 pb-2">Curatorial Statement</h4>
                                            <div className="text-xl text-zinc-700 leading-relaxed font-serif italic border-l-4 border-[#D4AF37] pl-10 py-2">
                                                {selected.description || 'No statement provided for this exhibition.'}
                                            </div>
                                        </section>

                                        {/* Artifact List */}
                                        <section className="space-y-8">
                                            <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
                                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-black">Artifact Manifest</h3>
                                                <div className="relative group">
                                                    <div className="flex gap-2">
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400" />
                                                            <input 
                                                                type="text" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && searchInventory()}
                                                                placeholder="Search Catalog #..."
                                                                className="bg-zinc-100 border border-zinc-200 rounded-sm pl-10 pr-4 py-2 text-[10px] text-black focus:outline-none focus:border-[#D4AF37] w-64 transition-all"
                                                            />
                                                        </div>
                                                        <button onClick={searchInventory} className="px-4 py-2 bg-black text-[#D4AF37] rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-zinc-900">Add Item</button>
                                                    </div>

                                                    {searchResults.length > 0 && (
                                                        <div className="absolute z-50 top-full right-0 mt-2 w-96 bg-white border border-zinc-200 rounded-sm shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
                                                            <div className="p-3 bg-zinc-50 border-b border-zinc-100 text-[8px] font-black uppercase text-zinc-400 tracking-widest flex justify-between items-center">
                                                                Search Results
                                                                <button onClick={() => setSearchResults([])}><X className="w-3 h-3" /></button>
                                                            </div>
                                                            {searchResults.map(item => (
                                                                <button 
                                                                    key={item.id}
                                                                    onClick={() => addArtifact(item.id)}
                                                                    className="w-full p-6 text-left hover:bg-zinc-50 transition-all border-b border-zinc-50 last:border-none group flex justify-between items-center"
                                                                >
                                                                    <div>
                                                                        <div className="text-[9px] text-[#A68A27] font-mono group-hover:translate-x-1 transition-transform">#{item.catalog_number}</div>
                                                                        <div className="text-xs text-black font-bold mt-1 uppercase tracking-tight">{item.expand?.accession_id?.expand?.intake_id?.proposed_item_name}</div>
                                                                    </div>
                                                                    <Plus className="w-4 h-4 text-zinc-200 group-hover:text-black" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selected.artifacts?.map(art => (
                                                    <div key={art.id} className="flex items-center justify-between p-6 bg-zinc-50 border border-zinc-200 rounded-sm hover:border-black transition-all group">
                                                        <div className="flex items-center gap-6">
                                                            <div className="w-12 h-12 bg-white border border-zinc-200 flex items-center justify-center text-xl rounded-sm">🖼️</div>
                                                            <div>
                                                                <div className="text-[9px] font-mono text-[#A68A27]">#{art.catalog_number}</div>
                                                                <div className="text-sm font-bold text-black uppercase tracking-tight mt-1">{art.accession_number}</div>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => removeArtifact(art.id)}
                                                            className="p-2 text-zinc-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {selected.artifacts?.length === 0 && (
                                                    <div className="col-span-full py-20 text-center border border-dashed border-zinc-200 rounded-sm bg-zinc-50">
                                                        <History className="w-8 h-8 mx-auto mb-4 text-zinc-200" />
                                                        <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">No artifacts linked to this session</p>
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Modal 
                {...modal} 
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
}
