import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { Loader2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isShaking, setIsShaking] = useState(false);

    const triggerShake = () => {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        if (!email.trim()) {
            setStatus({ type: 'error', message: 'Please provide a valid email address.' });
            triggerShake();
            return;
        }

        setIsSubmitting(true);

        try {
            const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
            const res = await fetch(`${baseURL}/api/v1/user/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            
            if (!res.ok) throw new Error(data.message || data.error || 'Failed to process request');
            
            setStatus({ type: 'success', message: data.message || 'Recovery email sent successfully.' });
            setEmail(''); 
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
            triggerShake();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-white font-sans selection:bg-zinc-900 selection:text-white">
            {/* --- CSS for Shake Animation --- */}
            <style>{`
                @keyframes recoveryShake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-4px); }
                    40%, 80% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: recoveryShake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
            `}</style>

            {/* --- Left Column: Editorial Feature (Hidden on Mobile) --- */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-950 items-center justify-center overflow-hidden border-r border-zinc-900">
                <div className="absolute inset-0 bg-black/40 z-10"></div>
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-600 via-zinc-950 to-black"></div>

                <div className="z-20 flex flex-col items-start px-12 xl:px-16 max-w-xl">
                    <div className="h-[2px] w-8 bg-zinc-500 rounded-full mb-6 opacity-80"></div>
                    <h2 className="text-3xl xl:text-4xl font-serif text-white tracking-tight leading-tight mb-2">
                        Recover Access
                    </h2>
                    <h3 className="text-lg xl:text-xl font-light text-zinc-400 tracking-wide mb-4">
                        Account Security Protocol
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed max-w-sm font-light">
                        Enter your authorized credentials to dispatch an explicit verification module and securely restore system access to registries.
                    </p>
                </div>
            </div>

            {/* --- Right Column: Recovery Form --- */}
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
                                    System Recovery
                                </h2>
                            </div>
                        </div>
                    </div>

                    {/* Smooth Status Container (Reserves real-estate to prevent content snapping) */}
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

                    {/* Recovery Form */}
                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        <div className={`space-y-1 ${isShaking && status.type === 'error' ? 'animate-shake' : ''}`}>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                Email Address
                            </label>
                            <input
                                type="email"
                                autoComplete="email"
                                className={`block w-full rounded-lg border px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-all shadow-sm bg-white disabled:bg-zinc-50 disabled:text-zinc-500 ${
                                    status.type === 'error'
                                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                                        : 'border-zinc-200 focus:border-zinc-950 focus:ring-zinc-950'
                                }`}
                                placeholder="name@domain.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)} 
                                disabled={isSubmitting || status.type === 'success'}
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting || status.type === 'success' || email.length === 0}
                                className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-xs font-bold tracking-wider uppercase text-white shadow-md hover:bg-zinc-800 hover:-translate-y-[1px] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Verifying
                                    </>
                                ) : (
                                    <>
                                        Send Reset Link
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Back to Login Dashboard */}
                    <div className="mt-6 text-center border-t border-zinc-100 pt-5">
                        <Link 
                            to="/login" 
                            className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-950 transition-colors"
                        >
                            Return to Login
                        </Link>
                    </div>

                </div>
            </div>
            
        </div>
    );
}