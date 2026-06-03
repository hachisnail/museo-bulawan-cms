import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { X, Plus, Search, MapPin, Warehouse, Beaker, Landmark, Activity, Boxes, ShieldAlert, ArrowLeft } from 'lucide-react';
import Modal from '../../../components/Modal';

// ─────────────────────────────────────────────────────────────────────────────
//  Badge & Theme Styles
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_STYLES = {
    storage: { wrapper: 'bg-zinc-50 border-zinc-200', text: 'text-zinc-600', badge: 'bg-zinc-100 text-zinc-700 border-zinc-200', icon: Warehouse },
    lab: { wrapper: 'bg-blue-50/30 border-blue-100', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700 border-blue-200', icon: Beaker },
    exhibit: { wrapper: 'bg-amber-50/30 border-amber-100', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-800 border-amber-200', icon: Landmark },
    default: { wrapper: 'bg-gray-50 border-gray-200', text: 'text-gray-600', badge: 'bg-gray-100 text-gray-700 border-gray-200', icon: MapPin }
};

export default function InventoryLocations() {
    const { apiFetch } = useAuth();
    const navigate = useNavigate();

    // --- State ---
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    // --- Modals & Panels ---
    const [isAdding, setIsAdding] = useState(false);
    const [viewingLocation, setViewingLocation] = useState(null);
    const [form, setForm] = useState({ name: '', type: 'storage', description: '' });
    const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' });

    // ------------------------------------------------------------------ //
    //  Data Fetching
    // ------------------------------------------------------------------ //
    const fetchLocations = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await apiFetch('/api/v1/acquisitions/locations');
            const json = await res.json();
            if (json.status === 'success') {
                setLocations(json.data || []);
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

    // ------------------------------------------------------------------ //
    //  Actions
    // ------------------------------------------------------------------ //
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
                fetchLocations(true);
                setAlertModal({ isOpen: true, title: 'Success', message: 'Curatorial zone registered successfully.' });
            }
        } catch (err) {
            setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to create location.' });
        }
    };

    // ------------------------------------------------------------------ //
    //  Filtering Data
    // ------------------------------------------------------------------ //
    const filteredLocations = useMemo(() => {
        return locations.filter(loc => {
            const matchesSearch = loc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (loc.description && loc.description.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesType = typeFilter === 'all' || loc.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [locations, searchTerm, typeFilter]);

    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12 px-4 sm:px-6 lg:px-8 pt-8 max-w-7xl mx-auto">
            
            {/* ── Header & Navigation ── */}
            <div className="flex flex-col gap-4 mb-2">
                <button 
                    onClick={() => navigate('/inventory')} 
                    className="w-fit flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-black transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Inventory
                </button>
                
                <section className="flex flex-wrap justify-between items-end border-b border-gray-100 pb-5 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-black tracking-tight">Curatorial Zones</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage physical spaces, storage areas, and exhibition capacities.</p>
                    </div>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-black hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        Register Zone
                    </button>
                </section>
            </div>

            {/* ── Main Content Area ── */}
            <div className="flex-1 w-full min-w-0 flex flex-col gap-6">
                
                {/* Filter Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2">
                        {['all', 'storage', 'exhibit', 'lab'].map(type => (
                            <button
                                key={type}
                                onClick={() => setTypeFilter(type)}
                                className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all border ${
                                    typeFilter === type 
                                    ? 'bg-white border-gray-300 text-black shadow-sm' 
                                    : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50'
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search zones..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-md pl-9 pr-4 py-2 text-sm text-black focus:outline-none focus:border-black transition-colors shadow-sm"
                        />
                    </div>
                </div>

                {/* Grid View */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="h-36 bg-gray-50 border border-gray-100 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : filteredLocations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50/50 mt-4">
                        <Boxes className="w-12 h-12 text-gray-300 mb-4" />
                        <h3 className="text-sm font-bold text-gray-900">No curatorial zones found</h3>
                        <p className="text-xs text-gray-500 mt-1">Adjust your filters or register a new physical space.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-in fade-in duration-300">
                        {filteredLocations.map(loc => {
                            const style = TYPE_STYLES[loc.type] || TYPE_STYLES.default;
                            const Icon = style.icon;
                            return (
                                <div 
                                    key={loc.id}
                                    onClick={() => setViewingLocation(loc)}
                                    className={`group relative flex flex-col p-5 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${style.wrapper}`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-2 rounded-lg bg-white shadow-sm border border-black/5 ${style.text}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider border ${style.badge}`}>
                                            {loc.type} Area
                                        </span>
                                    </div>
                                    
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-gray-900 tracking-tight group-hover:text-black transition-colors">{loc.name}</h3>
                                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                                            {loc.description || 'No physical description provided for this zone.'}
                                        </p>
                                    </div>

                                    <div className="mt-5 pt-4 border-t border-black/5 flex items-center justify-between text-xs">
                                        <span className="font-mono text-[10px] text-gray-400 font-medium tracking-wider">v{loc.version || 1}.0 Traceable</span>
                                        <span className="font-semibold text-black opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            Inspect <ArrowRight className="w-3 h-3" />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Contextual Detail Modal ── */}
            {viewingLocation && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setViewingLocation(null)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${TYPE_STYLES[viewingLocation.type]?.badge || TYPE_STYLES.default.badge}`}>
                                        {viewingLocation.type} Zone
                                    </span>
                                    <span className="text-[10px] font-mono text-gray-400 font-bold">UID: {viewingLocation.id.substring(0,8)}</span>
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-bold text-black tracking-tight">{viewingLocation.name}</h2>
                            </div>
                            <button onClick={() => setViewingLocation(null)} className="p-2 rounded-full hover:bg-gray-200 text-gray-500 hover:text-black transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-8">
                            <section>
                                <h4 className="text-xs uppercase font-bold text-gray-400 tracking-wider mb-3 flex items-center gap-2">
                                    <MapPin className="w-4 h-4" /> Physical Specifications
                                </h4>
                                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100">
                                    {viewingLocation.description || 'No specialized description provided for this curatorial zone.'}
                                </p>
                            </section>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 border border-gray-200 rounded-xl flex items-start gap-3 bg-white">
                                    <div className="mt-0.5"><ShieldAlert className="w-4 h-4 text-amber-600" /></div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Security Perimeter</div>
                                        <div className="text-xs font-semibold text-black">Authorized Access Only</div>
                                    </div>
                                </div>
                                <div className="p-4 border border-gray-200 rounded-xl flex items-start gap-3 bg-white">
                                    <div className="mt-0.5"><Activity className="w-4 h-4 text-blue-600" /></div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Archival Context</div>
                                        <div className="text-xs font-semibold text-black">Active Registry Mapping</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors">
                                Edit Geometry
                            </button>
                            <button className="px-5 py-2.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-sm">
                                View Zonal Inventory
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Registration Modal ── */}
            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setIsAdding(false)} />
                    <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold text-black tracking-tight">Register Area</h2>
                                    <p className="text-xs text-gray-500 font-normal">Define a new physical space in the registry.</p>
                                </div>
                                <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-black transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Area Name</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={form.name} 
                                        onChange={e => setForm({...form, name: e.target.value})}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all shadow-sm"
                                        placeholder="e.g. Vault A, Shelf 3"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Space Category</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['storage', 'exhibit', 'lab'].map(t => (
                                            <button 
                                                key={t}
                                                type="button"
                                                onClick={() => setForm({...form, type: t})}
                                                className={`py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                                                    form.type === t 
                                                    ? 'bg-black text-white border-black shadow-md' 
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Description / Notes</label>
                                    <textarea 
                                        value={form.description} 
                                        onChange={e => setForm({...form, description: e.target.value})}
                                        className="w-full bg-white border border-gray-300 rounded-lg p-4 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all min-h-[120px] resize-none shadow-sm"
                                        placeholder="Physical characteristics, environment controls, or security levels..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="px-6 py-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-bold rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-3 bg-black hover:bg-gray-800 text-white font-bold text-sm rounded-lg transition-all shadow-md"
                                >
                                    Save Location
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Modal 
                {...alertModal} 
                onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
            />
        </div>
    );
}

// Inline component for the arrow icon in cards
function ArrowRight(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
    );
}