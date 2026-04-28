import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus({ type: '', message: '' });

        try {
            const baseURL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL;
            const res = await fetch(`${baseURL}/api/v1/user/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Failed to process request');
            
            setStatus({ type: 'success', message: data.message });
            setEmail(''); // Clear the form on success
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
                <h2 className="mb-2 text-2xl font-bold text-center text-gray-800">Reset Password</h2>
                <p className="mb-6 text-sm text-center text-gray-500">
                    Enter your email address and we'll send you a link to reset your password.
                </p>

                {status.message && (
                    <div className={`mb-4 rounded p-3 text-sm ${status.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {status.message}
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input 
                        type="email" 
                        placeholder="Enter your email" 
                        required
                        value={email}
                        className="w-full rounded border p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        onChange={(e) => setEmail(e.target.value)} 
                    />
                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>

                <div className="mt-4 text-center text-sm">
                    <Link to="/login" className="text-gray-600 hover:underline">Back to Login</Link>
                </div>
            </div>
        </div>
    );
}