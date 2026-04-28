import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        if (formData.newPassword !== formData.confirmPassword) {
            return setStatus({ type: 'error', message: 'Passwords do not match.' });
        }

        if (formData.newPassword.length < 8) {
            return setStatus({ type: 'error', message: 'Password must be at least 8 characters.' });
        }

        setIsSubmitting(true);

        try {
            const baseURL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL;
            const res = await fetch(`${baseURL}/api/v1/user/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: formData.newPassword })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reset password');
            
            setStatus({ type: 'success', message: "Password reset successful! Redirecting to login..." });
            setTimeout(() => navigate('/login'), 2500);
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!token) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="p-8 text-center text-red-500 bg-white shadow-md rounded-lg max-w-md">
                    <h2 className="text-xl font-bold mb-2">Invalid Request</h2>
                    <p className="mb-4 text-gray-600">No reset token provided. Please use the exact link sent to your email.</p>
                    <Link to="/forgot-password" className="text-blue-600 hover:underline">Request a new link</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
                <h2 className="mb-6 text-2xl font-bold text-center text-gray-800">Create New Password</h2>
                
                {status.message && (
                    <div className={`mb-4 rounded p-3 text-sm ${status.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {status.message}
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input 
                        type="password" 
                        placeholder="New Password (min. 8 characters)" 
                        required 
                        className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                        onChange={e => setFormData({...formData, newPassword: e.target.value})} 
                    />
                    <input 
                        type="password" 
                        placeholder="Confirm New Password" 
                        required 
                        className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                        onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
                    />
                    <button 
                        type="submit" 
                        disabled={isSubmitting || status.type === 'success'}
                        className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Updating...' : 'Save New Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}