import { useState, useEffect, useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';


// --- Helper Icon Components ---
const Icons = {
    Dashboard: () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    Acquisitions: () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>,
    Accessions: () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    Inventory: () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
    Management: () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    AuditLogs: () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    Settings: () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Help: () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Logout: () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    Menu: () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>,
    Bell: () => <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    Close: () => <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
};

export default function MainLayout() {
    const { user, logout, apiFetch } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    const isAdmin = user?.role === 'admin';
    const userInitials = user?.username ? user.username.substring(0, 2).toUpperCase() : 'MB';

    // --- Notifications State ---
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await apiFetch('/api/v1/notifications');
            const data = await res.json();
            if (data.notifications) {
                setNotifications(data.notifications);
                setUnreadCount(data.notifications.filter(n => !n.is_read).length);
            }
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Handle incoming real-time notifications
    const handleNewNotification = useCallback((payload) => {
        setNotifications(prev => [payload, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);
        
        // Optional: Browser notification or toast
        if (Notification.permission === "granted") {
            new Notification(payload.title, { body: payload.message });
        }
    }, []);

    // Hook up SSE for notifications
    useSSE({
        'notification': handleNewNotification,
        // Also listen for general db changes to refresh if needed
        'db_change': (data) => console.log('Real-time DB update:', data)
    });

    const markAsRead = async (id, actionUrl) => {
        try {
            const res = await apiFetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
            if (res.ok) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (err) {
            console.error("Failed to mark notification as read", err);
        }
    };

    const navigateToResource = (actionUrl) => {
        if (actionUrl) {
            navigate(actionUrl);
            setIsNotifOpen(false);
        }
    };

    const markAllAsRead = async () => {
        try {
            const res = await apiFetch('/api/v1/notifications/read-all', { method: 'PATCH' });
            if (res.ok) {
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                setUnreadCount(0);
            }
        } catch (err) {
            console.error("Failed to mark all as read", err);
        }
    };

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: <Icons.Dashboard />, show: true },
        { name: 'Acquisitions', path: '/intakes', icon: <Icons.Acquisitions />, show: true },
        { name: 'Accessions', path: '/accessions', icon: <Icons.Accessions />, show: true },
        { name: 'Inventory', path: '/inventory', icon: <Icons.Inventory />, show: true },
        { name: 'Management', path: '/management', icon: <Icons.Management />, show: isAdmin },
        { name: 'Audit Logs', path: '/audit-logs', icon: <Icons.AuditLogs />, show: isAdmin },
        { name: 'Settings', path: '/settings', icon: <Icons.Settings />, show: true },
    ];

    return (
        <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900 overflow-hidden">
            
            {/* --- Sidebar --- */}
            <aside 
                className={`bg-zinc-950 flex flex-col transition-[width] duration-300 ease-in-out relative z-30 ${
                    isCollapsed ? 'w-16' : 'w-56'
                }`}
            >
                {/* Brand / User Profile Section */}
                <div className="h-14 flex items-center px-4 border-b border-zinc-900 overflow-hidden whitespace-nowrap">
                    {/* Flatter, minimalist avatar */}
                    <div className="flex-shrink-0 h-7 w-7 rounded-sm bg-black border border-zinc-800 flex items-center justify-center text-[#D4AF37] font-semibold text-[10px] uppercase tracking-wider">
                        {userInitials}
                    </div>
                    
                    <div className={`flex flex-col transition-all duration-300 overflow-hidden ${isCollapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-auto ml-3'}`}>
                        <span className="text-xs font-semibold text-zinc-200 truncate capitalize tracking-wide leading-tight">
                            {user?.username || 'Curator'}
                        </span>
                        <span className="text-[9px] uppercase tracking-widest text-zinc-500 leading-tight">
                            {user?.role || 'Staff'}
                        </span>
                    </div>
                </div>

                {/* Main Navigation */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-0.5 scrollbar-hide">
                    {navItems.filter(item => item.show).map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link 
                                key={item.path} 
                                to={item.path}
                                title={isCollapsed ? item.name : ''}
                                className={`flex items-center px-3 py-2 rounded-sm transition-colors group ${
                                    isActive 
                                    ? 'bg-zinc-900 text-white border-l-2 border-[#D4AF37]' 
                                    : 'text-zinc-500 hover:bg-zinc-900 hover:text-white border-l-2 border-transparent'
                                }`}
                            >
                                <span className={`${isActive ? 'text-[#D4AF37]' : 'text-zinc-500 group-hover:text-zinc-300'} transition-colors ml-0.5`}>
                                    {item.icon}
                                </span>
                                
                                <span className={`text-[13px] font-medium tracking-wide transition-all duration-300 overflow-hidden whitespace-nowrap ${
                                    isCollapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-full ml-3'
                                }`}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Actions */}
                <div className="p-2 border-t border-zinc-900 space-y-0.5 overflow-hidden whitespace-nowrap">
                    <button 
                        title={isCollapsed ? "Help & Info" : ""}
                        className="w-full flex items-center px-3 py-2 rounded-sm text-zinc-500 hover:bg-zinc-900 hover:text-white transition-colors group border-l-2 border-transparent"
                    >
                        <span className="text-zinc-500 group-hover:text-zinc-300 ml-0.5"><Icons.Help /></span>
                        <span className={`text-[13px] font-medium tracking-wide transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-full ml-3 text-left'}`}>
                            Help & Info
                        </span>
                    </button>
                    
                    <button 
                        onClick={logout}
                        title={isCollapsed ? "Log out" : ""}
                        className="w-full flex items-center px-3 py-2 rounded-sm text-zinc-500 hover:bg-zinc-900 hover:text-red-400 transition-colors group border-l-2 border-transparent"
                    >
                        <span className="text-zinc-500 group-hover:text-red-400 ml-0.5"><Icons.Logout /></span>
                        <span className={`text-[13px] font-medium tracking-wide transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-full ml-3 text-left'}`}>
                            Log out
                        </span>
                    </button>
                </div>
            </aside>

            {/* --- Main Content Area --- */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white relative">
                
                {/* Header */}
                <header className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-4 sm:px-6 z-10">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="p-1 -ml-1 text-zinc-400 hover:text-black transition-colors focus:outline-none"
                            aria-label="Toggle sidebar"
                        >
                            <Icons.Menu />
                        </button>
                        
                        <h1 className="text-sm font-serif font-bold text-black uppercase tracking-widest hidden sm:block">
                            {location.pathname === '/dashboard' ? `Welcome, ${user?.username || 'Curator'}` : location.pathname.replace('/', '').replace('-', ' ')}
                        </h1>
                    </div>

                    {/* Right Header Area (Status & Notifications) */}
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></span>
                            Online
                        </div>
                        
                        <button 
                            onClick={() => setIsNotifOpen(true)}
                            className="p-1.5 text-zinc-400 hover:text-black transition-colors relative"
                            aria-label="Open notifications"
                        >
                            <Icons.Bell />
                            {/* Unread indicator dot */}
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#D4AF37] border-2 border-white rounded-full"></span>
                            )}
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <section className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-zinc-50/50">
                    <Outlet />
                </section>
                
                {/* --- Notification Drawer Overlay --- */}
                {isNotifOpen && (
                    <div 
                        className="absolute inset-0 bg-zinc-900/10 backdrop-blur-sm z-40 transition-opacity"
                        onClick={() => setIsNotifOpen(false)}
                    />
                )}
                
                {/* Notification Drawer Panel */}
                <div 
                    className={`absolute inset-y-0 right-0 z-50 w-80 bg-white border-l border-zinc-200 shadow-2xl transform transition-transform duration-300 ease-in-out ${
                        isNotifOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                >
                    <div className="flex items-center justify-between px-6 h-14 border-b border-zinc-200 bg-zinc-50/50">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold tracking-widest uppercase text-black">Alerts & Logs</h3>
                            {unreadCount > 0 && (
                                <span className="px-1.5 py-0.5 bg-[#D4AF37] text-black text-[9px] font-black rounded-sm">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button 
                                    onClick={markAllAsRead}
                                    className="text-[9px] uppercase font-bold text-zinc-400 hover:text-[#D4AF37] transition-colors mr-2"
                                >
                                    Clear All
                                </button>
                            )}
                            <button 
                                onClick={() => setIsNotifOpen(false)}
                                className="p-1 text-zinc-400 hover:text-black transition-colors"
                            >
                                <Icons.Close />
                            </button>
                        </div>
                    </div>
                    
                    <div className="overflow-y-auto h-[calc(100vh-3.5rem)] divide-y divide-zinc-100">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center h-full text-zinc-500">
                                <Icons.Bell />
                                <p className="mt-4 text-xs tracking-wider uppercase font-medium">No active alerts</p>
                                <p className="mt-1 text-[11px] font-light text-zinc-400">Your archive is secure and up to date.</p>
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const typeColors = {
                                    success: 'bg-green-500',
                                    warning: 'bg-amber-500',
                                    error: 'bg-red-500',
                                    info: 'bg-blue-500'
                                };
                                
                                return (
                                    <div 
                                        key={notif.id} 
                                        onClick={() => {
                                            if (!notif.is_read) markAsRead(notif.id);
                                            if (notif.action_url) navigateToResource(notif.action_url);
                                        }}
                                        className={`p-5 cursor-pointer transition-all duration-300 border-l-2 hover:bg-zinc-50 ${notif.is_read ? 'border-transparent' : 'border-[#D4AF37] bg-zinc-50/50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-1.5 h-1.5 rounded-full ${typeColors[notif.type] || 'bg-zinc-400'}`}></span>
                                                <h4 className={`text-[13px] font-bold tracking-tight ${notif.is_read ? 'text-zinc-600' : 'text-black'}`}>
                                                    {notif.title}
                                                </h4>
                                            </div>
                                            <span className="text-[9px] text-zinc-400 font-mono">
                                                {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-500 leading-relaxed">
                                            {notif.message}
                                        </p>
                                        {notif.action_url && (
                                            <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#A68A27] flex items-center gap-1">
                                                View Resource <span className="text-xs">→</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}