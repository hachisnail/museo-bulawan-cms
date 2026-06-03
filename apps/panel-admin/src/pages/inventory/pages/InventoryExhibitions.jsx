import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { Calendar, MapPin, ClipboardList, Plus, Search, X, CheckCircle2, History, Loader2, Image as ImageIcon, Trash2, ArrowLeft } from 'lucide-react';
import Modal from '../../../components/Modal';

const STATUS_STYLES = {
    active: 'bg-green-50 text-green-700 border-green-200',
    planning: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-zinc-100 text-zinc-700 border-zinc-300',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    default: 'bg-gray-50 text-gray-700 border-gray-200'
};

export default function InventoryExhibitions() {
    const { apiFetch } = useAuth();
    const navigate = useNavigate();
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
                setExhibitions(data.data.items || []);
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
                setFormData({
                    title: data.data.title || '',
                    venue: data.data.venue || '',
                    startDate: data.data.start_date ? data.data.start_date.split('T')[0] : '',
                    endDate: data.data.end_date ? data.data.end_date.split('T')[0] : '',
                    description: data.data.description || '',
                    status: data.data.status || 'planning'
                });
            }
        } catch (err) {
            console.error("Failed to fetch exhibition details", err);
        }
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
                setModal({ isOpen: true, title: 'Success', message: 'Exhibition record synchronized successfully.', type: 'alert', variant: 'success' });
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
        } catch (err) {
            console.error("Inventory lookup failed", err);
        }
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
        } catch (err) {
            console.error("Failed to associate artifact", err);
        }
    };

    const removeArtifact = async (inventoryId) => {
        try {
            const res = await apiFetch(`/api/v1/acquisitions/exhibitions/${selected.id}/artifacts/${inventoryId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchDetails(selected.id);
            }
        } catch (err) {
            console.error("Failed to dissolve artifact link", err);
        }
    };

    return (
        <div className="max-w-7xl mx-auto flex flex-col gap-y-5 bg-white pb-12 px-4 sm:px-6 lg:px-8 pt-8 font-sans selection:bg-zinc-900 selection:text-white">
            
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
                        <h1 className="text-3xl font-bold text-black tracking-tight">Exhibition Registry</h1>
                        <p className="text-sm text-gray-500 mt-1">Authority controls for curatorial sequencing and public asset tracking.</p>
                    </div>
                    {!selected && !isEditing ? (
                        <button 
                            onClick={() => {
                                setSelected(null);
                                setFormData({ title: '', venue: '', startDate: '', endDate: '', description: '', status: 'planning' });
                                setIsEditing(true);
                            }}
                            className="bg-black hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" /> Plan Exhibition
                        </button>
                    ) : (
                        <button 
                            onClick={() => { setSelected(null); setIsEditing(false); setSearchResults([]); setInventorySearch(''); }}
                            className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black transition-colors flex items-center gap-1.5"
                        >
                            <span>←</span> Back to Registry
                        </button>
                    )}
                </section>
            </div>

            {/* ── Main Workspace Layout ── */}
            <div className="w-full">
                
                {/* ── Grid List Terminal (Dashboard Overview View Only) ── */}
                {!selected && !isEditing && (
                    <div className="w-full animate-in fade-in duration-300">
                        {loading ? (
                            <div className="py-36 text-center flex flex-col items-center justify-center gap-2 text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                <Loader2 className="w-5 h-5 animate-spin text-zinc-600" /> Syncing Event Logs Entry Matrix
                            </div>
                        ) : exhibitions.length === 0 ? (
                            <div className="py-24 text-center border border-dashed border-zinc-300 rounded-xl bg-zinc-50/50 flex flex-col items-center justify-center p-6">
                                <ImageIcon className="w-10 h-10 text-zinc-300 mb-3" />
                                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">No Exhibitions Active</h3>
                                <p className="text-xs text-zinc-400 mt-1">Adjust active configuration variables or map a new protocol session record.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {exhibitions.map(e => {
                                    const styleClass = STATUS_STYLES[e.status] || STATUS_STYLES.default;
                                    return (
                                        <div 
                                            key={e.id}
                                            onClick={() => fetchDetails(e.id)}
                                            className="bg-white border border-zinc-200 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between gap-4 group"
                                        >
                                            <div className="flex justify-between items-center w-full">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${styleClass}`}>
                                                    {e.status}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 font-mono font-medium">
                                                    {e.start_date ? new Date(e.start_date).getFullYear() : 'TBD'}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-zinc-900 tracking-tight group-hover:text-black transition-colors line-clamp-1">{e.title}</h3>
                                                <div className="flex items-center gap-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mt-1.5">
                                                    <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" /> 
                                                    <span className="truncate">{e.venue}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Focused Workspace View (Forms / Inspection Panel) ── */}
                {(selected || isEditing) && (
                    <div className="w-full animate-in fade-in duration-300">
                        <div className="border border-zinc-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
                            
                            {/* Panel Micro Header */}
                            <div className="px-6 py-4 border-b border-zinc-150 bg-zinc-50/50 flex justify-between items-start gap-4">
                                <div>
                                    <h2 className="text-xl font-bold text-zinc-900 tracking-tight leading-none">
                                        {isEditing ? (selected ? 'Modify Exhibition Plan' : 'New Exhibition Protocol') : selected.title}
                                    </h2>
                                    {!isEditing && (
                                        <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                            <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" /> {selected.venue}
                                        </div>
                                    )}
                                </div>
                                {!isEditing && (
                                    <button 
                                        onClick={() => setIsEditing(true)}
                                        className="px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800 text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex-shrink-0"
                                    >
                                        Edit Record
                                    </button>
                                )}
                            </div>

                            {/* Panel Core Dynamic Content */}
                            <div className="p-6 flex flex-col gap-6">
                                {isEditing ? (
                                    <form onSubmit={handleSave} className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Exhibition Title</label>
                                                <input 
                                                    required
                                                    type="text" 
                                                    value={formData.title} 
                                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                                    className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-black focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white"
                                                    placeholder="Official deployment designation title"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Registry Status</label>
                                                <select 
                                                    value={formData.status} 
                                                    onChange={e => setFormData({...formData, status: e.target.value})}
                                                    className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-black focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white"
                                                >
                                                    <option value="planning">Planning / Research</option>
                                                    <option value="active">Active / On Display</option>
                                                    <option value="completed">Completed / Archived</option>
                                                    <option value="cancelled">Cancelled</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Venue Location</label>
                                                <input 
                                                    required
                                                    type="text" 
                                                    value={formData.venue} 
                                                    onChange={e => setFormData({...formData, venue: e.target.value})}
                                                    className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-black focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white"
                                                    placeholder="e.g. West Gallery Vault"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Start Date</label>
                                                <input 
                                                    type="date" 
                                                    value={formData.startDate} 
                                                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                                                    className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-black focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">End Date</label>
                                                <input 
                                                    type="date" 
                                                    value={formData.endDate} 
                                                    onChange={e => setFormData({...formData, endDate: e.target.value})}
                                                    className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-black focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Curatorial Statement & Scope Objectives</label>
                                            <textarea 
                                                rows="4" 
                                                value={formData.description} 
                                                onChange={e => setFormData({...formData, description: e.target.value})}
                                                className="block w-full rounded-lg border border-zinc-200 p-3 text-sm text-black focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all resize-none shadow-sm bg-white"
                                                placeholder="Provide rigorous session metadata description details..."
                                            />
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button 
                                                type="submit" 
                                                disabled={actionLoading}
                                                className="flex-1 py-2.5 bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors shadow-md disabled:opacity-50"
                                            >
                                                {actionLoading ? 'Synchronizing Archive...' : 'Authorize Exhibition Record'}
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => { setIsEditing(false); if(!selected) setSelected(null); }} 
                                                className="px-5 py-2.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="flex flex-col gap-6">
                                        {/* Metadata Summary Cards */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex items-start gap-2.5">
                                                <Calendar className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Event Duration</div>
                                                    <div className="text-sm font-semibold text-zinc-900 mt-0.5">
                                                        {selected.start_date ? new Date(selected.start_date).toLocaleDateString() : 'TBD'} — {selected.end_date ? new Date(selected.end_date).toLocaleDateString() : 'TBD'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex items-start gap-2.5">
                                                <ClipboardList className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Manifest Count</div>
                                                    <div className="text-sm font-bold text-zinc-900 mt-0.5">{selected.artifacts?.length || 0} Artifacts Linked</div>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex items-start gap-2.5">
                                                <CheckCircle2 className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Session Status</div>
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border mt-1 ${STATUS_STYLES[selected.status] || STATUS_STYLES.default}`}>
                                                        {selected.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Curatorial Text Segment */}
                                        <div className="space-y-1.5">
                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Curatorial Statement</h4>
                                            <p className="text-sm text-zinc-700 leading-relaxed font-light pl-4 border-l border-zinc-200">
                                                {selected.description || 'No specialized description provided for this exhibition entry context.'}
                                            </p>
                                        </div>

                                        {/* Artifact Assignment Terminal */}
                                        <div className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50/50">
                                            <div className="flex flex-wrap justify-between items-center bg-zinc-50 px-4 py-2 border-b border-zinc-200 gap-3">
                                                <div className="flex items-center gap-1.5">
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Bound Asset Manifest</h3>
                                                </div>
                                                
                                                {/* Search Command Controls Dropdown combo */}
                                                <div className="relative flex items-center gap-2">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                                                        <input 
                                                            type="text" 
                                                            value={inventorySearch} 
                                                            onChange={e => setInventorySearch(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && searchInventory()}
                                                            placeholder="Look up Catalog #..."
                                                            className="bg-white border border-zinc-300 rounded-md pl-8 pr-3 py-1 text-xs text-black focus:outline-none focus:border-zinc-950 w-48 shadow-sm transition-colors"
                                                        />
                                                    </div>
                                                    <button onClick={searchInventory} className="px-3 py-1 bg-black hover:bg-zinc-800 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition-colors">Find</button>

                                                    {/* Results Floating Dialog Container */}
                                                    {searchResults.length > 0 && (
                                                        <div className="absolute z-50 top-full right-0 mt-1 w-80 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto animate-in slide-in-from-top-1 duration-150">
                                                            <div className="p-2 bg-zinc-50 border-b border-zinc-100 text-[9px] font-bold uppercase text-zinc-400 tracking-widest flex justify-between items-center px-3">
                                                                <span>Index Matches</span>
                                                                <button onClick={() => setSearchResults([])} className="text-zinc-400 hover:text-black"><X className="w-3 h-3" /></button>
                                                            </div>
                                                            {searchResults.map(item => (
                                                                <button 
                                                                    key={item.id}
                                                                    type="button"
                                                                    onClick={() => addArtifact(item.id)}
                                                                    className="w-full p-3 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-none flex justify-between items-center group"
                                                                >
                                                                    <div className="truncate flex-1 pr-2">
                                                                        <div className="text-[9px] font-mono text-zinc-400 font-bold">#{item.catalog_number}</div>
                                                                        <div className="text-xs text-zinc-800 font-bold mt-0.5 truncate">{item.expand?.accession_id?.expand?.intake_id?.proposed_item_name || 'Unnamed Object'}</div>
                                                                    </div>
                                                                    <Plus className="w-3.5 h-3.5 text-zinc-300 group-hover:text-black flex-shrink-0" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Manifest Grid list mapping */}
                                            <div className="p-4">
                                                {selected.artifacts && selected.artifacts.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                                                        {selected.artifacts.map(art => (
                                                            <div key={art.id} className="flex items-center justify-between p-3 bg-white border border-zinc-150 rounded-lg hover:border-zinc-300 transition-all shadow-sm group">
                                                                <div className="flex items-center gap-3 truncate">
                                                                    <div className="w-9 h-9 bg-zinc-50 border border-zinc-200 flex items-center justify-center rounded-lg text-zinc-400 flex-shrink-0">
                                                                        <ImageIcon className="w-4 h-4" />
                                                                    </div>
                                                                    <div className="truncate">
                                                                        <div className="text-[9px] font-mono text-zinc-400 font-bold">#{art.catalog_number}</div>
                                                                        <div className="text-xs font-bold text-zinc-900 truncate mt-0.5">{art.accession_number}</div>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    onClick={() => removeArtifact(art.id)}
                                                                    className="p-1.5 rounded-md text-zinc-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                                                    title="Remove Link"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-8 bg-white border border-dashed border-zinc-200 rounded-lg flex flex-col items-center justify-center p-4">
                                                        <History className="w-7 h-7 mb-2 text-zinc-300" />
                                                        <p className="text-xs text-zinc-450 font-medium uppercase tracking-wider">No artifacts associated to manifest list</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
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
