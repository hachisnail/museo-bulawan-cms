import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/authContext';

export default function Constituents() {
    const { apiFetch } = useAuth();
    const [constituents, setConstituents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        type: 'Individual',
        nationality: '',
        biography: '',
        external_id: ''
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const endpoint = search ? `/api/v1/acquisitions/constituents/search?q=${search}` : '/api/v1/acquisitions/constituents';
            const res = await apiFetch(endpoint);
            const data = await res.json();
            if (data.status === 'success') {
                setConstituents(data.data.items || data.data);
            }
        } catch (err) {
            console.error("Failed to fetch constituents", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch, search]);

    useEffect(() => {
        const timer = setTimeout(() => fetchData(), 300);
        return () => clearTimeout(timer);
    }, [fetchData]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const method = selected?.id ? 'PATCH' : 'POST';
            const endpoint = selected?.id 
                ? `/api/v1/acquisitions/constituents/${selected.id}` 
                : '/api/v1/acquisitions/constituents';
            
            const res = await apiFetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                alert('Constituent record saved.');
                setIsEditing(false);
                setSelected(null);
                fetchData();
            }
        } catch (err) {
            alert('Save failed');
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Constituent Directory</h1>
                    <p className="text-[var(--text-secondary)] mt-1">Authority control for people and organizations linked to the collection.</p>
                </div>
                <button 
                    onClick={() => {
                        setSelected(null);
                        setFormData({ name: '', type: 'Individual', nationality: '', biography: '', external_id: '' });
                        setIsEditing(true);
                    }}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all"
                >
                    + Add New Constituent
                </button>
            </header>

            <div className="grid grid-cols-12 gap-8">
                {/* List Side */}
                <div className="col-span-12 lg:col-span-4 space-y-4">
                    <div className="glass-panel rounded-2xl p-4 border border-white/5">
                        <input 
                            type="text"
                            placeholder="Search directory..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                        />
                    </div>

                    <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
                        <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                            {loading ? (
                                <div className="p-10 text-center text-zinc-500 text-xs uppercase font-bold animate-pulse">Scanning Archive...</div>
                            ) : constituents.length === 0 ? (
                                <div className="p-10 text-center text-zinc-600 italic text-sm">No records found.</div>
                            ) : (
                                constituents.map(c => (
                                    <button 
                                        key={c.id}
                                        onClick={() => {
                                            setSelected(c);
                                            setFormData(c);
                                            setIsEditing(false);
                                        }}
                                        className={`w-full p-6 text-left hover:bg-white/5 transition-all group ${selected?.id === c.id ? 'bg-indigo-500/5 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}
                                    >
                                        <div className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">{c.type}</div>
                                        <div className="text-white font-bold group-hover:text-indigo-400 transition-colors">{c.name}</div>
                                        <div className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-tighter">{c.nationality || 'Nationality Unknown'}</div>
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
                                        {isEditing ? (selected ? 'Edit Record' : 'New Constituent') : selected.name}
                                    </h2>
                                    {!isEditing && <p className="text-indigo-400 font-black uppercase tracking-widest text-[10px] mt-1">{selected.type}</p>}
                                </div>
                                {!isEditing && (
                                    <button 
                                        onClick={() => setIsEditing(true)}
                                        className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase transition-all"
                                    >
                                        Edit Details
                                    </button>
                                )}
                            </header>

                            {isEditing ? (
                                <form onSubmit={handleSave} className="space-y-8">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-zinc-600">Legal Name / Organization</label>
                                            <input 
                                                required
                                                type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                placeholder="Full legal name"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-zinc-600">Constituent Type</label>
                                            <select 
                                                value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all appearance-none"
                                            >
                                                <option value="Individual">Individual</option>
                                                <option value="Organization">Organization</option>
                                                <option value="Workshop/School">Workshop/School</option>
                                                <option value="Government Body">Government Body</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-zinc-600">Nationality / Origin</label>
                                            <input 
                                                type="text" value={formData.nationality} onChange={e => setFormData({...formData, nationality: e.target.value})}
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                placeholder="e.g. Filipino, Chinese, etc."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-zinc-600">External Authority ID (Getty ULAN / WikiData)</label>
                                            <input 
                                                type="text" value={formData.external_id} onChange={e => setFormData({...formData, external_id: e.target.value})}
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 transition-all"
                                                placeholder="e.g. 500025114"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-zinc-600">Biography / Institutional History</label>
                                        <textarea 
                                            rows="6" value={formData.biography} onChange={e => setFormData({...formData, biography: e.target.value})}
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-[32px] p-6 text-base text-zinc-200 leading-relaxed font-serif italic focus:outline-none focus:border-indigo-500 transition-all resize-none"
                                            placeholder="Document historical background..."
                                        />
                                    </div>

                                    <div className="flex gap-4">
                                        <button 
                                            type="submit"
                                            className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                        >
                                            Save Constituent Record
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (!selected) setSelected(null);
                                                setIsEditing(false);
                                            }}
                                            className="px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-12">
                                    <div className="grid grid-cols-2 gap-12">
                                        <section className="space-y-2">
                                            <h4 className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Nationality / Origin</h4>
                                            <p className="text-xl text-white font-bold">{selected.nationality || 'Not Recorded'}</p>
                                        </section>
                                        <section className="space-y-2">
                                            <h4 className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Authority Reference</h4>
                                            <p className="text-xl text-indigo-400 font-mono font-bold">{selected.external_id || 'Internal ID Only'}</p>
                                        </section>
                                    </div>

                                    <section className="space-y-4">
                                        <h4 className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Biography / Documentation</h4>
                                        <div className="text-lg text-zinc-300 leading-relaxed font-serif italic border-l-2 border-indigo-500/30 pl-8">
                                            {selected.biography || 'No biographical data recorded for this constituent.'}
                                        </div>
                                    </section>

                                    <section className="bg-white/5 rounded-[32px] p-8 border border-white/5">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-xl">🏛️</div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Linked Collection Artifacts</h3>
                                        </div>
                                        <div className="text-center py-10 opacity-20 italic text-sm">
                                            Scanning cross-reference table...
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-20 space-y-4 py-40">
                            <div className="text-8xl">👤</div>
                            <p className="text-sm font-bold uppercase tracking-[0.3em]">Select a constituent to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
