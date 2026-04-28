import { useState, useEffect } from 'react';

export default function Management() {
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);

    // Logic for fetching users would go here
    // Logic for promoting/demoting would hit your future user management endpoints

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Access Management</h1>
                {activeTab === 'invites' && (
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                        + Invite New User
                    </button>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-4 border-b border-gray-200">
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`pb-2 px-1 transition-all ${activeTab === 'users' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500'}`}
                >
                    Active Directory
                </button>
                <button 
                    onClick={() => setActiveTab('invites')}
                    className={`pb-2 px-1 transition-all ${activeTab === 'invites' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500'}`}
                >
                    Pending Invites
                </button>
            </div>

            {/* Table Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-400 font-semibold">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {/* Example Row */}
                        <tr className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="font-medium">John Doe</div>
                                <div className="text-xs text-gray-400">john@museum.com</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Admin</span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Active
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button className="text-gray-400 hover:text-blue-600">⋮</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}