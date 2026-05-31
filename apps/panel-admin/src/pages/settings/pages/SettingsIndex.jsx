// apps/panel-admin/src/pages/settings/pages/SettingsIndex.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/authContext';
import Modal from '../../../components/Modal';
import { Eye, EyeOff, Shield } from 'lucide-react';

export default function SettingsIndex() {
    const { user, apiFetch, updateUser } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });

    // Profile Form
    const [profileData, setProfileData] = useState({
        fname: '',
        lname: '',
        email: '',
        username: ''
    });

    useEffect(() => {
        if (user) {
            setProfileData({
                fname: user.fname || '',
                lname: user.lname || '',
                email: user.email || '',
                username: user.username || ''
            });
        }
    }, [user]);

    // Password Form
    const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
    const [showPass, setShowPass] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────────
    //  Handlers
    // ─────────────────────────────────────────────────────────────────────────────
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await apiFetch('/api/v1/user/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fname: profileData.fname,
                    lname: profileData.lname
                })
            });
            const data = await res.json();
            if (res.ok) {
                updateUser({ fname: profileData.fname, lname: profileData.lname });
                setModal({ isOpen: true, title: 'Success', message: 'Identity profile details updated.', type: 'alert', variant: 'success' });
            } else {
                setModal({ isOpen: true, title: 'Update Failed', message: data.error || 'Check fields.', type: 'alert', variant: 'error' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Update Failed', message: 'Could not save profile changes.', type: 'alert', variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (passwords.next !== passwords.confirm) {
            setModal({ isOpen: true, title: 'Mismatch', message: 'New passwords do not match.', type: 'alert', variant: 'error' });
            return;
        }
        setLoading(true);
        try {
            const res = await apiFetch('/api/v1/user/me/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next })
            });
            const data = await res.json();
            if (res.ok) {
                setModal({ isOpen: true, title: 'Success', message: 'Password updated successfully.', type: 'alert', variant: 'success' });
                setPasswords({ current: '', next: '', confirm: '' });
            } else {
                setModal({ isOpen: true, title: 'Failed', message: data.error || 'Password update failed.', type: 'alert', variant: 'error' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'System error during password update.', type: 'alert', variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Tabs mapping & events
    const tabsConfig = [
        { id: 'profile', label: 'Identity' },
        { id: 'security', label: 'Security' },
        { id: 'notifications', label: 'Alerts' }
    ];

    if (user?.role === 'admin') {
        tabsConfig.push({ id: 'system', label: 'Archival Specs' });
    }

    return (
        <div className="flex flex-col gap-y-6 bg-white pb-12  mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header Block */}
            <section className="border-b border-gray-100 pb-4 mb-2">
                <h1 className="text-3xl font-bold text-black tracking-tight">Configuration</h1>
                <p className="text-sm text-gray-500 mt-1">Manage your curatorial identity, system alerts, and security variables.</p>
            </section>

            {/* Horizontal Tabs Navigation */}
            <div className="flex border-b border-gray-150 gap-6 mb-6">
                {tabsConfig.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-3 text-xs font-black uppercase tracking-widest transition-all relative ${
                            activeTab === tab.id ? 'text-black' : 'text-zinc-400 hover:text-zinc-650'
                        }`}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-black animate-in fade-in duration-200" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Panel Area */}
            <div className="bg-white border border-gray-150 rounded-xl p-8 shadow-sm w-full animate-in fade-in duration-300">
                {activeTab === 'profile' && (
                    <div className="space-y-8">
                        <div className="space-y-1">
                            <h2 className="text-xl font-serif text-black uppercase tracking-wide">Archival Identity</h2>
                            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Public profile and system identifier</p>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">First Name</label>
                                    <input 
                                        type="text" 
                                        value={profileData.fname}
                                        onChange={e => setProfileData({...profileData, fname: e.target.value})}
                                        className="w-full bg-zinc-50 border border-zinc-300 rounded px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-all"
                                        disabled={loading}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Last Name</label>
                                    <input 
                                        type="text" 
                                        value={profileData.lname}
                                        onChange={e => setProfileData({...profileData, lname: e.target.value})}
                                        className="w-full bg-zinc-50 border border-zinc-300 rounded px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-all"
                                        disabled={loading}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Username</label>
                                <input 
                                    disabled 
                                    type="text" 
                                    value={profileData.username}
                                    className="w-full bg-zinc-100 border border-zinc-300 rounded px-5 py-3 text-sm text-zinc-450 cursor-not-allowed font-mono"
                                />
                                <p className="text-[8px] text-zinc-400 italic">Unique identifiers are locked to ensure archival integrity.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Email Address</label>
                                <input 
                                    disabled
                                    type="email" 
                                    value={profileData.email}
                                    className="w-full bg-zinc-100 border border-zinc-300 rounded px-5 py-3 text-sm text-zinc-450 cursor-not-allowed font-mono"
                                />
                                <p className="text-[8px] text-zinc-400 italic">Email modifications must be authorized by an Administrator.</p>
                            </div>

                            <div className="pt-6 border-t border-zinc-200 flex justify-end">
                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    className="bg-black text-[#D4AF37] px-8 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Apply Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="space-y-8">
                        <div className="space-y-1">
                            <h2 className="text-xl font-serif text-black uppercase tracking-wide">Security Protocols</h2>
                            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Update credentials and access keys</p>
                        </div>

                        <form onSubmit={handleUpdatePassword} className="space-y-6">
                            <div className="space-y-2 relative">
                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Current Password</label>
                                <input 
                                    type={showPass ? 'text' : 'password'} 
                                    required
                                    value={passwords.current}
                                    onChange={e => setPasswords({...passwords, current: e.target.value})}
                                    className="w-full bg-zinc-50 border border-zinc-300 rounded px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-all"
                                    disabled={loading}
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-4 bottom-3 text-zinc-300 hover:text-black transition-colors"
                                >
                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-zinc-200">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">New Password</label>
                                    <input 
                                        type={showPass ? 'text' : 'password'} 
                                        required
                                        value={passwords.next}
                                        onChange={e => setPasswords({...passwords, next: e.target.value})}
                                        className="w-full bg-zinc-50 border border-zinc-300 rounded px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-all"
                                        disabled={loading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Confirm Password</label>
                                    <input 
                                        type={showPass ? 'text' : 'password'} 
                                        required
                                        value={passwords.confirm}
                                        onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                        className="w-full bg-zinc-50 border border-zinc-300 rounded px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-all"
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="pt-6 flex justify-between items-center border-t border-zinc-250">
                                <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-black italic">Change requires immediate sign-in</p>
                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    className="bg-black text-white px-8 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                                >
                                    {loading ? 'Processing...' : 'Update Credentials'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="space-y-8">
                        <div className="space-y-1">
                            <h2 className="text-xl font-serif text-black uppercase tracking-wide">Alert & Signal Config</h2>
                            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Configure real-time SSE and email alerts</p>
                        </div>

                        <div className="space-y-4">
                            {[
                                { label: 'Critical Archive Alerts', desc: 'Notify on unauthorized location changes or deaccessions.', enabled: true },
                                { label: 'SSE Pulse Overlay', desc: 'Enable visual toast notifications for incoming acquisitions.', enabled: true },
                                { label: 'System Health Diagnostics', desc: 'Receive periodic reports on server and database status.', enabled: false },
                                { label: 'Audit Trail Summaries', desc: 'Weekly email digest of system activities.', enabled: true }
                            ].map((opt, i) => (
                                <label key={i} className="flex items-center justify-between p-6 border border-zinc-100 rounded hover:bg-zinc-50/50 transition-all cursor-pointer">
                                    <div>
                                        <div className="text-[11px] font-black uppercase tracking-widest text-black mb-1">{opt.label}</div>
                                        <p className="text-[10px] text-zinc-400 italic">{opt.desc}</p>
                                    </div>
                                    <input type="checkbox" defaultChecked={opt.enabled} className="w-4 h-4 accent-[#D4AF37] cursor-pointer" />
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'system' && user?.role === 'admin' && (
                    <div className="space-y-8">
                        <div className="space-y-1">
                            <h2 className="text-xl font-serif text-black uppercase tracking-wide">System Archival Specs</h2>
                            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Administrative variables and configurations</p>
                        </div>

                        <div className="p-6 border border-zinc-100 rounded bg-zinc-50/50 flex items-start gap-4">
                            <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                            <div className="space-y-1">
                                <div className="text-xs font-bold text-black uppercase tracking-wider">Restricted Administration</div>
                                <p className="text-[10px] text-zinc-500 font-light italic">
                                    These specifications govern the database connection limit, MinIO bucket policies, and security tokens. They are set via environment variables. Contact the engineering team for adjustments.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Modal 
                {...modal} 
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
}
