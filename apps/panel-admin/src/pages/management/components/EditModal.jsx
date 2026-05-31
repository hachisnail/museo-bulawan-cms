// apps/panel-admin/src/pages/management/components/EditModal.jsx
import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

export default function EditModal({ isOpen, onClose, user, targetUser, onUpdate, actionLoading }) {
    const [editForm, setEditForm] = useState({
        fname: '',
        lname: '',
        email: '',
        role: ''
    });

    useEffect(() => {
        if (targetUser) {
            setEditForm({
                fname: targetUser.fname || '',
                lname: targetUser.lname || '',
                email: targetUser.email || '',
                role: targetUser.role || 'visitor'
            });
        }
    }, [targetUser]);

    if (!isOpen || !targetUser) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onUpdate(targetUser.id, editForm);
    };

    const isSelf = user?.id === targetUser.id;

    const roles = [
        { value: 'admin', label: 'Administrator' },
        { value: 'registrar', label: 'Registrar' },
        { value: 'conservator', label: 'Conservator' },
        { value: 'inventory_staff', label: 'Inventory Staff' },
        { value: 'content_editor', label: 'Content Editor' },
        { value: 'content_writer', label: 'Content Writer' },
        { value: 'appointment_coordinator', label: 'Appointment Coordinator' },
        { value: 'donor', label: 'Donor' },
        { value: 'visitor', label: 'Visitor' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => !actionLoading && onClose()} />
            <div className="relative bg-white border border-zinc-200 w-full max-w-lg rounded-sm shadow-2xl overflow-hidden">
                <div className="p-10 space-y-8">
                    <div className="flex justify-between items-start">
                        <div className="space-y-2">
                            <h2 className="text-2xl font-serif text-black uppercase tracking-widest">Modify Permissions</h2>
                            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold italic">Update user information and access controls</p>
                        </div>
                        <button onClick={onClose} disabled={actionLoading} className="text-zinc-300 hover:text-black transition-colors disabled:opacity-50">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">First Name</label>
                                <input 
                                    required 
                                    type="text" 
                                    value={editForm.fname}
                                    onChange={e => setEditForm({...editForm, fname: e.target.value})}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37]"
                                    disabled={actionLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Last Name</label>
                                <input 
                                    required 
                                    type="text" 
                                    value={editForm.lname}
                                    onChange={e => setEditForm({...editForm, lname: e.target.value})}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37]"
                                    disabled={actionLoading}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Email Address</label>
                            <input 
                                required 
                                type="email" 
                                value={editForm.email}
                                onChange={e => setEditForm({...editForm, email: e.target.value})}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37]"
                                disabled={actionLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">System Role / Permissions</label>
                            {isSelf ? (
                                <div className="w-full bg-zinc-100 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-zinc-500 font-mono">
                                    {editForm.role.toUpperCase()} (Cannot change own role)
                                </div>
                            ) : (
                                <select 
                                    value={editForm.role}
                                    onChange={e => setEditForm({...editForm, role: e.target.value})}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] appearance-none"
                                    disabled={actionLoading}
                                >
                                    {roles.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <button 
                            disabled={actionLoading}
                            className="w-full py-5 bg-black text-[#D4AF37] rounded-sm font-black uppercase tracking-widest text-[10px] hover:bg-zinc-900 shadow-xl shadow-black/10 disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
                        >
                            {actionLoading ? 'Saving Changes...' : <><Save className="w-4 h-4" /> Save Access Rules</>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
