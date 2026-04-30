import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Field, Label, Input, Button } from '@headlessui/react';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus({ type: '', message: '' });

        try {
            const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
            const res = await fetch(`${baseURL}/api/v1/user/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Failed to process request');
            
            setStatus({ type: 'success', message: data.message || 'Recovery email sent successfully.' });
            setEmail(''); // Clear the form on success
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-white">
            
            {/* --- Left Column: Editorial Feature (Hidden on Mobile) --- */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-950 items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-zinc-900 opacity-80 mix-blend-multiply"></div>
                
                <div className="z-10 flex flex-col items-start px-16 max-w-lg">
                    <div className="h-1 w-12 bg-[#D4AF37] mb-6"></div>
                    <h2 className="text-4xl font-serif text-white leading-tight">
                        Recovering access.<br/>
                        <span className="text-[#D4AF37]">Protecting the archive.</span>
                    </h2>
                    <p className="mt-4 text-sm text-zinc-400 font-light leading-relaxed">
                        Enter your registered curator email address to receive a secure, time-sensitive link to reset your system credentials.
                    </p>
                </div>
            </div>

            {/* --- Right Column: Recovery Form --- */}
            <div className="flex w-full lg:w-1/2 flex-col justify-center px-8 py-12 sm:px-16 md:px-24">
                <div className="mx-auto w-full max-w-sm">
                    
                    {/* Brand Header */}
                    <div className="flex flex-col mb-8">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="flex h-10 w-10 items-center justify-center bg-black rounded-sm shadow-sm border border-zinc-800">
                                <svg className="h-6 w-6 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13h-13L12 6.5z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-serif tracking-widest text-black uppercase">
                                System Recovery
                            </h1>
                        </div>
                        <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em] ml-[3.25rem]">
                            Password Reset Request
                        </h2>
                    </div>

                    {/* Status Message */}
                    {status.message && (
                        <div className={`mb-6 text-sm py-3 px-4 rounded-sm border ${status.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-[#D4AF37]/10 text-[#A68A27] border-[#D4AF37]/30'}`}>
                            {status.message}
                        </div>
                    )}

                    {/* Recovery Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Field>
                            <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-1">
                                Email Address
                            </Label>
                            <Input 
                                type="email" 
                                className="block w-full rounded-sm border border-zinc-300 px-4 py-2.5 text-black placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all sm:text-sm bg-white"
                                placeholder="name@museobulawan.gov"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)} 
                            />
                        </Field>

                        <div className="pt-2">
                            <Button 
                                type="submit" 
                                disabled={isSubmitting || email.length === 0}
                                className="w-full rounded-sm bg-black px-4 py-3 text-sm font-bold tracking-widest uppercase text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 transition-all data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Verifying...' : 'Send Reset Link'}
                            </Button>
                        </div>
                    </form>

                    {/* Back to Login */}
                    <div className="mt-8 text-center border-t border-zinc-200 pt-6">
                        <Link 
                            to="/login" 
                            className="text-xs font-semibold tracking-wider text-zinc-500 hover:text-black uppercase transition-colors"
                        >
                            ← Return to Login
                        </Link>
                    </div>

                </div>
            </div>
            
        </div>
    );
}