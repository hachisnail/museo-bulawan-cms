import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import { Modal } from '../../../components';
import { Search, Plus, User, Building2, Globe, Fingerprint, FileText, Layers, Loader2, ArrowLeft } from 'lucide-react';

const TYPE_STYLES = {
    Individual: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    Organization: 'bg-blue-50 text-blue-700 border-blue-100',
    'Workshop/School': 'bg-amber-50 text-amber-800 border-amber-100',
    'Government Body': 'bg-purple-50 text-purple-700 border-purple-100',
    default: 'bg-gray-50 text-gray-700 border-gray-200'
};

export default function InventoryConstituents() {
    const { apiFetch } = useAuth();
    const navigate = useNavigate();
    const [constituents, setConstituents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });
    
    const [formData, setFormData] = useState({
        name: '',
        type: 'Individual',
        nationality: '',
        biography: '',
        external_id: ''
    });
    const [linkedArtifacts, setLinkedArtifacts] = useState([]);

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
        setIsSubmitting(true);
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
                setModal({ isOpen: true, title: 'Success', message: 'Constituent record saved successfully.', type: 'alert', variant: 'success' });
                setIsEditing(false);
                setSelected(null);
                fetchData();
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Failed to update constituent record.', type: 'alert', variant: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto flex flex-col gap-y-5 bg-white pb-12 px-4 sm:px-6 lg:px-8 pt-8 font-sans">
            
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
                        <h1 className="text-3xl font-bold text-black tracking-tight">Constituent Directory</h1>
                        <p className="text-sm text-gray-500 mt-1">Authority control records for individuals, artists, and institutional collectors.</p>
                    </div>
                    <button 
                        onClick={() => {
                            setSelected(null);
                            setFormData({ name: '', type: 'Individual', nationality: '', biography: '', external_id: '' });
                            setIsEditing(true);
                        }}
                        className="bg-black hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" /> Add Constituent
                    </button>
                </section>
            </div>

            {/* ── Layout Grid ── */}
            <div className="grid grid-cols-12 gap-6 items-start">
                
                {/* ── Left Column: Directory List ── */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                    {/* Search Field */}
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input 
                            type="text"
                            placeholder="Filter directory records..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white border border-zinc-300 rounded-lg pl-9 pr-4 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors shadow-sm"
                        />
                    </div>

                    {/* Directory Feed */}
                    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm max-h-[65vh] overflow-y-auto divide-y divide-zinc-100">
                        {loading ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin text-zinc-600" /> Scanning Directory
                            </div>
                        ) : constituents.length === 0 ? (
                            <div className="p-10 text-center text-zinc-400 italic text-xs tracking-wide">No records matching query.</div>
                        ) : (
                            constituents.map(c => {
                                const activeBadge = TYPE_STYLES[c.type] || TYPE_STYLES.default;
                                return (
                                    <button 
                                        key={c.id}
                                        onClick={async () => {
                                            setSelected(c);
                                            setFormData(c);
                                            setIsEditing(false);
                                            try {
                                                const res = await apiFetch(`/api/v1/acquisitions/constituents/${c.id}/artifacts`);
                                                const json = await res.json();
                                                if (json.status === 'success') setLinkedArtifacts(json.data);
                                            } catch (err) { console.error(err); }
                                        }}
                                        className={`w-full p-4 text-left hover:bg-zinc-50/50 transition-all border-l-4 flex flex-col gap-1 ${selected?.id === c.id ? 'bg-zinc-50 border-black' : 'border-transparent'}`}
                                    >
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${activeBadge}`}>
                                                {c.type}
                                            </span>
                                        </div>
                                        <div className="text-sm font-bold text-zinc-900 tracking-tight mt-0.5">{c.name}</div>
                                        <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                                            <Globe className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                                            {c.nationality || 'Nationality Unspecified'}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ── Right Column: Detail / Form Terminal ── */}
                <div className="col-span-12 lg:col-span-8">
                    {isEditing || selected ? (
                        <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm flex flex-col gap-6 animate-in fade-in duration-300">
                            
                            {/* Action Header */}
                            <header className="flex justify-between items-start border-b border-zinc-100 pb-3">
                                <div>
                                    <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
                                        {isEditing ? (selected ? 'Modify Authority Record' : 'Create Authority Record') : selected.name}
                                    </h2>
                                    {!isEditing && (
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border mt-1.5 ${TYPE_STYLES[selected.type] || TYPE_STYLES.default}`}>
                                            {selected.type}
                                        </span>
                                    )}
                                </div>
                                {!isEditing && (
                                    <button 
                                        onClick={() => setIsEditing(true)}
                                        className="px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800 text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                                    >
                                        Edit Details
                                    </button>
                                )}
                            </header>

                            {/* View / Form Logic Toggle */}
                            {isEditing ? (
                                <form onSubmit={handleSave} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Legal Name / Organization</label>
                                            <input 
                                                required
                                                type="text" 
                                                value={formData.name} 
                                                onChange={e => setFormData({...formData, name: e.target.value})}
                                                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white"
                                                placeholder="Full legal or commercial designation"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Constituent Type</label>
                                            <select 
                                                value={formData.type} 
                                                onChange={e => setFormData({...formData, type: e.target.value})}
                                                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white"
                                            >
                                                <option value="Individual">Individual</option>
                                                <option value="Organization">Organization</option>
                                                <option value="Workshop/School">Workshop/School</option>
                                                <option value="Government Body">Government Body</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Nationality / Origin</label>
                                            <input 
                                                type="text" 
                                                value={formData.nationality} 
                                                onChange={e => setFormData({...formData, nationality: e.target.value})}
                                                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white"
                                                placeholder="e.g. Filipino, Spanish"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">External Authority ID (Getty ULAN / WikiData)</label>
                                            <input 
                                                type="text" 
                                                value={formData.external_id} 
                                                onChange={e => setFormData({...formData, external_id: e.target.value})}
                                                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono text-black focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white"
                                                placeholder="e.g. 500025114"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Biography / Institutional History</label>
                                        <textarea 
                                            rows="4" 
                                            value={formData.biography} 
                                            onChange={e => setFormData({...formData, biography: e.target.value})}
                                            className="block w-full rounded-lg border border-zinc-300 p-3 text-sm text-black focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all resize-none shadow-sm bg-white"
                                            placeholder="Authority scope notes, timeline dates, and significance..."
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button 
                                            type="submit" 
                                            disabled={isSubmitting}
                                            className="flex-1 py-2.5 bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors shadow-md disabled:opacity-50"
                                        >
                                            {isSubmitting ? 'Saving Record...' : 'Save Constituent Record'}
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setIsEditing(false);
                                                if (!selected) setSelected(null);
                                            }} 
                                            className="px-5 py-2.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                                        <div className="flex items-start gap-2.5">
                                            <Globe className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nationality / Origin</div>
                                                <div className="text-sm font-semibold text-zinc-900 mt-0.5">{selected.nationality || 'Unspecified'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2.5">
                                            <Fingerprint className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Authority Control ID</div>
                                                <div className="text-sm font-mono font-semibold text-zinc-900 mt-0.5">{selected.external_id || 'None (Local Only)'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Biography / Context History</h4>
                                        <p className="text-sm text-zinc-700 leading-relaxed font-light pl-4 border-l border-zinc-200 whitespace-pre-wrap">
                                            {selected.biography || 'No biographical history recorded.'}
                                        </p>
                                    </div>

                                    <div className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50/50">
                                        <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200 flex items-center gap-1.5">
                                            <Layers className="w-3.5 h-3.5 text-zinc-500" />
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Linked Collection Artifacts</h3>
                                        </div>
                                        <div className="p-4">
                                            {linkedArtifacts.length > 0 ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                                                    {linkedArtifacts.map(art => (
                                                        <div key={art.id} className="flex items-center gap-3 p-3 bg-white border border-zinc-150 rounded-lg shadow-sm">
                                                            <div className="w-8 h-8 bg-zinc-50 border border-zinc-250 flex items-center justify-center rounded-lg text-zinc-400 flex-shrink-0">
                                                                <FileText className="w-4 h-4" />
                                                            </div>
                                                            <div className="truncate">
                                                                <div className="text-[9px] font-mono text-zinc-400 font-bold">#{art.catalog_number}</div>
                                                                <div className="text-xs font-bold text-zinc-900 truncate mt-0.5">{art.historical_significance || 'Unnamed Artifact'}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 text-zinc-400 italic text-xs">No active collections records linked.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-[60vh] bg-zinc-50 border border-zinc-200 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 text-center p-8 animate-in fade-in">
                            <User className="w-12 h-12 text-zinc-300" />
                            <div>
                                <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">No Selection</h3>
                                <p className="text-xs text-zinc-450 mt-1">Select an authority control entity from the directory sidebar</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Modal 
                {...modal} 
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
}
