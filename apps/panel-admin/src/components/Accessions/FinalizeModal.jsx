import { useState, useEffect } from 'react';

export default function FinalizeModal({
    isOpen,
    onClose,
    locations,
    hasPhotos,
    onSubmit,
    actionLoading,
    accession
}) {
    const [location, setLocation] = useState('');
    const [genMode, setGenMode] = useState('auto'); // 'auto' | 'derived' | 'custom'
    const [suffixType, setSuffixType] = useState('numeric'); // 'numeric' | 'alpha'
    const [suffixValue, setSuffixValue] = useState('1');
    const [customCatalogNumber, setCustomCatalogNumber] = useState('');
    const [imageSkipReason, setImageSkipReason] = useState('');
    const [validationError, setValidationError] = useState('');

    const accessionNumber = accession?.accession_number || '';

    // Automatically set default suffix when suffixType changes
    useEffect(() => {
        if (suffixType === 'numeric') {
            setSuffixValue('1');
        } else {
            setSuffixValue('a');
        }
    }, [suffixType]);

    // Handle modal open/close cleanup
    useEffect(() => {
        if (isOpen) {
            setLocation('');
            setGenMode('auto');
            setSuffixType('numeric');
            setSuffixValue('1');
            setCustomCatalogNumber('');
            setImageSkipReason('');
            setValidationError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    let derivedCatalogNumber = '';
    if (accessionNumber) {
        if (suffixType === 'numeric') {
            derivedCatalogNumber = `${accessionNumber}.${suffixValue}`;
        } else {
            derivedCatalogNumber = `${accessionNumber}${suffixValue}`;
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        setValidationError('');

        if (!location) {
            setValidationError('Storage location is required.');
            return;
        }

        let finalCatalogNumber = undefined;
        const catRegex = /^((CAT-\d{4}-\d{5})|(\d{4}\.\d{3}\.\d{2}(\.\d+|[a-z]+)))$/;

        if (genMode === 'custom') {
            if (customCatalogNumber) {
                if (!catRegex.test(customCatalogNumber)) {
                    setValidationError('Catalog number must match format CAT-YYYY-NNNNN or derived format YYYY.SEQ.BATCH.N / YYYY.SEQ.BATCHa');
                    return;
                }
                finalCatalogNumber = customCatalogNumber;
            }
        } else if (genMode === 'derived') {
            if (!suffixValue.trim()) {
                setValidationError('Suffix value is required for accession-derived catalog number.');
                return;
            }
            if (!catRegex.test(derivedCatalogNumber)) {
                setValidationError('Derived catalog number is invalid. Ensure suffix contains only digits (for numeric) or lowercase letters (for alphabetical).');
                return;
            }
            finalCatalogNumber = derivedCatalogNumber;
        }

        // If no photos, imageSkipReason is required
        if (!hasPhotos && !imageSkipReason.trim()) {
            setValidationError('An image skip reason is required because no visual documentation is attached.');
            return;
        }

        onSubmit({
            location,
            catalogNumber: finalCatalogNumber,
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

                    {/* Generation Mode Toggle Options */}
                    <div className="space-y-3">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Catalog Number Generation Mode</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setGenMode('auto')}
                                className={`p-3 border rounded-sm text-center flex flex-col items-center justify-center transition-all ${
                                    genMode === 'auto'
                                        ? 'border-black bg-black text-[#D4AF37]'
                                        : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-black'
                                }`}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider">Sequential</span>
                                <span className="text-[8px] mt-1 opacity-80 font-mono">CAT-YYYY-NNNNN</span>
                            </button>
                            <button
                                type="button"
                                disabled={!accessionNumber}
                                onClick={() => setGenMode('derived')}
                                className={`p-3 border rounded-sm text-center flex flex-col items-center justify-center transition-all ${
                                    !accessionNumber 
                                        ? 'opacity-40 cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400' 
                                        : genMode === 'derived'
                                            ? 'border-black bg-black text-[#D4AF37]'
                                            : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-black'
                                }`}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider">Derived</span>
                                <span className="text-[8px] mt-1 opacity-80 font-mono">{accessionNumber ? `${accessionNumber.substring(0, 7)}...` : 'N/A'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setGenMode('custom')}
                                className={`p-3 border rounded-sm text-center flex flex-col items-center justify-center transition-all ${
                                    genMode === 'custom'
                                        ? 'border-black bg-black text-[#D4AF37]'
                                        : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-black'
                                }`}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider">Manual</span>
                                <span className="text-[8px] mt-1 opacity-80 font-mono">Custom</span>
                            </button>
                        </div>
                    </div>

                    {/* Mode Specific Settings Display */}
                    {genMode === 'auto' && (
                        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-sm animate-in fade-in duration-300">
                            <span className="text-[9px] uppercase font-bold text-zinc-400 block mb-1">Generated Number Preview</span>
                            <span className="text-sm font-mono font-bold text-zinc-600">CAT-{new Date().getFullYear()}-[SEQ_COUNTER]</span>
                        </div>
                    )}

                    {genMode === 'derived' && (
                        <div className="space-y-4 p-4 border border-zinc-200 bg-zinc-50/50 rounded-sm animate-in fade-in duration-300">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Suffix Type</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSuffixType('numeric')}
                                        className={`px-3 py-1 text-[9px] uppercase font-bold tracking-widest border rounded-sm transition-all ${
                                            suffixType === 'numeric'
                                                ? 'bg-black text-white border-black'
                                                : 'bg-white text-zinc-400 border-zinc-200 hover:text-black'
                                        }`}
                                    >
                                        Numeric (.1)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSuffixType('alpha')}
                                        className={`px-3 py-1 text-[9px] uppercase font-bold tracking-widest border rounded-sm transition-all ${
                                            suffixType === 'alpha'
                                                ? 'bg-black text-white border-black'
                                                : 'bg-white text-zinc-400 border-zinc-200 hover:text-black'
                                        }`}
                                    >
                                        Letter (a)
                                    </button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 items-center">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Suffix Value</label>
                                    <input 
                                        type="text"
                                        required
                                        value={suffixValue}
                                        onChange={(e) => {
                                            const cleaned = e.target.value.toLowerCase().replace(suffixType === 'numeric' ? /[^0-9]/g : /[^a-z]/g, '');
                                            setSuffixValue(cleaned);
                                        }}
                                        className="w-full bg-white border border-zinc-300 rounded-sm px-3 py-2 text-sm text-black focus:outline-none focus:border-[#D4AF37] font-mono"
                                        placeholder={suffixType === 'numeric' ? 'e.g. 1' : 'e.g. a'}
                                    />
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] uppercase font-bold text-zinc-400 block mb-1">Preview</span>
                                    <span className="text-sm font-mono font-bold text-black break-all">{derivedCatalogNumber || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {genMode === 'custom' && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Catalog Number *</label>
                            <input 
                                type="text"
                                required
                                value={customCatalogNumber}
                                onChange={(e) => setCustomCatalogNumber(e.target.value)}
                                placeholder="e.g. CAT-2026-00042 or 2026.001.01.1"
                                className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-4 py-3 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-mono"
                            />
                            <p className="text-[9px] text-zinc-400">Must match pattern: CAT-YYYY-NNNNN or derived YYYY.SEQ.BATCH.x / YYYY.SEQ.BATCHa</p>
                        </div>
                    )}

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
