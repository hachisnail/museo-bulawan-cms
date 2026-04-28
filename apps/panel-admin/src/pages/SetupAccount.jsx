import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function SetupAccount() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:3000/api/v1/user/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, ...formData })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            setMessage("Setup complete! Redirecting to login...");
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setMessage(err.message);
        }
    };

    if (!token) return <div className="p-8 text-center text-red-500">Invalid or missing setup token.</div>;

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
                <h2 className="mb-6 text-2xl font-bold text-center">Complete Your Profile</h2>
                {message && <div className="mb-4 rounded bg-blue-100 p-3 text-blue-700 text-sm">{message}</div>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" placeholder="Choose a Username" required className="w-full border p-2 rounded" onChange={e => setFormData({...formData, username: e.target.value})} />
                    <input type="password" placeholder="Choose a Password" required className="w-full border p-2 rounded" onChange={e => setFormData({...formData, password: e.target.value})} />
                    <button type="submit" className="w-full rounded bg-green-600 p-2 text-white hover:bg-green-700">Set Up Account</button>
                </form>
            </div>
        </div>
    );
}