import React from 'react';
import { Activity } from 'lucide-react';

export default function Analytics() {
    return (
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center h-full min-h-[600px] animate-in fade-in duration-500">
            <div className="bg-white p-12 rounded-xl border border-gray-200 shadow-sm text-center max-w-lg">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Activity className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mb-2">Analytics Dashboard</h1>
                <p className="text-zinc-500 text-sm leading-relaxed mb-8">
                    The Curatorial Intelligence dashboard is currently under construction. Check back later for comprehensive health metrics, valuation charts, and acquisition performance monitoring.
                </p>
                <div className="inline-block px-4 py-2 bg-gray-100 text-gray-500 text-xs font-bold uppercase tracking-widest rounded-md border border-gray-200">
                    Coming Soon
                </div>
            </div>
        </div>
    );
}
