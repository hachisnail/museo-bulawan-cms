import { useState } from 'react';

export default function FinalizeModal({
    isOpen,
    onClose,
    locations,
    hasPhotos,
    onSubmit,
    actionLoading
}) {
    const [location, setLocation] = useState('');
    const [catalogNumber, setCatalogNumber] = useState('');
    const [imageSkipReason, setImageSkipReason] = useState('');
    const [validationError, setValidationError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        setValidationError('');

        if (!location) {
            setValidationError('Storage location is required.');
            return;
        }

        // Validate Catalog Number pattern if provided
        if (catalogNumber) {
            const catRegex = /^CAT-\d{4}-\d{5}$/;
            if (!catRegex.test(catalogNumber)) {
                setValidationError('Catalog number must match format CAT-YYYY-NNNNN (e.g., CAT-2026-00042)');
                return;
            }
        }

        // If no photos, imageSkipReason is required
        if (!hasPhotos && !imageSkipReason.trim()) {
            setValidationError('An image skip reason is required because no visual documentation is attached.');
            return;
        }

        onSubmit({
            location,
            catalogNumber: catalogNumber || undefined,
            imageSkipReason: !hasPhotos ? imageSkipReason : undefined
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md border border-zinc-200 rounded-sm shadow-2xl flex flex-col">
                <div className="p-6 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                    <h3 className="font-serif text-lg text-black uppercase tracking-wider">Finalize to Inventory</h3>
                    <button 
                        onClick={onClose} 
                        className="text-zinc-400 hover:text-black"
                        type="button"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {validationError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider rounded-sm">
                            {validationError}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Catalog Number <span className="text-zinc-300 font-normal normal-case">(optional)</span></label>
                        <input 
                            type="text"
                            value={catalogNumber}
                            onChange={(e) => setCatalogNumber(e.target.value)}
                            placeholder="e.g. CAT-2026-00042"
                            className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-4 py-3 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-mono"
                        />
                        <p className="text-[9px] text-zinc-400">Leaves empty to auto-generate, or match pattern: CAT-YYYY-NNNNN</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Storage Location *</label>
                        <select
                            required
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-4 py-3 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                        >
                            <option value="">-- Select Location --</option>
                            {locations.map((loc) => (
                                <option key={loc.id} value={loc.name}>
                                    {loc.name} ({loc.type})
                                </option>
                            ))}
                        </select>
                    </div>

                    {!hasPhotos && (
                        <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-sm animate-in fade-in duration-300">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-amber-800 block">Image Skip Reason *</label>
                            <p className="text-[10px] text-amber-700 mb-2 leading-relaxed">Visual documentation is missing. Please provide a reason to bypass imaging requirement.</p>
                            <textarea
                                required
                                value={imageSkipReason}
                                onChange={(e) => setImageSkipReason(e.target.value)}
                                placeholder="e.g. Artifact is extremely fragile and cannot undergo flash/studio lighting at this time..."
                                rows="3"
                                className="w-full bg-white border border-amber-300 rounded-sm px-3 py-2 text-xs text-black focus:outline-none focus:border-[#D4AF37] transition-all resize-none"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-4 bg-black text-[#D4AF37] rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {actionLoading ? 'Finalizing...' : 'Finalize & Archive Accession'}
                    </button>
                </form>
            </div>
        </div>
    );
}
