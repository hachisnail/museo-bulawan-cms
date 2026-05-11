import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/authContext';
import { Plus, MapPin, Warehouse, Beaker, Landmark, MoreVertical, X, Boxes, Search } from 'lucide-react';
import Modal from '../components/Modal';

const TYPE_STYLES = {
    storage: 'bg-zinc-50 border-zinc-300 text-zinc-500',
    lab: 'bg-blue-50 border-blue-200 text-blue-600',
    exhibit: 'bg-amber-50 border-amber-200 text-[#A68A27]',
    default: 'bg-zinc-50 border-zinc-300 text-zinc-500'
};

export default function Locations() {
    const { apiFetch } = useAuth();
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    
    // Modal State
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });

    // Form state
    const [form, setForm] = useState({ name: '', type: 'storage', description: '' });

    const fetchLocations = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/v1/acquisitions/locations');
            const json = await res.json();
            if (json.status === 'success') {
                setLocations(json.data);
            }
        } catch (err) {
            console.error("Failed to fetch locations", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await apiFetch('/api/v1/acquisitions/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setIsAdding(false);
                setForm({ name: '', type: 'storage', description: '' });
                fetchLocations();
                setModal({ isOpen: true, title: 'Success', message: 'Location registered successfully.', type: 'alert', variant: 'success' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Failed to create location.', type: 'alert', variant: 'error' });
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'storage': return <Warehouse className="w-4 h-4" />;
            case 'lab': return <Beaker className="w-4 h-4" />;
            case 'exhibit': return <Landmark className="w-4 h-4" />;
            default: return <MapPin className="w-4 h-4" />;
        }
    };

    const filteredLocations = locations.filter(loc => 
        loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header Section */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-zinc-300 pb-6">
                <div>
                    <h1 className="text-2xl font-serif text-black uppercase tracking-widest">Physical Registry</h1>
                    <p className="text-sm text-zinc-500 mt-1 font-light italic">Museum storage, exhibition zones, and laboratory mapping.</p>
                </div>
                <button 
                    onClick={() => setIsAdding(true)}
                    className="bg-black text-[#D4AF37] px-6 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all flex items-center gap-2 shadow-xl shadow-black/10"
                >
                    <Plus className="w-4 h-4" /> Register Area
                </button>
            </header>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                
                {/* LEFT: Sidebar List */}
                <div className="w-full lg:w-1/3 flex flex-col gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-black transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Filter registry..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-zinc-300 rounded-sm pl-10 pr-4 py-2.5 text-sm text-black focus:outline-none focus:border-[#D4AF37] transition-all"
                        />
                    </div>

                    <div className="bg-white border border-zinc-300 rounded-sm divide-y divide-zinc-200 h-[600px] overflow-y-auto shadow-sm">
                        {loading ? (
                            <div className="p-12 text-center flex flex-col items-center gap-4">
                                <div className="w-5 h-5 border-2 border-zinc-200 border-t-black rounded-full animate-spin" />
                                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Syncing Site Map...</div>
                            </div>
                        ) : filteredLocations.length === 0 ? (
                            <div className="p-12 text-center text-xs text-zinc-400 italic">No curatorial zones found.</div>
                        ) : (
                            filteredLocations.map(loc => (
                                <button 
                                    key={loc.id}
                                    onClick={() => setSelected(loc)}
                                    className={`w-full p-5 text-left transition-all border-l-4 flex flex-col gap-2 ${selected?.id === loc.id ? 'bg-zinc-50 border-[#D4AF37]' : 'border-transparent hover:bg-zinc-50'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-black uppercase tracking-tight">{loc.name}</span>
                                        <span className={`px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest border ${TYPE_STYLES[loc.type] || TYPE_STYLES.default}`}>
                                            {loc.type}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                                        {getTypeIcon(loc.type)} Revision v{loc.version || 1}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: Detail View */}
                <div className="w-full lg:w-2/3">
                    {!selected ? (
                        <div className="h-[600px] bg-zinc-50 border border-zinc-300 rounded-sm flex flex-col items-center justify-center gap-4 text-center p-12">
                            <Boxes className="w-12 h-12 text-zinc-200" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300">Select a curatorial zone to view physical specifications</p>
                        </div>
                    ) : (
                        <div className="bg-white border border-zinc-300 rounded-sm shadow-xl flex flex-col h-[600px] overflow-hidden animate-in slide-in-from-right-4 duration-500">
                            {/* Detail Header */}
                            <div className="p-8 border-b border-zinc-300 bg-zinc-50 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className={`px-3 py-1 rounded-sm text-[9px] font-black uppercase tracking-widest border ${TYPE_STYLES[selected.type] || TYPE_STYLES.default}`}>
                                            {selected.type} Area
                                        </span>
                                        <span className="text-[10px] font-mono text-zinc-400 font-bold">UID: {selected.id.substring(0,8)}</span>
                                    </div>
                                    <h2 className="text-3xl font-serif text-black uppercase tracking-tight leading-tight">
                                        {selected.name}
                                    </h2>
                                </div>
                                <button 
                                    onClick={() => setSelected(null)}
                                    className="p-3 bg-white border border-zinc-300 rounded-sm hover:bg-zinc-50 transition-all text-zinc-400 hover:text-black"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Detail Body */}
                            <div className="flex-1 overflow-y-auto p-10 space-y-10">
                                <section className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2">Physical Specifications</h4>
                                    <p className="text-sm text-black leading-relaxed font-light italic">
                                        {selected.description || 'No specialized description provided for this curatorial zone.'}
                                    </p>
                                </section>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="p-6 bg-zinc-50 border border-zinc-300 rounded-sm">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Security Perimeter</div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-black">
                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                            Authorized Access Only
                                        </div>
                                    </div>
                                    <div className="p-6 bg-zinc-50 border border-zinc-300 rounded-sm">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Registry Integrity</div>
                                        <div className="text-xs font-bold text-black">
                                            Version {selected.version || 1}.0 Traceable
                                        </div>
                                    </div>
                                </div>

                                <section className="space-y-4 pt-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2">Archival Context</h4>
                                    <div className="flex items-center gap-4 p-5 border border-dashed border-zinc-300 rounded-sm text-zinc-400 italic text-xs">
                                        <Activity className="w-5 h-5 flex-shrink-0" />
                                        This zone is currently being mapped for automated artifact movement tracking.
                                    </div>
                                </section>
                            </div>

                            {/* Actions */}
                            <div className="p-6 bg-zinc-50 border-t border-zinc-300 flex justify-end gap-3">
                                <button className="px-6 py-3 bg-white border border-zinc-300 text-black text-[9px] font-black uppercase tracking-widest rounded-sm hover:bg-zinc-100 transition-all">
                                    Modify Geometry
                                </button>
                                <button className="px-6 py-3 bg-black text-[#D4AF37] text-[9px] font-black uppercase tracking-widest rounded-sm hover:bg-zinc-900 transition-all">
                                    Audit Zone Logs
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Registration Modal */}
            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setIsAdding(false)} />
                    <div className="relative bg-white border border-zinc-300 w-full max-w-lg rounded-sm shadow-2xl overflow-hidden">
                        <form onSubmit={handleSubmit} className="p-10 space-y-8">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-serif text-black uppercase tracking-widest">Register Area</h2>
                                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black italic">Define a new physical space in the registry</p>
                                </div>
                                <button type="button" onClick={() => setIsAdding(false)} className="text-zinc-400 hover:text-black transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block mb-2">Area Name</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={form.name} 
                                        onChange={e => setForm({...form, name: e.target.value})}
                                        className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] transition-all"
                                        placeholder="e.g. Vault A, Shelf 3"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block mb-2">Space Category</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['storage', 'exhibit', 'lab'].map(t => (
                                            <button 
                                                key={t}
                                                type="button"
                                                onClick={() => setForm({...form, type: t})}
                                                className={`py-3 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border ${
                                                    form.type === t ? 'bg-black text-[#D4AF37] border-black shadow-lg shadow-black/10' : 'bg-zinc-50 text-zinc-400 border-zinc-300 hover:bg-zinc-100'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block mb-2">Description / Notes</label>
                                    <textarea 
                                        value={form.description} 
                                        onChange={e => setForm({...form, description: e.target.value})}
                                        className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] transition-all min-h-[100px] resize-none"
                                        placeholder="Physical characteristics or security levels..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="flex-1 py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 text-[9px] font-black uppercase tracking-widest transition-all rounded-sm border border-zinc-300"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-4 bg-black text-[#D4AF37] text-[9px] font-black uppercase tracking-widest transition-all rounded-sm shadow-xl shadow-black/10 hover:bg-zinc-900"
                                >
                                    Save Location
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Modal 
                {...modal} 
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
}
