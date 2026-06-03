import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowRight, ShieldCheck, XCircle } from 'lucide-react';

export default function SetupAccount() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '' });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const navigate = useNavigate();

    const triggerShake = () => {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        // Client-side Constraint Validation
        if (!formData.username.trim()) {
            triggerShake();
            return setStatus({ type: 'error', message: 'Please provide a username.' });
        }

        if (formData.password.length < 8) {
            triggerShake();
            return setStatus({ type: 'error', message: 'Password must be at least 8 characters.' });
        }

        if (formData.password !== formData.confirmPassword) {
            triggerShake();
            return setStatus({ type: 'error', message: 'Passwords do not match.' });
        }

        setIsSubmitting(true);

        try {
            const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
            const res = await fetch(`${baseURL}/api/v1/user/setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    token, 
                    username: formData.username.trim(), 
                    password: formData.password 
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Failed to setup account.');
            
            setStatus({ type: 'success', message: "Account successfully created! Redirecting to login..." });
            setTimeout(() => navigate('/login'), 2500);
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
            triggerShake();
        } finally {
            setIsSubmitting(false);
        }
    };

    // Shared Sidebar Component
    const Sidebar = () => (
        <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-950 items-center justify-center overflow-hidden border-r border-zinc-900">
            <div className="absolute inset-0 bg-black/40 z-10"></div>
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-600 via-zinc-950 to-black"></div>
            <div className="z-20 flex flex-col items-start px-12 xl:px-16 max-w-xl">
                <div className="h-[2px] w-8 bg-zinc-500 rounded-full mb-6 opacity-80"></div>
                <div>
                    <h2 className="text-3xl xl:text-4xl font-serif text-white tracking-tight leading-tight">Welcome to the Archive</h2>
                    <h3 className="text-lg xl:text-xl font-light text-zinc-400 tracking-wide mt-1 mb-4">Set up your profile</h3>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-sm font-light">
                    Create your internal administrative credentials to access and manage the Museo Bulawan collections repository.
                </p>
            </div>
        </div>
    );

    // --- Invalid Token State ---
    if (!token) {
        return (
            <div className="flex min-h-screen bg-zinc-50 font-sans">
                <Sidebar />
                <div className="flex w-full lg:w-1/2 flex-col justify-center px-6 py-12 sm:px-12 md:px-16 bg-white relative">
                    <div className="mx-auto w-full max-w-sm text-center">
                        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-serif font-bold text-zinc-900 mb-2">Invalid Invitation</h2>
                        <p className="text-sm text-zinc-500 mb-8">The security invitation token is missing or malformed. Please verify the registration link or contact your system administrator.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-zinc-50 font-sans selection:bg-zinc-900 selection:text-white">
            <style>{`
                @keyframes setupShake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-4px); }
                    40%, 80% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: setupShake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
            `}</style>

            <Sidebar />

            {/* --- Right Column: Setup Form --- */}
            <div className="flex w-full lg:w-1/2 flex-col justify-center px-6 py-8 sm:px-12 md:px-16 bg-white relative">
                <div className="mx-auto w-full max-w-sm">
                    
                    {/* Brand Header */}
                    <div className="flex flex-col mb-5">
                        <div className="flex items-center gap-3 mb-1">
                            <img src="/LOGO.png" alt="Museo Bulawan" className="w-10 h-10 object-contain flex-shrink-0" />
                            <div className="flex flex-col">
                                <h1 className="text-lg font-serif font-bold leading-none text-zinc-900 tracking-tight">
                                    Museo Bulawan
                                </h1>
                                <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                                    Account Creation
                                </h2>
                            </div>
                        </div>
                    </div>

                    {/* Smooth Status Container */}
                    <div className="transition-all duration-300 ease-in-out overflow-hidden mb-3">
                        <div
                            className={`transition-all duration-300 ease-in-out overflow-hidden rounded-lg border ${
                                status.message
                                    ? `opacity-100 max-h-24 p-2.5 ${status.type === 'error' ? 'border-red-200 bg-red-50/50 text-red-700' : 'border-green-200 bg-green-50/50 text-green-700'}`
                                    : "opacity-0 max-h-0 border-transparent p-0"
                            }`}
                        >
                            <div className="flex items-start gap-2 text-xs">
                                {status.type === 'error' ? (
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                ) : (
                                    <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                )}
                                <span className="font-medium leading-normal tracking-wide flex-1">{status.message}</span>
                            </div>
                        </div>
                    </div>

                    {/* Registration Setup Form */}
                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        
                        {/* Username Input */}
                        <div className={`space-y-1 ${isShaking && !formData.username.trim() ? 'animate-shake' : ''}`}>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                Username
                            </label>
                            <input
                                type="text"
                                autoComplete="username"
                                className={`block w-full rounded-lg border px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-all shadow-sm bg-white disabled:bg-zinc-50 disabled:text-zinc-500 ${
                                    status.type === 'error' && !formData.username.trim()
                                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                                        : 'border-zinc-200 focus:border-zinc-950 focus:ring-zinc-950'
                                }`}
                                onChange={e => setFormData({...formData, username: e.target.value})}
                                value={formData.username}
                                disabled={isSubmitting || status.type === 'success'}
                                placeholder="Choose a secure username"
                            />
                        </div>

                        {/* Password Input */}
                        <div className={`space-y-1 ${isShaking && (formData.password.length < 8 || status.type === 'error') ? 'animate-shake' : ''}`}>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                Password
                            </label>
                            <input
                                type="password"
                                autoComplete="new-password"
                                className={`block w-full rounded-lg border px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-all shadow-sm bg-white disabled:bg-zinc-50 disabled:text-zinc-500 ${
                                    status.type === 'error' && (formData.password.length < 8)
                                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                                        : 'border-zinc-200 focus:border-zinc-950 focus:ring-zinc-950'
                                }`}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                                value={formData.password}
                                disabled={isSubmitting || status.type === 'success'}
                                placeholder="Min. 8 characters"
                            />
                        </div>

                        {/* Confirm Password Input */}
                        <div className={`space-y-1 ${isShaking && (formData.password !== formData.confirmPassword || status.type === 'error') ? 'animate-shake' : ''}`}>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                autoComplete="new-password"
                                className={`block w-full rounded-lg border px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-all shadow-sm bg-white disabled:bg-zinc-50 disabled:text-zinc-500 ${
                                    status.type === 'error' && (formData.password !== formData.confirmPassword)
                                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                                        : 'border-zinc-200 focus:border-zinc-950 focus:ring-zinc-950'
                                }`}
                                onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                                value={formData.confirmPassword}
                                disabled={isSubmitting || status.type === 'success'}
                                placeholder="Re-enter chosen password"
                            />
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting || status.type === 'success'}
                                className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-xs font-bold tracking-wider uppercase text-white shadow-md hover:bg-zinc-800 hover:-translate-y-[1px] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Configuring Profile
                                    </>
                                ) : (
                                    <>
                                        Complete Setup
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                    
                </div>
            </div>
        </div>
    );
}