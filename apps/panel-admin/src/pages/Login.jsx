import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { Field, Label, Input, Button } from '@headlessui/react';

export default function Login() {
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
            const res = await fetch(`${baseURL}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include' 
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed.');

            login(data.user);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
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
                        Preserving the heritage.<br/>
                        <span className="text-[#D4AF37]">Curating the Bulawan legacy.</span>
                    </h2>
                    <p className="mt-4 text-sm text-zinc-400 font-light leading-relaxed">
                        Secure access to the archival database, cultural exhibits, and collection management systems of Museo Bulawan.
                    </p>
                </div>
            </div>

            {/* --- Right Column: Login Form --- */}
            <div className="flex w-full lg:w-1/2 flex-col justify-center px-8 py-12 sm:px-16 md:px-24">
                <div className="mx-auto w-full max-w-sm">
                    
                    {/* Brand Header */}
                    <div className="flex flex-col mb-10">
                        <div className="flex items-center gap-3 mb-1">
                            {/* Museum Logo Mark */}
                            <div className="flex h-10 w-10 items-center justify-center bg-black rounded-sm shadow-sm border border-zinc-800">
                                <svg className="h-6 w-6 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13h-13L12 6.5z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-serif tracking-widest text-black uppercase">
                                Museo Bulawan
                            </h1>
                        </div>
                        <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em] ml-[3.25rem]">
                            Daet, Camarines Norte
                        </h2>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 text-sm py-3 px-4 rounded-sm border bg-red-50 text-red-700 border-red-200">
                            {error}
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <Field>
                                <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider mb-1">
                                    Username
                                </Label>
                                <Input 
                                    type="text" 
                                    className="block w-full rounded-sm border border-zinc-300 px-4 py-2.5 text-black placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all sm:text-sm bg-white"
                                    onChange={(e) => setFormData({...formData, username: e.target.value})} 
                                    required
                                />
                            </Field>

                            <Field>
                                <div className="flex items-center justify-between mb-1">
                                    <Label className="block text-xs font-medium text-zinc-700 uppercase tracking-wider">
                                        Password
                                    </Label>
                                    <Link 
                                        to="/forgot-password" 
                                        className="text-xs font-medium text-zinc-500 hover:text-[#D4AF37] transition-colors"
                                    >
                                        Forgot?
                                    </Link>
                                </div>
                                <Input 
                                    type="password" 
                                    className="block w-full rounded-sm border border-zinc-300 px-4 py-2.5 text-black placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all sm:text-sm bg-white"
                                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                                    required
                                />
                            </Field>
                        </div>

                        <div className="pt-2">
                            <Button 
                                type="submit" 
                                className="w-full rounded-sm bg-black px-4 py-3 text-sm font-bold tracking-widest uppercase text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 transition-all data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                            >
                                Access Archive
                            </Button>
                        </div>
                    </form>

                </div>
            </div>
            
        </div>
    );
}