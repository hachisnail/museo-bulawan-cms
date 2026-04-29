import { useState, useEffect } from 'react';
import { useAuth } from '../context/authContext';

export default function Management() {
    const { apiFetch } = useAuth();
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/api/v1/user')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    setUsers(data.data);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch users", err);
                setLoading(false);
            });
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Access Management</h1>
                {activeTab === 'invites' && (
                    <button className="bg-[var(--color-brand-600)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-brand-500)] transition-colors shadow-lg shadow-indigo-500/20">
                        + Invite New User
                    </button>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-4 border-b border-[var(--color-glass-border)]">
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`pb-3 px-2 transition-all duration-300 font-medium ${activeTab === 'users' ? 'border-b-2 border-[var(--color-brand-500)] text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
                >
                    Active Directory
                </button>
                <button 
                    onClick={() => setActiveTab('invites')}
                    className={`pb-3 px-2 transition-all duration-300 font-medium ${activeTab === 'invites' ? 'border-b-2 border-[var(--color-brand-500)] text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
                >
                    Pending Invites
                </button>
            </div>

            {/* Table Content */}
            <div className="glass-panel rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[var(--color-glass)] text-xs uppercase text-[var(--text-secondary)] font-semibold border-b border-[var(--color-glass-border)]">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-glass-border)]">
                        {loading ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-12 text-center text-[var(--text-secondary)]">Loading directory...</td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-12 text-center text-[var(--text-secondary)]">No users found.</td>
                            </tr>
                        ) : users.map(u => (
                            <tr key={u.id} className="hover:bg-[var(--color-glass)] transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-white">{u.fname} {u.lname}</div>
                                    <div className="text-xs text-[var(--text-secondary)]">{u.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold border border-purple-500/20 text-purple-400 bg-purple-500/10 capitalize">
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`flex items-center gap-1.5 text-xs font-medium ${u.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                                        <span className={`w-2 h-2 rounded-full ${u.status === 'active' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-yellow-400'}`}></span> 
                                        {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-[var(--text-secondary)] hover:text-white transition-colors">⋮</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}