import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authContext';

export default function MainLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const isAdmin = user?.role === 'admin';

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: '📊', show: true },
        { name: 'Acquisitions', path: '/intakes', icon: '📥', show: true },
        { name: 'Accessions', path: '/accessions', icon: '📜', show: true },
        { name: 'Inventory', path: '/inventory', icon: '🏛️', show: true },
        { name: 'Management', path: '/management', icon: '👥', show: isAdmin },
        { name: 'Audit Logs', path: '/audit-logs', icon: '🕵️', show: isAdmin },
        { name: 'Settings', path: '/settings', icon: '⚙️', show: true },
    ];

    return (
        <div className="flex h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
            {/* Sidebar */}
            <aside className="w-64 glass-panel border-r border-[var(--color-glass-border)] flex flex-col z-10 relative">
                <div className="p-6 text-xl font-bold border-b border-[var(--color-glass-border)] tracking-tight">Bulawan CMS</div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.filter(item => item.show).map((item) => (
                        <Link 
                            key={item.path} 
                            to={item.path}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                                location.pathname === item.path ? 'bg-[var(--color-brand-600)] shadow-lg shadow-indigo-500/20 text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--color-glass)] hover:text-white'
                            }`}
                        >
                            <span>{item.icon}</span> {item.name}
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Background glow effects */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--color-brand-600)] rounded-full mix-blend-screen filter blur-[128px] opacity-20 pointer-events-none"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[128px] opacity-10 pointer-events-none"></div>

                <header className="h-16 glass-panel border-b border-[var(--color-glass-border)] flex items-center justify-between px-8 z-10 relative">
                    <div className="text-[var(--text-secondary)] font-medium capitalize tracking-wide">
                        {location.pathname.replace('/', '').replace('-', ' ') || 'Home'}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-sm font-semibold">{user?.username}</div>
                            <div className="text-xs text-[var(--color-brand-500)] capitalize">{user?.role}</div>
                        </div>
                        <button onClick={logout} className="p-2 text-[var(--text-secondary)] hover:text-red-400 transition-colors">
                            🚪 Logout
                        </button>
                    </div>
                </header>
                <section className="flex-1 overflow-y-auto p-8 z-10 relative scrollbar-hide">
                    <Outlet />
                </section>
            </main>
        </div>
    );
}