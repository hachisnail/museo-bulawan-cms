import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
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

        // Custom Validation Rules
        if (!formData.newPassword || !formData.confirmPassword) {
            setStatus({ type: 'error', message: 'Please complete both password fields.' });
            triggerShake();
            return;
        }

        if (formData.newPassword.length < 8) {
            setStatus({ type: 'error', message: 'Password must be at least 8 characters long.' });
            triggerShake();
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setStatus({ type: 'error', message: 'Passwords do not match.' });
            triggerShake();
            return;
        }

        setIsSubmitting(true);

        try {
            const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
            const res = await fetch(`${baseURL}/api/v1/user/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: formData.newPassword })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Failed to securely update password.');
            
            setStatus({ type: 'success', message: "Password updated successfully. Redirecting terminal..." });
            setTimeout(() => navigate('/login'), 2200);
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
            triggerShake();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-white font-sans selection:bg-zinc-900 selection:text-white">
            {/* --- Inline CSS for Shake Animation --- */}
            <style>{`
                @keyframes loginShake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-4px); }
                    40%, 80% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: loginShake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
            `}</style>

            {/* --- Left Column: Institutional Branding (Hidden on Mobile) --- */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-950 items-center justify-center p-12 overflow-hidden border-r border-zinc-900">
                <div className="absolute inset-0 bg-black/40 z-10"></div>
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-700 via-zinc-950 to-black"></div>

                <div className="z-20 w-full max-w-md space-y-4">
                    <div className="h-[2px] w-8 bg-zinc-400 rounded-full"></div>
                    <div>
                        <h2 className="text-3xl font-serif text-white tracking-tight leading-tight">
                            Museo Bulawan
                        </h2>
                        <h3 className="text-sm font-semibold text-zinc-400 tracking-wider uppercase mt-1">
                            Credential Override Terminal
                        </h3>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed font-light">
                        Protected system parameter change suite. Access logging protocols apply to all structural cryptography key alterations.
                    </p>
                </div>
            </div>

            {/* --- Right Column: Form Container Area --- */}
            <div className="flex w-full lg:w-1/2 flex-col justify-center px-6 py-8 sm:px-12 md:px-16 bg-white relative">
                <div className="mx-auto w-full max-w-sm">
                    
                    {/* Brand Header */}
                    <div className="flex flex-col mb-5">
                        <div className="flex items-center gap-3 mb-1">
                            <img src="/LOGO.png" alt="Museo Bulawan" className="w-10 h-10 object-contain flex-shrink-0" />
                            <div className="flex flex-col justify-center">
                                <h1 className="text-lg font-serif font-bold leading-none text-zinc-900 tracking-tight">
                                    Terminal Security
                                </h1>
                                <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                                    Authentication Override
                                </h2>
                            </div>
                        </div>
                    </div>

                    {/* Smooth Error/Success Container (Prevents snapping) */}
                    <div className="min-h-[44px] mb-3 flex flex-col justify-end">
                        <div
                            className={`transition-all duration-300 ease-in-out overflow-hidden rounded-lg border ${
                                status.message
                                    ? `opacity-100 max-h-24 p-2.5 ${
                                        status.type === 'error' 
                                            ? 'border-red-200 bg-red-50/50 text-red-700' 
                                            : 'border-green-200 bg-green-50/50 text-green-700'
                                      }`
                                    : "opacity-0 max-h-0 border-transparent p-0"
                            }`}
                        >
                            <div className="flex items-start gap-2 text-xs">
                                {status.type === 'error' ? (
                                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                )}
                                <span className="font-medium leading-tight tracking-wide flex-1">{status.message}</span>
                            </div>
                        </div>
                    </div>

                    {/* Error Handling State: Token Mismatch fallback layout */}
                    {!token ? (
                        <div className="space-y-4 text-left animate-in fade-in duration-200">
                            <p className="text-sm text-zinc-500 font-light leading-relaxed">
                                Security handshake aborted. No valid cryptokey verification link parsed from server query headers.
                            </p>
                            <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                                <Link
                                    to="/forgot-password"
                                    className="text-[11px] font-bold uppercase tracking-widest text-zinc-950 hover:underline"
                                >
                                    Re-issue Link
                                </Link>
                                <Link
                                    to="/login"
                                    className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 hover:text-black transition-colors"
                                >
                                    Return to Login
                                </Link>
                            </div>
                        </div>
                    ) : (
                        /* Main Password Reset Form */
                        <form onSubmit={handleSubmit} noValidate className="space-y-4">
                            <div className={`space-y-1 ${isShaking && (!formData.newPassword || status.type === 'error') ? 'animate-shake' : ''}`}>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    className={`block w-full rounded-lg border px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-all shadow-sm bg-white disabled:bg-zinc-50 disabled:text-zinc-500 ${
                                        (status.type === 'error' && (!formData.newPassword || formData.newPassword.length < 8 || formData.newPassword !== formData.confirmPassword))
                                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                                            : 'border-zinc-200 focus:border-zinc-950 focus:ring-zinc-950'
                                    }`}
                                    onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                                    value={formData.newPassword}
                                    disabled={isSubmitting || status.type === 'success'}
                                    placeholder="Minimum 8 characters"
                                />
                            </div>

                            <div className={`space-y-1 ${isShaking && (!formData.confirmPassword || status.type === 'error') ? 'animate-shake' : ''}`}>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                    Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    className={`block w-full rounded-lg border px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-all shadow-sm bg-white disabled:bg-zinc-50 disabled:text-zinc-500 ${
                                        (status.type === 'error' && (!formData.confirmPassword || formData.newPassword !== formData.confirmPassword))
                                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                                            : 'border-zinc-200 focus:border-zinc-950 focus:ring-zinc-950'
                                    }`}
                                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    value={formData.confirmPassword}
                                    disabled={isSubmitting || status.type === 'success'}
                                    placeholder="Re-enter password"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || status.type === 'success'}
                                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-[10px] font-bold tracking-widest uppercase text-white shadow-md hover:bg-zinc-800 hover:-translate-y-[1px] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Updating Key
                                        </>
                                    ) : (
                                        <>
                                            Commit Alteration
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                    
                </div>
            </div>
        </div>
    );
}