import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/authContext';

export default function Login() {
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
            const res = await fetch(`${baseURL}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include' // CRITICAL: Tells fetch to receive and store the cookie
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            login(data.user);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
                <h2 className="mb-6 text-2xl font-bold text-center text-gray-800">Admin Login</h2>
                {error && <div className="mb-4 rounded bg-red-100 p-3 text-red-700 text-sm">{error}</div>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input 
                        type="text" 
                        placeholder="Username" 
                        className="w-full rounded border p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        onChange={(e) => setFormData({...formData, username: e.target.value})} 
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        className="w-full rounded border p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        onChange={(e) => setFormData({...formData, password: e.target.value})} 
                    />
                    <button type="submit" className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700">
                        Sign In
                    </button>
                </form>
                <div className="mt-4 text-center text-sm">
                    <Link to="/forgot-password" className="text-blue-600 hover:underline">Forgot password?</Link>
                </div>
            </div>
        </div>
    );
}