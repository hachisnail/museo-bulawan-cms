import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Field, Label, Input, Description, Button } from '@headlessui/react';

export default function SetupAccount() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '' });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    // Client-side validation
    const isLengthValid = formData.password.length >= 8;
    const passwordsMatch = formData.password === formData.confirmPassword;
    const canSubmit = formData.username.trim().length > 0 && formData.password.length > 0 && isLengthValid && passwordsMatch;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        if (!canSubmit) return;
        setIsSubmitting(true);

        try {
            const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
            const res = await fetch(`${baseURL}/api/v1/user/setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    token, 
                    username: formData.username, 
                    password: formData.password 
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Failed to setup account.');
            setStatus({ type: 'success', message: "Account successfully created. Redirecting to login..." });
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
                    <h2 className="text-xl font-serif tracking-widest text-black uppercase mb-2">Invalid Invitation</h2>
                    <p className="text-sm text-zinc-500 mb-6">Security token is missing or malformed. Please use the exact link provided in your invitation email.</p>
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
                        Welcome to the archive.<br/>
                        <span className="text-[#D4AF37]">Set up your profile.</span>
                    </h2>
                    <p className="mt-4 text-sm text-zinc-400 font-light leading-relaxed">
                        Create your username and password to establish your access to the Museo Bulawan collection management system.
                    </p>
                </div>
            </div>

            {/* Right Column: Setup Form */}
            <div className="flex w-full lg:w-1/2 flex-col justify-center px-8 py-12 sm:px-16 md:px-24">
                <div className="mx-auto w-full max-w-sm">
                    
                    {/* Brand Header */}
                    <div className="flex flex-col mb-10">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="flex h-10 w-10 items-center justify-center bg-black rounded-sm shadow-sm border border-zinc-800">
                                <svg className="h-6 w-6 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-serif tracking-widest text-black uppercase">
                                Account Setup
                            </h1>
                        </div>
                        <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em] ml-[3.25rem]">
                            Create Credentials
                        </h2>
                    </div>

                    {/* Status Message */}
                    {status.message && (
                        <div className={`mb-6 text-sm py-3 px-4 rounded-sm border ${status.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-[#D4AF37]/10 text-[#A68A27] border-[#D4AF37]/30'}`}>
                            {status.message}
                        </div>
                    )}

                    {/* Setup Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <Field>
                                <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-1">
                                    Username
                                </Label>
                                <Input 
                                    type="text" 
                                    className="block w-full rounded-sm border border-zinc-300 px-4 py-2.5 text-black placeholder:text-zinc-400 outline-none transition-all sm:text-sm bg-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                                    onChange={e => setFormData({...formData, username: e.target.value})} 
                                    required
                                />
                            </Field>

                            <Field>
                                <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-1">
                                    Password
                                </Label>
                                <Input 
                                    type="password" 
                                    className={`block w-full rounded-sm border px-4 py-2.5 text-black placeholder:text-zinc-400 outline-none transition-all sm:text-sm bg-white ${
                                        formData.password && !isLengthValid 
                                            ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' 
                                            : 'border-zinc-300 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]'
                                    }`}
                                    onChange={e => setFormData({...formData, password: e.target.value})} 
                                    required
                                />
                                {formData.password && !isLengthValid && (
                                    <Description className="mt-1.5 text-xs text-red-600 font-medium">
                                        Password must be at least 8 characters long.
                                    </Description>
                                )}
                            </Field>

                            <Field>
                                <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-1">
                                    Confirm Password
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
                                {isSubmitting ? 'Setting up...' : 'Complete Setup'}
                            </Button>
                        </div>
                    </form>

                </div>
            </div>
            
        </div>
    );
}