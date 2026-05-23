import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/authContext';
import { 
    Users, 
    UserPlus, 
    Mail, 
    Shield, 
    Search, 
    X, 
    Check, 
    UserMinus,
    RefreshCw,
    Activity,
    Lock,
    MoreHorizontal
} from 'lucide-react';
import Modal from '../components/Modal';

export default function Management() {
    const { apiFetch } = useAuth();
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });

    // Form states
    const [inviteForm, setInviteForm] = useState({ email: '', role: 'curator', fname: '', lname: '' });
    const [editForm, setEditForm] = useState({ role: '', status: '' });

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/v1/user');
            const data = await res.json();
            if (data.status === 'success') {
                const items = data.data.items || data.data || [];
                setUsers(items);
            }
        } catch (err) {
            console.error("Failed to fetch users", err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleInvite = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await apiFetch('/api/v1/user/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inviteForm)
            });
            const data = await res.json();
            if (res.ok) {
                setModal({ isOpen: true, title: 'Success', message: 'Staff invitation dispatched.', type: 'alert', variant: 'success' });
                setShowInviteModal(false);
                fetchUsers();
                setInviteForm({ email: '', role: 'curator', fname: '', lname: '' });
            } else {
                setModal({ isOpen: true, title: 'Dispatch Failed', message: data.error || 'Check server logs.', type: 'alert', variant: 'error' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Internal system fault.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/user/${selectedUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            if (res.ok) {
                setShowEditModal(false);
                fetchUsers();
                setModal({ isOpen: true, title: 'Success', message: 'Permissions updated.', type: 'alert', variant: 'success' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Update failed.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeactivate = (userId) => {
        setModal({
            isOpen: true,
            title: 'Deactivate Staff',
            message: 'Are you sure? This will immediately revoke all access keys for this user.',
            type: 'confirm',
            variant: 'error',
            onConfirm: async () => {
                try {
                    const res = await apiFetch(`/api/v1/user/${userId}/deactivate`, { method: 'POST' });
                    if (res.ok) fetchUsers();
                } catch (err) { alert('Action failed'); }
            }
        });
    };

    const handleResendInvite = async (userId) => {
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/user/${userId}/resend-invite`, { method: 'POST' });
            if (res.ok) {
                setModal({ isOpen: true, title: 'Success', message: 'Invitation resent.', type: 'alert', variant: 'success' });
                fetchUsers();
            } else {
                const data = await res.json();
                setModal({ isOpen: true, title: 'Error', message: data.error || 'Failed to resend invite.', type: 'alert', variant: 'error' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'Internal system fault.', type: 'alert', variant: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const filteredUsers = Array.isArray(users) ? users.filter(u => 
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (`${u.fname} ${u.lname}`).toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    const activeUsers = filteredUsers.filter(u => u.status === 'active');
    const pendingInvites = filteredUsers.filter(u => u.status === 'invited' || u.status === 'pending');

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-300 pb-10">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#D4AF37]">
                        <Lock className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Identity & Access Management</span>
                    </div>
                    <h1 className="text-4xl font-serif text-black tracking-tight uppercase">Authorized Personnel</h1>
                    <p className="text-xs text-zinc-400 max-w-md font-light italic">Manage curatorial roles, provision new staff accounts, and maintain the museum's security perimeter.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-black transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search directory..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-zinc-50 border border-zinc-300 rounded-sm pl-12 pr-6 py-3 text-sm text-black focus:outline-none focus:border-black w-64 transition-all"
                        />
                    </div>
                    <button 
                        onClick={() => setShowInviteModal(true)}
                        className="bg-black text-[#D4AF37] px-6 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-black/10 hover:bg-zinc-900 transition-all"
                    >
                        <UserPlus className="w-4 h-4" /> Invite Staff
                    </button>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { label: 'Active Personnel', value: activeUsers.length, icon: Users, color: 'text-zinc-600', bg: 'bg-zinc-50' },
                    { label: 'Provisioning Queue', value: pendingInvites.length, icon: Mail, color: 'text-[#D4AF37]', bg: 'bg-zinc-50' },
                    { label: 'System Security', value: 'Nominal', icon: Shield, color: 'text-green-600', bg: 'bg-green-50' }
                ].map((stat, i) => (
                    <div key={i} className={`${stat.bg} border border-zinc-100 rounded-sm p-8 flex items-center gap-6 shadow-sm`}>
                        <div className={`w-14 h-14 rounded-sm bg-white border border-zinc-200 flex items-center justify-center`}>
                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{stat.label}</div>
                            <div className="text-3xl font-serif text-black">{stat.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Tabs */}
            <div className="space-y-6">
                <div className="flex gap-10 border-b border-zinc-300">
                    {[
                        { id: 'users', label: 'Authorized Directory', count: activeUsers.length },
                        { id: 'invites', label: 'Provisioning Queue', count: pendingInvites.length }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab.id ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'}`}
                        >
                            {tab.label}
                            <span className="ml-3 text-[9px] px-2 py-0.5 border border-zinc-300 rounded-sm bg-zinc-50">{tab.count}</span>
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#D4AF37]" />}
                        </button>
                    ))}
                </div>

                <div className="bg-white border border-zinc-300 rounded-sm overflow-hidden shadow-sm min-h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                            <div className="w-6 h-6 border-2 border-zinc-300 border-t-[#D4AF37] rounded-full animate-spin" />
                            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Synchronizing Directory...</div>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-zinc-50 text-[9px] uppercase font-black text-zinc-500 tracking-widest border-b border-zinc-300">
                                    <th className="px-8 py-5">Staff Member</th>
                                    <th className="px-8 py-5">Role / Permissions</th>
                                    <th className="px-8 py-5">Security Status</th>
                                    <th className="px-8 py-5">Authorized On</th>
                                    <th className="px-8 py-5 text-right">Controls</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200">
                                {(activeTab === 'users' ? activeUsers : pendingInvites).length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-8 py-20 text-center">
                                            <div className="text-zinc-400 font-serif italic text-lg">No personnel records found in the current directory segment.</div>
                                        </td>
                                    </tr>
                                ) : (activeTab === 'users' ? activeUsers : pendingInvites).map((u) => (
                                    <tr key={u.id} className="group hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-sm bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 font-black text-[10px] uppercase">
                                                    {(u.fname || '?')[0]}{(u.lname || '?')[0]}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-black group-hover:text-[#A68A27] transition-colors">{u.fname} {u.lname}</div>
                                                    <div className="text-[10px] text-zinc-400 font-mono tracking-tighter">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-2.5 py-1 rounded-sm text-[8px] font-black uppercase tracking-widest border ${
                                                u.role === 'admin' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                                                u.role === 'curator' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                                                'bg-zinc-50 border-zinc-200 text-zinc-600'
                                            }`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-amber-500'}`} />
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${u.status === 'active' ? 'text-black' : 'text-zinc-400'}`}>
                                                    {u.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="text-[11px] text-zinc-400 font-mono uppercase tracking-tighter">
                                                {new Date(u.created_at || u.created).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {u.status === 'invited' && (
                                                    <button 
                                                        onClick={() => handleResendInvite(u.id)}
                                                        className="p-2 hover:bg-zinc-100 rounded-sm text-zinc-400 hover:text-black transition-all"
                                                        title="Resend Invite"
                                                    >
                                                        <Mail className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => {
                                                        setSelectedUser(u);
                                                        setEditForm({ role: u.role, status: u.status });
                                                        setShowEditModal(true);
                                                    }}
                                                    className="p-2 hover:bg-zinc-100 rounded-sm text-zinc-400 hover:text-black transition-all"
                                                    title="Modify Permissions"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeactivate(u.id)}
                                                    className="p-2 hover:bg-rose-50 rounded-sm text-zinc-300 hover:text-rose-600 transition-all"
                                                    title="Deactivate Account"
                                                >
                                                    <UserMinus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Invite Modal Overlay */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => !actionLoading && setShowInviteModal(false)} />
                    <div className="relative bg-white border border-zinc-200 w-full max-w-lg rounded-sm shadow-2xl overflow-hidden">
                        <div className="p-10 space-y-8">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-serif text-black uppercase tracking-widest">Invite Personnel</h2>
                                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold italic">Dispatch an official access token to a new staff member</p>
                                </div>
                                <button onClick={() => setShowInviteModal(false)} className="text-zinc-300 hover:text-black transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleInvite} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">First Name</label>
                                        <input 
                                            required type="text" value={inviteForm.fname}
                                            onChange={e => setInviteForm({...inviteForm, fname: e.target.value})}
                                            className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Last Name</label>
                                        <input 
                                            required type="text" value={inviteForm.lname}
                                            onChange={e => setInviteForm({...inviteForm, lname: e.target.value})}
                                            className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37]"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Email Address</label>
                                    <input 
                                        required type="email" value={inviteForm.email}
                                        onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37]"
                                        placeholder="curator@museo-bulawan.ph"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Initial Role</label>
                                    <select 
                                        value={inviteForm.role}
                                        onChange={e => setInviteForm({...inviteForm, role: e.target.value})}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-5 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] appearance-none"
                                    >
                                        <option value="curator">Curator</option>
                                        <option value="registrar">Registrar</option>
                                        <option value="admin">Administrator</option>
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
            )}

            <Modal 
                {...modal} 
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
}