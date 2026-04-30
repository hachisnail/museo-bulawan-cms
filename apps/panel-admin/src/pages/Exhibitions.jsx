import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/authContext';

export default function Exhibitions() {
    const { apiFetch } = useAuth();
    const [exhibitions, setExhibitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    
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
            }
        } catch (err) {}
    };

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (e) => {
        e.preventDefault();
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
                alert('Exhibition record saved.');
                setIsEditing(false);
                fetchData();
                if (selected?.id) fetchDetails(selected.id);
            }
        } catch (err) { alert('Save failed'); }
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

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Exhibition Manager</h1>
                    <p className="text-[var(--text-secondary)] mt-1">Plan and document the public life of the museum collection.</p>
                </div>
                <button 
                    onClick={() => {
                        setSelected(null);
                        setFormData({ title: '', venue: '', startDate: '', endDate: '', description: '', status: 'planning' });
                        setIsEditing(true);
                    }}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all"
                >
                    + Plan New Exhibition
                </button>
            </header>

            <div className="grid grid-cols-12 gap-8">
                {/* List Side */}
                <div className="col-span-12 lg:col-span-4 space-y-4">
                    <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
                        <div className="divide-y divide-white/5">
                            {loading ? (
                                <div className="p-10 text-center text-zinc-500 text-xs uppercase font-bold animate-pulse">Scanning Registry...</div>
                            ) : exhibitions.length === 0 ? (
                                <div className="p-10 text-center text-zinc-600 italic text-sm">No exhibitions found.</div>
                            ) : (
                                exhibitions.map(e => (
                                    <button 
                                        key={e.id}
                                        onClick={() => {
                                            fetchDetails(e.id);
                                            setFormData(e);
                                            setIsEditing(false);
                                        }}
                                        className={`w-full p-6 text-left hover:bg-white/5 transition-all group ${selected?.id === e.id ? 'bg-indigo-500/5 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">{e.status}</div>
                                            <div className="text-[10px] text-zinc-600 font-mono">{new Date(e.start_date).getFullYear()}</div>
                                        </div>
                                        <div className="text-white font-bold group-hover:text-indigo-400 transition-colors">{e.title}</div>
                                        <div className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-tighter">{e.venue}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Detail Side */}
                <div className="col-span-12 lg:col-span-8">
                    {isEditing || selected ? (
                        <div className="glass-panel rounded-[40px] p-10 border border-white/5 space-y-10 animate-in slide-in-from-right-8 duration-500">
                            <header className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tight">
                                        {isEditing ? (selected ? 'Edit Exhibition' : 'New Exhibition Plan') : selected.title}
                                    </h2>
                                    {!isEditing && <p className="text-indigo-400 font-black uppercase tracking-widest text-[10px] mt-1">{selected.venue}</p>}
                                </div>
                                {!isEditing && (
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => setIsEditing(true)}
                                            className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase transition-all"
                                        >
                                            Edit Details
                                        </button>
                                    </div>
                                )}
                            </header>

                            {isEditing ? (
                                <form onSubmit={handleSave} className="space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-zinc-600">Exhibition Title</label>
                                        <input 
                                            required
                                            type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                            placeholder="Thematic title of the exhibition"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-zinc-600">Venue / Location</label>
                                            <input 
                                                required
                                                type="text" value={formData.venue} onChange={e => setFormData({...formData, venue: e.target.value})}
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                placeholder="e.g. Gallery A, Special Exhibition Hall"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-zinc-600">Event Status</label>
                                            <select 
                                                value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all appearance-none"
                                            >
                                                <option value="planning">Planning</option>
                                                <option value="active">Active / On Display</option>
                                                <option value="completed">Completed / Archive</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-zinc-600">Opening Date</label>
                                            <input 
                                                type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})}
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-zinc-600">Closing Date</label>
                                            <input 
                                                type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})}
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-zinc-600">Exhibition Abstract / Objectives</label>
                                        <textarea 
                                            rows="4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-[32px] p-6 text-base text-zinc-200 leading-relaxed font-serif italic focus:outline-none focus:border-indigo-500 transition-all resize-none"
                                            placeholder="Curatorial statement..."
                                        />
                                    </div>

                                    <div className="flex gap-4">
                                        <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Save Exhibition Plan</button>
                                        <button type="button" onClick={() => { if (!selected) setSelected(null); setIsEditing(false); }} className="px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">Cancel</button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-12">
                                    <div className="grid grid-cols-2 gap-12">
                                        <section className="space-y-2">
                                            <h4 className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Event Timeline</h4>
                                            <p className="text-xl text-white font-bold">
                                                {selected.start_date ? new Date(selected.start_date).toLocaleDateString() : 'TBD'} — {selected.end_date ? new Date(selected.end_date).toLocaleDateString() : 'TBD'}
                                            </p>
                                        </section>
                                        <section className="space-y-2">
                                            <h4 className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Participation Count</h4>
                                            <p className="text-xl text-indigo-400 font-bold">{selected.artifacts?.length || 0} Artifacts Selected</p>
                                        </section>
                                    </div>

                                    <section className="space-y-4">
                                        <h4 className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Curatorial Statement</h4>
                                        <div className="text-lg text-zinc-300 leading-relaxed font-serif italic border-l-2 border-indigo-500/30 pl-8">
                                            {selected.description || 'No statement provided for this exhibition.'}
                                        </div>
                                    </section>

                                    {/* Artifact Selection & List */}
                                    <section className="bg-white/5 rounded-[40px] p-8 border border-white/5 space-y-8">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-xl">🖼️</div>
                                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Exhibition Artifacts</h3>
                                            </div>
                                            
                                            <div className="relative">
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)}
                                                        placeholder="Add by catalog # or name..."
                                                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 w-64"
                                                    />
                                                    <button onClick={searchInventory} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase">Search</button>
                                                </div>
                                                
                                                {searchResults.length > 0 && (
                                                    <div className="absolute z-50 top-full right-0 mt-2 w-80 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                                                        {searchResults.map(item => (
                                                            <button 
                                                                key={item.id}
                                                                onClick={() => addArtifact(item.id)}
                                                                className="w-full p-4 text-left hover:bg-indigo-600 transition-colors border-b border-white/5 last:border-none group"
                                                            >
                                                                <div className="text-[9px] text-zinc-500 group-hover:text-indigo-200 font-mono">#{item.catalog_number}</div>
                                                                <div className="text-xs text-white font-bold">{item.expand?.accession_id?.expand?.intake_id?.proposed_item_name}</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {selected.artifacts?.map(art => (
                                                <div key={art.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-[10px] font-mono text-indigo-400">#{art.catalog_number}</div>
                                                        <div className="text-sm font-bold text-white">{art.accession_number}</div>
                                                    </div>
                                                    <button className="text-zinc-600 hover:text-rose-400 text-xs uppercase font-black">Remove</button>
                                                </div>
                                            ))}
                                            {selected.artifacts?.length === 0 && (
                                                <div className="py-20 text-center opacity-20 italic text-sm">No artifacts added to this exhibition yet.</div>
                                            )}
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-20 space-y-4 py-40">
                            <div className="text-8xl">🖼️</div>
                            <p className="text-sm font-bold uppercase tracking-[0.3em]">Select an exhibition to view planning details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
