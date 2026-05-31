import { useState } from 'react';

export default function MovementForm({
    locations,
    onSubmit,
    onCancel,
    actionLoading
}) {
    const [toLocation, setToLocation] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!toLocation) {
            setError('Please select a destination location.');
            return;
        }

        if (!reason.trim()) {
            setError('Reason for location transfer is required.');
            return;
        }

        onSubmit({
            toLocation,
            reason: reason.trim()
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37] mb-2">
                Log Physical Location Transfer
            </h4>
            
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider rounded-sm">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block">Destination Location *</label>
                <select
                    required
                    value={toLocation}
                    onChange={(e) => setToLocation(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-sm px-3 py-2 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                >
                    <option value="">-- Select Location --</option>
                    {locations.map((loc) => (
                        <option key={loc.id} value={loc.name}>
                            {loc.name} ({loc.type})
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block">Reason for Transfer *</label>
                <textarea
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Moved to Gallery 2 for upcoming Pre-colonial Exhibition..."
                    rows="3"
                    className="w-full bg-white border border-zinc-300 rounded-sm px-3 py-2 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] resize-none"
                />
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border border-zinc-300 text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors rounded-sm"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2 bg-black text-[#D4AF37] text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 transition-colors rounded-sm disabled:opacity-50"
                >
                    {actionLoading ? 'Logging...' : 'Confirm Transfer'}
                </button>
            </div>
        </form>
    );
}
