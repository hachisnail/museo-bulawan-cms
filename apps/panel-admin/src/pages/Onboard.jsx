import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Onboard() {
    const [formData, setFormData] = useState({ fname: '', lname: '', email: '', username: '', password: '' });
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:3000/api/v1/user/onboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            setMessage("System initialized! Redirecting to login...");
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setMessage(err.message);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-lg rounded-lg bg-white p-8 shadow-md">
                <h2 className="mb-2 text-2xl font-bold text-center">System Initialization</h2>
                <p className="mb-6 text-sm text-center text-gray-500">Create the Master Admin account.</p>
                {message && <div className="mb-4 rounded bg-blue-100 p-3 text-blue-700 text-sm">{message}</div>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-4">
                        <input type="text" placeholder="First Name" required className="w-full border p-2 rounded" onChange={e => setFormData({...formData, fname: e.target.value})} />
                        <input type="text" placeholder="Last Name" required className="w-full border p-2 rounded" onChange={e => setFormData({...formData, lname: e.target.value})} />
                    </div>
                    <input type="email" placeholder="Email" required className="w-full border p-2 rounded" onChange={e => setFormData({...formData, email: e.target.value})} />
                    <input type="text" placeholder="Username" required className="w-full border p-2 rounded" onChange={e => setFormData({...formData, username: e.target.value})} />
                    <input type="password" placeholder="Password" required className="w-full border p-2 rounded" onChange={e => setFormData({...formData, password: e.target.value})} />
                    
                    <button type="submit" className="w-full rounded bg-gray-900 p-2 text-white hover:bg-gray-800">Complete Initialization</button>
                </form>
            </div>
        </div>
    );
}