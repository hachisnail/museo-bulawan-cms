import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Field, Label, Input, Description, Button } from '@headlessui/react';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    // Client-side validation
    const isLengthValid = formData.newPassword.length >= 8;
    const passwordsMatch = formData.newPassword === formData.confirmPassword;
    const canSubmit = formData.newPassword.length > 0 && isLengthValid && passwordsMatch;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        if (!canSubmit) return;
        setIsSubmitting(true);

        try {
            const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
            const res = await fetch(`${baseURL}/api/v1/user/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: formData.newPassword })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reset password.');
            
            setStatus({ type: 'success', message: "Access restored. Redirecting to login..." });
            setTimeout(() => navigate('/login'), 2500);
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Fallback View for Missing Token ---
    if (!token) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
                <div className="w-full max-w-sm rounded-sm bg-white p-8 shadow-sm border border-zinc-200 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center bg-black rounded-sm mb-4">
                        <svg className="h-6 w-6 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-serif tracking-widest text-black uppercase mb-2">Invalid Request</h2>
                    <p className="text-sm text-zinc-500 mb-6">Security token is missing or malformed. Please use the exact link provided in your authorization email.</p>
                    <Link 
                        to="/forgot-password" 
                        className="inline-flex w-full justify-center rounded-sm bg-black px-4 py-3 text-sm font-bold tracking-widest uppercase text-white hover:bg-zinc-800 transition-colors"
                    >
                        Request New Link
                    </Link>
                </div>
            </div>
        );
    }

    // --- Main View ---
    return (
        <div className="flex min-h-screen bg-white">
            
            {/* Left Column: Editorial Feature */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-950 items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-zinc-900 opacity-80 mix-blend-multiply"></div>
                <div className="z-10 flex flex-col items-start px-16 max-w-lg">
                    <div className="h-1 w-12 bg-[#D4AF37] mb-6"></div>
                    <h2 className="text-4xl font-serif text-white leading-tight">
                        Restoring access.<br/>
                        <span className="text-[#D4AF37]">Securing the archive.</span>
                    </h2>
                    <p className="mt-4 text-sm text-zinc-400 font-light leading-relaxed">
                        Establish a new secure passcode for your Museo Bulawan curator account to regain access to the collection management system.
                    </p>
                </div>
            </div>

            {/* Right Column: Reset Form */}
            <div className="flex w-full lg:w-1/2 flex-col justify-center px-8 py-12 sm:px-16 md:px-24">
                <div className="mx-auto w-full max-w-sm">
                    
                    {/* Brand Header */}
                    <div className="flex flex-col mb-10">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="flex h-10 w-10 items-center justify-center bg-black rounded-sm shadow-sm border border-zinc-800">
                                <svg className="h-6 w-6 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13h-13L12 6.5z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-serif tracking-widest text-black uppercase">
                                System Reset
                            </h1>
                        </div>
                        <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em] ml-[3.25rem]">
                            Create New Password
                        </h2>
                    </div>

                    {/* Status Message */}
                    {status.message && (
                        <div className={`mb-6 text-sm py-3 px-4 rounded-sm border ${status.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-[#D4AF37]/10 text-[#A68A27] border-[#D4AF37]/30'}`}>
                            {status.message}
                        </div>
                    )}

                    {/* Reset Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <Field>
                                <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-1">
                                    New Password
                                </Label>
                                <Input 
                                    type="password" 
                                    className={`block w-full rounded-sm border px-4 py-2.5 text-black placeholder:text-zinc-400 outline-none transition-all sm:text-sm bg-white ${
                                        formData.newPassword && !isLengthValid 
                                            ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' 
                                            : 'border-zinc-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]'
                                    }`}
                                    onChange={e => setFormData({...formData, newPassword: e.target.value})} 
                                    required
                                />
                                {formData.newPassword && !isLengthValid && (
                                    <Description className="mt-1.5 text-xs text-red-600 font-medium">
                                        Password must be at least 8 characters long.
                                    </Description>
                                )}
                            </Field>

                            <Field>
                                <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-1">
                                    Confirm New Password
                                </Label>
                                <Input 
                                    type="password" 
                                    className={`block w-full rounded-sm border px-4 py-2.5 text-black placeholder:text-zinc-400 outline-none transition-all sm:text-sm bg-white ${
                                        formData.confirmPassword && !passwordsMatch 
                                            ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' 
                                            : 'border-zinc-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]'
                                    }`}
                                    onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
                                    required
                                />
                                {formData.confirmPassword && !passwordsMatch && (
                                    <Description className="mt-1.5 text-xs text-red-600 font-medium">
                                        Passwords do not match.
                                    </Description>
                                )}
                            </Field>
                        </div>

                        <div className="pt-2">
                            <Button 
                                type="submit" 
                                disabled={!canSubmit || isSubmitting || status.type === 'success'}
                                className="w-full rounded-sm bg-black px-4 py-3 text-sm font-bold tracking-widest uppercase text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 transition-all data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Updating System...' : 'Save New Password'}
                            </Button>
                        </div>
                    </form>

                </div>
            </div>
            
        </div>
    );
}