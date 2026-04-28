import { useState } from 'react';
import { useAuth } from '../context/authContext';

export default function Profile() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    return (
        <div className="max-w-4xl space-y-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold mb-6">Personal Information</h2>
                <form className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400">First Name</label>
                        <input type="text" defaultValue={user?.fname} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400">Last Name</label>
                        <input type="text" defaultValue={user?.lname} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" />
                    </div>
                    
                    {/* Locked Identity Fields */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400 flex justify-between">
                            Email Address {!isAdmin && <span className="text-[10px] text-orange-500 uppercase">🔒 Locked</span>}
                        </label>
                        <input 
                            type="email" 
                            disabled={!isAdmin} 
                            defaultValue={user?.email} 
                            className={`w-full border p-2 rounded ${!isAdmin ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500'}`} 
                        />
                        {!isAdmin && <p className="text-[10px] text-gray-400">Contact admin to change security identifiers.</p>}
                    </div>

                    <div className="col-span-2 pt-4">
                        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium">Save Changes</button>
                    </div>
                </form>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold mb-6">Notifications</h2>
                <div className="space-y-4">
                    {['Email alerts for critical system updates', 'Real-time SSE event popups', 'Browser desktop notifications'].map((pref) => (
                        <label key={pref} className="flex items-center justify-between p-3 rounded-lg border border-gray-50 hover:bg-gray-50 cursor-pointer">
                            <span className="text-sm text-gray-600">{pref}</span>
                            <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
}