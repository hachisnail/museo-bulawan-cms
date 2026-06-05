import { useState } from 'react';
import { useAuth } from '../context/authContext';

export default function Profile() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    return (
        <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="border-b border-zinc-200/80 pb-6">
                <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Profile Settings</h1>
                <p className="text-zinc-500 text-sm mt-1 font-light">Manage your account and preferences.</p>
            </header>

            <div className="bg-white border border-zinc-200 shadow-sm p-8 rounded-md">
                <h2 className="text-xl font-bold text-zinc-900 mb-6">Personal Information</h2>
                <form className="grid grid-cols-2 gap-6" onSubmit={(e) => e.preventDefault()}>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">First Name</label>
                        <input 
                            type="text" 
                            defaultValue={user?.fname} 
                            className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 text-sm text-zinc-900 rounded-md focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 transition-colors" 
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Last Name</label>
                        <input 
                            type="text" 
                            defaultValue={user?.lname} 
                            className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 text-sm text-zinc-900 rounded-md focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 transition-colors" 
                        />
                    </div>
                    
                    {/* Locked Identity Fields */}
                    <div className="space-y-1 col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex justify-between items-center">
                            <span>Email Address</span>
                            {!isAdmin && <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-wide bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md">🔒 Locked</span>}
                        </label>
                        <input 
                            type="email" 
                            disabled={!isAdmin} 
                            defaultValue={user?.email} 
                            className={`w-full bg-zinc-50 border border-zinc-200 px-3 py-2 text-sm text-zinc-900 rounded-md transition-colors ${!isAdmin ? 'opacity-50 cursor-not-allowed bg-zinc-100/50' : 'focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20'}`} 
                        />
                        {!isAdmin && <p className="text-xs text-zinc-400 mt-1 font-light">Contact admin to change security identifiers.</p>}
                    </div>

                    <div className="col-span-2 pt-4">
                        <button className="bg-black hover:bg-zinc-800 text-white px-6 py-2.5 rounded-md font-semibold text-sm transition-all shadow-sm">Save Changes</button>
                    </div>
                </form>
            </div>

            <div className="bg-white border border-zinc-200 shadow-sm p-8 rounded-md">
                <h2 className="text-xl font-bold text-zinc-900 mb-6">Notifications</h2>
                <div className="space-y-3">
                    {['Email alerts for critical system updates', 'Real-time SSE event popups', 'Browser desktop notifications'].map((pref) => (
                        <label key={pref} className="flex items-center justify-between p-4 rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100/70 cursor-pointer transition-colors">
                            <span className="text-sm font-medium text-zinc-900">{pref}</span>
                            <input type="checkbox" defaultChecked className="w-4 h-4 text-black rounded border-zinc-300 focus:ring-black focus:ring-offset-0" />
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
}