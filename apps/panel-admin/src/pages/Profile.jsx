import { useState } from 'react';
import { useAuth } from '../context/authContext';

export default function Profile() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    return (
        <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
                <p className="text-[var(--text-secondary)] mt-1">Manage your account and preferences.</p>
            </header>

            <div className="glass-panel p-8 rounded-2xl">
                <h2 className="text-xl font-semibold mb-6">Personal Information</h2>
                <form className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-[var(--text-secondary)]">First Name</label>
                        <input type="text" defaultValue={user?.fname} className="w-full bg-[var(--color-glass)] border border-[var(--color-glass-border)] p-2.5 rounded-lg focus:outline-none focus:border-[var(--color-brand-500)] text-white transition-colors" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-[var(--text-secondary)]">Last Name</label>
                        <input type="text" defaultValue={user?.lname} className="w-full bg-[var(--color-glass)] border border-[var(--color-glass-border)] p-2.5 rounded-lg focus:outline-none focus:border-[var(--color-brand-500)] text-white transition-colors" />
                    </div>
                    
                    {/* Locked Identity Fields */}
                    <div className="space-y-1 col-span-2">
                        <label className="text-sm font-medium text-[var(--text-secondary)] flex justify-between">
                            Email Address {!isAdmin && <span className="text-[10px] text-orange-400 uppercase tracking-wide bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">🔒 Locked</span>}
                        </label>
                        <input 
                            type="email" 
                            disabled={!isAdmin} 
                            defaultValue={user?.email} 
                            className={`w-full bg-[var(--color-glass)] border border-[var(--color-glass-border)] p-2.5 rounded-lg text-white transition-colors ${!isAdmin ? 'opacity-50 cursor-not-allowed' : 'focus:outline-none focus:border-[var(--color-brand-500)]'}`} 
                        />
                        {!isAdmin && <p className="text-xs text-[var(--text-secondary)] mt-1">Contact admin to change security identifiers.</p>}
                    </div>

                    <div className="col-span-2 pt-4">
                        <button className="bg-[var(--color-brand-600)] hover:bg-[var(--color-brand-500)] text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all">Save Changes</button>
                    </div>
                </form>
            </div>

            <div className="glass-panel p-8 rounded-2xl">
                <h2 className="text-xl font-semibold mb-6">Notifications</h2>
                <div className="space-y-3">
                    {['Email alerts for critical system updates', 'Real-time SSE event popups', 'Browser desktop notifications'].map((pref) => (
                        <label key={pref} className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] hover:bg-white/5 cursor-pointer transition-colors">
                            <span className="text-sm text-white">{pref}</span>
                            <input type="checkbox" defaultChecked className="w-4 h-4 text-[var(--color-brand-500)] rounded bg-transparent border-[var(--color-glass-border)] focus:ring-[var(--color-brand-500)] focus:ring-offset-0 focus:ring-offset-transparent" />
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
}