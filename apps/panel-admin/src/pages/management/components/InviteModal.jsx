// apps/panel-admin/src/pages/management/components/InviteModal.jsx
import { useState } from 'react';
import { X, Mail } from 'lucide-react';

export default function InviteModal({ isOpen, onClose, onInvite, actionLoading }) {
    const [inviteForm, setInviteForm] = useState({
        email: '',
        role: 'curator',
        fname: '',
        lname: ''
    });

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onInvite(inviteForm, () => {
            setInviteForm({ email: '', role: 'curator', fname: '', lname: '' });
        });
    };

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
                            <h2 className="text-2xl font-serif text-black uppercase tracking-widest">Invite Personnel / Donor</h2>
                            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold italic">Dispatch an official access token to a new directory record</p>
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
                                    value={inviteForm.fname}
                                    onChange={e => setInviteForm({...inviteForm, fname: e.target.value})}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37]"
                                    disabled={actionLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Last Name</label>
                                <input 
                                    required 
                                    type="text" 
                                    value={inviteForm.lname}
                                    onChange={e => setInviteForm({...inviteForm, lname: e.target.value})}
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
                                value={inviteForm.email}
                                onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37]"
                                placeholder="name@museo-bulawan.ph"
                                disabled={actionLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Initial Role</label>
                            <select 
                                value={inviteForm.role}
                                onChange={e => setInviteForm({...inviteForm, role: e.target.value})}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] appearance-none"
                                disabled={actionLoading}
                            >
                                {roles.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                        </div>

                        <button 
                            disabled={actionLoading}
                            className="w-full py-5 bg-black text-[#D4AF37] rounded-sm font-black uppercase tracking-widest text-[10px] hover:bg-zinc-900 shadow-xl shadow-black/10 disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
                        >
                            {actionLoading ? 'Provisioning Account...' : <><Mail className="w-4 h-4" /> Send Access Invitation</>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
