import { useState, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { 
    Users, 
    UserPlus, 
    Mail, 
    Shield, 
    MoreVertical, 
    Search, 
    X, 
    Check, 
    UserMinus,
    RefreshCw,
    Activity
} from 'lucide-react';

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

    // Form states
    const [inviteForm, setInviteForm] = useState({ email: '', role: 'curator', fname: '', lname: '' });
    const [editForm, setEditForm] = useState({ role: '', status: '' });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/v1/user');
            const data = await res.json();
            if (data.status === 'success') {
                // Handle both paginated and raw array responses
                const items = data.data.items || data.data || [];
                setUsers(items);
            }
        } catch (err) {
            console.error("Failed to fetch users", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

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
                alert('Invitation sent successfully');
                setShowInviteModal(false);
                fetchUsers();
                setInviteForm({ email: '', role: 'curator', fname: '', lname: '' });
            } else {
                alert(data.error || 'Failed to send invitation');
            }
        } catch (err) {
            alert('An error occurred');
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
            }
        } catch (err) {
            alert('Update failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeactivate = async (userId) => {
        if (!confirm('Are you sure you want to deactivate this user? They will lose all access immediately.')) return;
        try {
            const res = await apiFetch(`/api/v1/user/${userId}/deactivate`, { method: 'POST' });
            if (res.ok) fetchUsers();
        } catch (err) { alert('Action failed'); }
    };

    const handleResendInvite = async (userId) => {
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/user/invite/resend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            if (res.ok) alert('Invitation resent successfully');
        } catch (err) { alert('Action failed'); }
        finally { setActionLoading(false); }
    };

    const filteredUsers = Array.isArray(users) ? users.filter(u => 
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (`${u.fname} ${u.lname}`).toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    const activeUsers = filteredUsers.filter(u => u.status === 'active');
    const pendingInvites = filteredUsers.filter(u => u.status === 'invited' || u.status === 'pending');

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-indigo-400">
                        <Shield className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Administrative Suite</span>
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight">Identity & Access</h1>
                    <p className="text-sm text-zinc-500 max-w-md">Manage curatorial roles, invite staff, and oversee the museum's digital security perimeter.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search directory..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-black/40 border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 w-64 transition-all"
                        />
                    </div>
                    <button 
                        onClick={() => setShowInviteModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                    >
                        <UserPlus className="w-4 h-4" />
                        Invite Staff
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Active Personnel', value: activeUsers.length, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Pending Access', value: pendingInvites.length, icon: Mail, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: 'System Load', value: 'Nominal', icon: Activity, color: 'text-indigo-400', bg: 'bg-indigo-500/10' }
                ].map((stat, i) => (
                    <div key={i} className="bg-black/20 border border-white/5 rounded-[32px] p-6 flex items-center gap-6">
                        <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center`}>
                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{stat.label}</div>
                            <div className="text-2xl font-black text-white">{stat.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Tabs */}
            <div className="space-y-6">
                <div className="flex gap-8 border-b border-white/5">
                    {[
                        { id: 'users', label: 'Active Directory', count: activeUsers.length },
                        { id: 'invites', label: 'Provisioning Queue', count: pendingInvites.length }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab.id ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                            {tab.label}
                            <span className="ml-2 text-[9px] bg-white/5 px-2 py-0.5 rounded-full">{tab.count}</span>
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]" />}
                        </button>
                    ))}
                </div>

                <div className="bg-black/20 border border-white/5 rounded-[40px] overflow-hidden min-h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 text-center">
                                Initializing Directory<br/>
                                <span className="text-zinc-800">Verifying Security Protocols</span>
                            </div>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] text-[10px] uppercase font-black text-zinc-500 tracking-widest border-b border-white/5">
                                    <th className="px-8 py-6">Staff Member</th>
                                    <th className="px-8 py-6">Role & Permissions</th>
                                    <th className="px-8 py-6">Status</th>
                                    <th className="px-8 py-6">Joined</th>
                                    <th className="px-8 py-6 text-right">Control</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {(activeTab === 'users' ? activeUsers : pendingInvites).length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-8 py-20 text-center">
                                            <div className="text-zinc-700 font-serif italic text-lg">No records matching your search criteria were found in the active directory.</div>
                                        </td>
                                    </tr>
                                ) : (activeTab === 'users' ? activeUsers : pendingInvites).map((u) => (
                                    <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xs">
                                                    {(u.fname || '?')[0]}{(u.lname || '?')[0]}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{u.fname} {u.lname}</div>
                                                    <div className="text-xs text-zinc-500">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                                                u.role === 'admin' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                                                u.role === 'curator' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                                                'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
                                            }`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${u.status === 'active' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    {u.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="text-xs text-zinc-500 font-mono">
                                                {new Date(u.created_at || u.created).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                {u.status === 'invited' && (
                                                    <button 
                                                        onClick={() => handleResendInvite(u.id)}
                                                        className="p-2 hover:bg-indigo-500/10 rounded-xl text-zinc-500 hover:text-indigo-400 transition-all"
                                                        title="Resend Invitation"
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
                                                    className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 hover:text-white transition-all"
                                                    title="Modify Permissions"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeactivate(u.id)}
                                                    className="p-2 hover:bg-rose-500/10 rounded-xl text-zinc-500 hover:text-rose-400 transition-all"
                                                    title="Deactivate User"
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

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => !actionLoading && setShowInviteModal(false)} />
                    <div className="relative bg-[#0a0a0c] border border-white/10 w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden">
                        <div className="p-10 space-y-8">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-white tracking-tight">Invite Personnel</h2>
                                    <p className="text-sm text-zinc-500">Send an official invitation link to a new staff member.</p>
                                </div>
                                <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleInvite} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">First Name</label>
                                        <input 
                                            required type="text" value={inviteForm.fname}
                                            onChange={e => setInviteForm({...inviteForm, fname: e.target.value})}
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Last Name</label>
                                        <input 
                                            required type="text" value={inviteForm.lname}
                                            onChange={e => setInviteForm({...inviteForm, lname: e.target.value})}
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Email Address</label>
                                    <input 
                                        required type="email" value={inviteForm.email}
                                        onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="curator@museo-bulawan.ph"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Initial Role</label>
                                    <select 
                                        value={inviteForm.role}
                                        onChange={e => setInviteForm({...inviteForm, role: e.target.value})}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 appearance-none"
                                    >
                                        <option value="curator">Curator</option>
                                        <option value="registrar">Registrar</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </div>

                                <button 
                                    disabled={actionLoading}
                                    className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {actionLoading ? 'Provisioning...' : <><Mail className="w-4 h-4" /> Send Access Invitation</>}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in zoom-in duration-300">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowEditModal(false)} />
                    <div className="relative bg-[#0a0a0c] border border-white/10 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden">
                        <div className="p-10 space-y-8">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-white tracking-tight">Modify Permissions</h2>
                                <p className="text-sm text-zinc-500">Updating access for {selectedUser.fname} {selectedUser.lname}.</p>
                            </div>

                            <form onSubmit={handleUpdateUser} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Assign Role</label>
                                    <select 
                                        value={editForm.role}
                                        onChange={e => setEditForm({...editForm, role: e.target.value})}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 appearance-none"
                                    >
                                        <option value="curator">Curator</option>
                                        <option value="registrar">Registrar</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </div>

                                <div className="flex gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="flex-1 py-4 bg-white/5 text-zinc-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={actionLoading}
                                        className="flex-1 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform"
                                    >
                                        {actionLoading ? 'Saving...' : 'Apply Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}