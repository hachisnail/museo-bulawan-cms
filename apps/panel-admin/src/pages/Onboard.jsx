import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, Label, Input, Description, Button } from '@headlessui/react';

export default function Onboard() {
    const [formData, setFormData] = useState({ fname: '', lname: '', email: '', username: '', password: '', confirmPassword: '' });
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const navigate = useNavigate();

    // Validation check
    const passwordsMatch = formData.password === formData.confirmPassword;
    const canSubmit = formData.password.length > 0 && passwordsMatch;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        if (!canSubmit) return;

        // Strip confirmPassword before sending to API
        const { confirmPassword, ...apiData } = formData;

        try {
            const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
            const res = await fetch(`${baseURL}/api/v1/user/onboard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiData)
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Initialization failed.');
            
            setIsSuccess(true);
            setMessage("System initialized! Redirecting to login...");
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setIsSuccess(false);
            setMessage(err.message);
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
                        Establishing the archive.<br/>
                        <span className="text-[#D4AF37]">Securing the collection.</span>
                    </h2>
                    <p className="mt-4 text-sm text-zinc-400 font-light leading-relaxed">
                        Initialize the master administrative account for the Museo Bulawan collection management system. This account will have full access to database configurations and curator roles.
                    </p>
                </div>
            </div>

            {/* --- Right Column: Onboarding Form --- */}
            <div className="flex w-full lg:w-1/2 flex-col justify-center px-8 py-12 sm:px-16 md:px-24">
                <div className="mx-auto w-full max-w-md">
                    
                    {/* Brand Header */}
                    <div className="flex flex-col mb-8">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="flex h-10 w-10 items-center justify-center bg-black rounded-sm shadow-sm border border-zinc-800">
                                <svg className="h-6 w-6 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13h-13L12 6.5z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-serif tracking-widest text-black uppercase">
                                System Init
                            </h1>
                        </div>
                        <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em] ml-[3.25rem]">
                            Master Admin Creation
                        </h2>
                    </div>

                    {/* System Message */}
                    {message && (
                        <div className={`mb-6 text-sm py-3 px-4 rounded-sm border ${isSuccess ? 'bg-[#D4AF37]/10 text-[#A68A27] border-[#D4AF37]/30' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {message}
                        </div>
                    )}

                    {/* Initialization Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Field className="w-full">
                                <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-1">
                                    First Name
                                </Label>
                                <Input 
                                    type="text" 
                                    className="block w-full rounded-sm border border-zinc-300 px-4 py-2.5 text-black placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all sm:text-sm bg-white"
                                    onChange={e => setFormData({...formData, fname: e.target.value})} 
                                    required
                                />
                            </Field>
                            <Field className="w-full">
                                <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-1">
                                    Last Name
                                </Label>
                                <Input 
                                    type="text" 
                                    className="block w-full rounded-sm border border-zinc-300 px-4 py-2.5 text-black placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all sm:text-sm bg-white"
                                    onChange={e => setFormData({...formData, lname: e.target.value})} 
                                    required
                                />
                            </Field>
                        </div>

                        <Field>
                            <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-1">
                                Email Address
                            </Label>
                            <Input 
                                type="email" 
                                className="block w-full rounded-sm border border-zinc-300 px-4 py-2.5 text-black placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all sm:text-sm bg-white"
                                onChange={e => setFormData({...formData, email: e.target.value})} 
                                required
                            />
                        </Field>

                        <Field>
                            <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-1">
                                Username
                            </Label>
                            <Input 
                                type="text" 
                                className="block w-full rounded-sm border border-zinc-300 px-4 py-2.5 text-black placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all sm:text-sm bg-white"
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
                                className="block w-full rounded-sm border border-zinc-300 px-4 py-2.5 text-black placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all sm:text-sm bg-white"
                                onChange={e => setFormData({...formData, password: e.target.value})} 
                                required
                            />
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

                        <div className="pt-2">
                            <Button 
                                type="submit" 
                                disabled={!canSubmit}
                                className="w-full rounded-sm bg-black px-4 py-3 text-sm font-bold tracking-widest uppercase text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 transition-all data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                            >
                                Complete Initialization
                            </Button>
                        </div>
                    </form>

                </div>
            </div>
            
        </div>
    );
}