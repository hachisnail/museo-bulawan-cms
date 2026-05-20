import { useState, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { 
    User, 
    Bell, 
    Shield, 
    Palette, 
    Database, 
    Save,
    Lock,
    Eye,
    EyeOff
} from 'lucide-react';
import Modal from '../components/Modal';

export default function Settings() {
    const { user, apiFetch } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });

    // Profile Form
    const [profileData, setProfileData] = useState({
        fname: user?.fname || '',
        lname: user?.lname || '',
        email: user?.email || '',
        username: user?.username || ''
    });

    // Password Form
    const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
    const [showPass, setShowPass] = useState(false);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await apiFetch('/api/v1/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });
            if (res.ok) {
                setModal({ isOpen: true, title: 'Success', message: 'Profile updated. Please refresh to see changes.', type: 'alert', variant: 'success' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Update Failed', message: 'Could not save profile changes.', type: 'alert', variant: 'error' });
        } finally { setLoading(false); }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (passwords.next !== passwords.confirm) {
            setModal({ isOpen: true, title: 'Mismatch', message: 'New passwords do not match.', type: 'alert', variant: 'error' });
            return;
        }
        setLoading(true);
        try {
            const res = await apiFetch('/api/v1/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPassword: passwords.current, newPassword: passwords.next })
            });
            if (res.ok) {
                setModal({ isOpen: true, title: 'Success', message: 'Password changed successfully.', type: 'alert', variant: 'success' });
                setPasswords({ current: '', next: '', confirm: '' });
            } else {
                const data = await res.json();
                setModal({ isOpen: true, title: 'Failed', message: data.error || 'Password update failed.', type: 'alert', variant: 'error' });
            }
        } catch (err) {
            setModal({ isOpen: true, title: 'Error', message: 'System error during password update.', type: 'alert', variant: 'error' });
        } finally { setLoading(false); }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
            {/* Header Section */}
            <header className="border-b border-zinc-300 pb-10">
                <div className="flex items-center gap-3 text-[#D4AF37] mb-2">
                    <Shield className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">System Preferences</span>
                </div>
                <h1 className="text-4xl font-serif text-black tracking-tight uppercase">Configuration</h1>
                <p className="text-xs text-zinc-400 mt-2 font-light italic">Manage your curatorial identity, security protocols, and system behaviors.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Navigation Sidebar */}
                <aside className="lg:col-span-3 space-y-1">
                    {[
                        { id: 'profile', label: 'Identity', icon: <User className="w-4 h-4" /> },
                        { id: 'security', label: 'Security', icon: <Lock className="w-4 h-4" /> },
                        { id: 'notifications', label: 'Alerts', icon: <Bell className="w-4 h-4" /> },
                        { id: 'appearance', label: 'Aesthetics', icon: <Palette className="w-4 h-4" /> },
                        { id: 'system', label: 'Archival Specs', icon: <Database className="w-4 h-4" />, adminOnly: true }
                    ].map(tab => {
                        if (tab.adminOnly && user?.role !== 'admin') return null;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${
                                    activeTab === tab.id 
                                    ? 'bg-black text-[#D4AF37] shadow-lg shadow-black/10' 
                                    : 'text-zinc-400 hover:bg-zinc-100 hover:text-black'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        );
                    })}
                </aside>

                {/* Main Settings Panel */}
                <main className="lg:col-span-9 bg-white border border-zinc-300 rounded-sm overflow-hidden shadow-sm flex flex-col min-h-[500px]">
                    <div className="p-10">
                        {activeTab === 'profile' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-serif text-black uppercase tracking-wide">Archival Identity</h2>
                                    <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Public profile and system identifier</p>
                                </div>

                                <form onSubmit={handleUpdateProfile} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">First Name</label>
                                            <input 
                                                type="text" value={profileData.fname}
                                                onChange={e => setProfileData({...profileData, fname: e.target.value})}
                                                className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Last Name</label>
                                            <input 
                                                type="text" value={profileData.lname}
                                                onChange={e => setProfileData({...profileData, lname: e.target.value})}
                                                className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Username</label>
                                        <input 
                                            disabled type="text" value={profileData.username}
                                            className="w-full bg-zinc-100 border border-zinc-300 rounded-sm px-5 py-3 text-sm text-zinc-400 cursor-not-allowed font-mono"
                                        />
                                        <p className="text-[8px] text-zinc-400 italic">Unique identifiers are locked to ensure archival integrity.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Email Address</label>
                                        <input 
                                            type="email" value={profileData.email}
                                            onChange={e => setProfileData({...profileData, email: e.target.value})}
                                            className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-all"
                                        />
                                    </div>

                                    <div className="pt-6 border-t border-zinc-300 flex justify-end">
                                        <button 
                                            type="submit" disabled={loading}
                                            className="bg-black text-[#D4AF37] px-8 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                                        >
                                            {loading ? 'Saving...' : 'Apply Changes'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-serif text-black uppercase tracking-wide">Security Protocols</h2>
                                    <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Update credentials and access keys</p>
                                </div>

                                <form onSubmit={handleUpdatePassword} className="space-y-6">
                                    <div className="space-y-2 relative">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Current Password</label>
                                        <input 
                                            type={showPass ? 'text' : 'password'} required
                                            value={passwords.current}
                                            onChange={e => setPasswords({...passwords, current: e.target.value})}
                                            className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-all"
                                        />
                                        <button 
                                            type="button" onClick={() => setShowPass(!showPass)}
                                            className="absolute right-4 bottom-3 text-zinc-300 hover:text-black transition-colors"
                                        >
                                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-zinc-300">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">New Password</label>
                                            <input 
                                                type={showPass ? 'text' : 'password'} required
                                                value={passwords.next}
                                                onChange={e => setPasswords({...passwords, next: e.target.value})}
                                                className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Confirm Password</label>
                                            <input 
                                                type={showPass ? 'text' : 'password'} required
                                                value={passwords.confirm}
                                                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                                className="w-full bg-zinc-50 border border-zinc-300 rounded-sm px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-6 flex justify-between items-center">
                                        <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-black italic">Require MFA on next sign-in</p>
                                        <button 
                                            type="submit" disabled={loading}
                                            className="bg-black text-white px-8 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                                        >
                                            {loading ? 'Processing...' : 'Update Credentials'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
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
                                        <label key={i} className="flex items-center justify-between p-6 border border-zinc-100 rounded-sm hover:bg-zinc-50 transition-all cursor-pointer">
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

                        {activeTab === 'appearance' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-serif text-black uppercase tracking-wide">Visual Aesthetics</h2>
                                    <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Interface themes and workspace preferences</p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <button className="p-8 border-2 border-black rounded-sm text-left group">
                                        <div className="w-12 h-1 bg-black mb-3"></div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-black">Archival Light</div>
                                        <p className="text-[9px] text-zinc-400 mt-2">Standard curatorial workspace. High contrast, serif-focused.</p>
                                    </button>
                                    <button className="p-8 border border-zinc-100 rounded-sm text-left group opacity-40 hover:opacity-100 transition-opacity">
                                        <div className="w-12 h-1 bg-zinc-800 mb-3"></div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Vault Obsidian</div>
                                        <p className="text-[9px] text-zinc-400 mt-2">Experimental dark mode. Low eye-strain, deep contrast.</p>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <Modal 
                {...modal} 
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
}
