// apps/panel-admin/src/pages/NotFound.jsx
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 selection:bg-indigo-500/30">
            <div className="max-w-md w-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-24 h-24 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto shadow-sm border border-red-100">
                    <ShieldAlert className="w-12 h-12" />
                </div>
                
                <div className="space-y-2">
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">404</h1>
                    <h2 className="text-xl font-bold text-gray-700">Page Not Found</h2>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        The registry pathway you are trying to access does not exist or you do not have the required curatorial permissions.
                    </p>
                </div>

                <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button 
                        onClick={() => navigate(-1)}
                        className="w-full sm:w-auto px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Go Back
                    </button>
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="w-full sm:w-auto px-6 py-2.5 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                    >
                        <Home className="w-4 h-4" /> Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}