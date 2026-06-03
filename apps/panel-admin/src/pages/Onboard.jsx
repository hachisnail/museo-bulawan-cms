import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Onboard() {
    const [formData, setFormData] = useState({ fname: '', lname: '', email: '', username: '', password: '', confirmPassword: '' });
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const navigate = useNavigate();

    const triggerShake = () => {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        // Client-side Validation Checks
        if (!formData.fname.trim() || !formData.lname.trim() || !formData.email.trim() || !formData.username.trim()) {
            setMessage('Please provide all required profile fields.');
            triggerShake();
            return;
        }

        if (formData.password.length < 8) {
            setMessage('Password must be at least 8 characters long.');
            triggerShake();
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setMessage('Passwords do not match.');
            triggerShake();
            return;
        }

        setIsLoading(true);
        const { confirmPassword, ...apiData } = formData;

        try {
            const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
            const res = await fetch(`${baseURL}/api/v1/user/onboard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiData)
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Initialization failed.');
            
            setIsSuccess(true);
            setMessage("System initialized successfully! Redirecting to login...");
            setTimeout(() => navigate('/login'), 2200);
        } catch (err) {
            setIsSuccess(false);
            setMessage(err.message);
            triggerShake();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-white font-sans selection:bg-zinc-900 selection:text-white">
            {/* --- Inline CSS for Shake Animation --- */}
            <style>{`
                @keyframes onboardShake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-4px); }
                    40%, 80% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: onboardShake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
            `}</style>

            {/* --- Left Column: Institutional Branding (Hidden on Mobile) --- */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-950 items-center justify-center overflow-hidden border-r border-zinc-900">
                <div className="absolute inset-0 bg-black/40 z-10"></div>
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-600 via-zinc-950 to-black"></div>

                <div className="z-20 flex flex-col items-start px-12 xl:px-16 max-w-xl">
                    <div className="h-[2px] w-8 bg-zinc-500 rounded-full mb-6 opacity-80"></div>
                    <h2 className="text-3xl xl:text-4xl font-serif text-white tracking-tight leading-tight mb-2">
                        System Initialization
                    </h2>
                    <h3 className="text-lg xl:text-xl font-light text-zinc-400 tracking-wide mb-4">
                        Master Core Infrastructure
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed max-w-sm font-light">
                        Initialize the primary root administrative controller for the Museo Bulawan content management system terminal database.
                    </p>
                </div>
            </div>

            {/* --- Right Column: Onboarding Form Terminal --- */}
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
                                    Master Root Creation
                                </h2>
                            </div>
                        </div>
                    </div>

                    {/* Smooth Status Container (Prevents Layout Jumps) */}
                    <div className="transition-all duration-300 ease-in-out overflow-hidden mb-3">
                        <div
                            className={`transition-all duration-300 ease-in-out overflow-hidden rounded-lg border ${
                                message
                                    ? `opacity-100 max-h-24 p-2.5 ${isSuccess ? 'border-green-200 bg-green-50/50 text-green-700' : 'border-red-200 bg-red-50/50 text-red-700'}`
                                    : "opacity-0 max-h-0 border-transparent p-0"
                            }`}
                        >
                            <div className="flex items-start gap-2 text-xs">
                                {isSuccess ? (
                                    <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                )}
                                <span className="font-medium leading-normal tracking-wide flex-1">{message}</span>
                            </div>
                        </div>
                    </div>

                    {/* Onboarding Form */}
                    <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
                        {/* First Name & Last Name (Side by Side Row) */}
                        <div className="flex gap-3">
                            <div className="w-1/2 space-y-1">
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">First Name</label>
                                <input
                                    type="text"
                                    className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white disabled:bg-zinc-50"
                                    onChange={e => setFormData({...formData, fname: e.target.value})}
                                    value={formData.fname}
                                    disabled={isLoading || isSuccess}
                                    placeholder="Jane"
                                />
                            </div>
                            <div className="w-1/2 space-y-1">
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Last Name</label>
                                <input
                                    type="text"
                                    className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white disabled:bg-zinc-50"
                                    onChange={e => setFormData({...formData, lname: e.target.value})}
                                    value={formData.lname}
                                    disabled={isLoading || isSuccess}
                                    placeholder="Doe"
                                />
                            </div>
                        </div>

                        {/* Email Field */}
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Email Address</label>
                            <input
                                type="email"
                                className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white disabled:bg-zinc-50"
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                value={formData.email}
                                disabled={isLoading || isSuccess}
                                placeholder="admin@museobulawan.gov"
                            />
                        </div>

                        {/* Username Field */}
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Username</label>
                            <input
                                type="text"
                                autoComplete="username"
                                className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition-all shadow-sm bg-white disabled:bg-zinc-50"
                                onChange={e => setFormData({...formData, username: e.target.value})}
                                value={formData.username}
                                disabled={isLoading || isSuccess}
                                placeholder="Choose username"
                            />
                        </div>

                        {/* Password Field */}
                        <div className={`space-y-1 ${isShaking && (formData.password.length < 8 || !isSuccess && message) ? 'animate-shake' : ''}`}>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Password</label>
                            <input
                                type="password"
                                autoComplete="new-password"
                                className={`block w-full rounded-lg border px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-all shadow-sm bg-white disabled:bg-zinc-50 ${
                                    !isSuccess && message && (formData.password.length < 8 || formData.password !== formData.confirmPassword)
                                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                                        : 'border-zinc-200 focus:border-zinc-950 focus:ring-zinc-950'
                                }`}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                                value={formData.password}
                                disabled={isLoading || isSuccess}
                                placeholder="Min. 8 characters"
                            />
                        </div>

                        {/* Confirm Password Field */}
                        <div className={`space-y-1 ${isShaking && (formData.password !== formData.confirmPassword || !isSuccess && message) ? 'animate-shake' : ''}`}>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Confirm Password</label>
                            <input
                                type="password"
                                autoComplete="new-password"
                                className={`block w-full rounded-lg border px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-all shadow-sm bg-white disabled:bg-zinc-50 ${
                                    !isSuccess && message && (formData.password !== formData.confirmPassword)
                                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                                        : 'border-zinc-200 focus:border-zinc-950 focus:ring-zinc-950'
                                }`}
                                onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                                value={formData.confirmPassword}
                                disabled={isLoading || isSuccess}
                                placeholder="Re-enter chosen password"
                            />
                        </div>

                        {/* Submit Actions */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading || isSuccess}
                                className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-xs font-bold tracking-wider uppercase text-white shadow-md hover:bg-zinc-800 hover:-translate-y-[1px] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Initializing Core
                                    </>
                                ) : (
                                    <>
                                        Complete Initialization
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