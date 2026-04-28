import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authContext';

export default function MainLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const isAdmin = user?.role === 'admin';

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: '📊', show: true },
        { name: 'Management', path: '/management', icon: '👥', show: isAdmin },
        { name: 'Audit Logs', path: '/audit-logs', icon: '📜', show: isAdmin },
        { name: 'Settings', path: '/settings', icon: '⚙️', show: true },
    ];

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 text-xl font-bold border-b border-gray-100">Bulawan CMS</div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.filter(item => item.show).map((item) => (
                        <Link 
                            key={item.path} 
                            to={item.path}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                location.pathname === item.path ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <span>{item.icon}</span> {item.name}
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
                    <div className="text-gray-500 font-medium capitalize">
                        {location.pathname.replace('/', '').replace('-', ' ') || 'Home'}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-sm font-semibold">{user?.username}</div>
                            <div className="text-xs text-gray-400 capitalize">{user?.role}</div>
                        </div>
                        <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                            🚪 Logout
                        </button>
                    </div>
                </header>
                <section className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </section>
            </main>
        </div>
    );
}