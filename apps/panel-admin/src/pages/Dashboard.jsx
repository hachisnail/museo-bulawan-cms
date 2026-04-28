import { useAuth } from '../context/authContext';

export default function Dashboard() {
    const { user, logout } = useAuth();

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
            <p>Welcome back, <strong>{user?.username}</strong>. Your role is: {user?.role}</p>
            <button onClick={logout} className="mt-4 rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600">
                Logout
            </button>
        </div>
    );
}