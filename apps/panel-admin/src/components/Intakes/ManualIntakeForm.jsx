import { useState } from 'react';

export default function ManualIntakeForm({
    actionLoading,
    onSubmit,
    onCancel
}) {
    const [itemName, setItemName] = useState('');
    const [sourceInfo, setSourceInfo] = useState('');
    const [description, setDescription] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [method, setMethod] = useState('gift');
    const [loanEndDate, setLoanEndDate] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            itemName,
            sourceInfo,
            description,
            quantity: Number(quantity),
            method,
            loanEndDate: method === 'loan' ? loanEndDate : null
        });
    };

    return (
        <div className="border border-zinc-200 bg-white rounded-sm flex flex-col h-[600px] p-8 shadow-sm">
            <div className="border-b border-zinc-200 pb-4 mb-6 flex justify-between items-center bg-zinc-50 -mx-8 -mt-8 p-8 rounded-t-sm">
                <div>
                    <h2 className="text-2xl font-serif text-black uppercase tracking-wider leading-tight">Register Manual Intake</h2>
                    <p className="text-xs text-zinc-500 mt-1 font-light">Record an offline or legacy acquisition directly.</p>
                </div>
                <button 
                    onClick={onCancel} 
                    type="button"
                    className="p-3 bg-white border border-zinc-300 rounded-sm hover:bg-zinc-50 transition-all text-zinc-400 hover:text-black"
                >
                    ✕
                </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between space-y-6 overflow-y-auto pr-1">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Artifact / Item Name</label>
                        <input 
                            type="text" 
                            required 
                            value={itemName} 
                            onChange={(e) => setItemName(e.target.value)}
                            className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-medium"
                            placeholder="e.g. Pre-colonial Gold Mask"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Source / Donor Information</label>
                        <input 
                            type="text" 
                            required 
                            value={sourceInfo} 
                            onChange={(e) => setSourceInfo(e.target.value)}
                            className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-medium"
                            placeholder="e.g. Donated by Jefferson Reyes, Purchased from Sotheby's"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Description <span className="text-zinc-300 font-normal normal-case">(optional)</span></label>
                        <textarea
                            value={description} 
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Brief physical description or provenance notes..."
                            className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all resize-none placeholder:text-zinc-400 font-light"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Acquisition Method</label>
                            <select 
                                value={method} 
                                onChange={(e) => setMethod(e.target.value)}
                                className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-medium"
                            >
                                <option value="gift">Gift</option>
                                <option value="loan">Loan</option>
                                <option value="purchase">Purchase</option>
                                <option value="existing">Existing in Collection</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Quantity</label>
                            <input 
                                type="number" 
                                required 
                                min="1" 
                                max="10000" 
                                value={quantity} 
                                onChange={(e) => setQuantity(e.target.value)}
                                className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-medium"
                            />
                        </div>
                    </div>

                    {method === 'loan' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">Loan End Date</label>
                            <input 
                                type="date" 
                                required 
                                value={loanEndDate} 
                                onChange={(e) => setLoanEndDate(e.target.value)}
                                className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-medium"
                            />
                        </div>
                    )}
                </div>
                
                <button 
                    type="submit" 
                    disabled={actionLoading} 
                    className="w-full py-4 bg-black text-[#D4AF37] rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all flex items-center justify-center gap-2 mt-auto disabled:opacity-50"
                >
                    {actionLoading ? 'Saving...' : 'Save Manual Intake Record'}
                </button>
            </form>
        </div>
    );
}
