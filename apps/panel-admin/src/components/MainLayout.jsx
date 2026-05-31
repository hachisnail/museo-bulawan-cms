// apps/panel-admin/src/components/MainLayout.jsx
import { useState, useEffect, useCallback } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { useSSE } from "../hooks/useSSE";

// --- Helper Icon Components ---
const Icons = {
  Dashboard: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  Articles: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  ),
  Acquisitions: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  Accessions: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Inventory: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Management: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  AuditLogs: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Logout: () => (
    <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9" />
    </svg>
  ),
  Menu: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  Bell: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  Close: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

export default function MainLayout() {
  const { user, logout, apiFetch } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isCmsLoading, setIsCmsLoading] = useState(true);
  const [shouldLoadCms, setShouldLoadCms] = useState(false);

  useEffect(() => {
    if (location.pathname === '/articles') {
      setShouldLoadCms(true);
    } else if (!shouldLoadCms) {
      const timer = setTimeout(() => setShouldLoadCms(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, shouldLoadCms]);

  const isAdmin = user?.role === "admin";
  const userInitials = user?.username
    ? user.username.substring(0, 2).toUpperCase()
    : "JT";

  // --- Notifications State ---
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/notifications");
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n) => !n.is_read).length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNewNotification = useCallback((payload) => {
    setNotifications((prev) => [payload, ...prev].slice(0, 50));
    setUnreadCount((prev) => prev + 1);

    if (Notification.permission === "granted") {
      new Notification(payload.title, { body: payload.message });
    }
  }, []);

  useSSE({
    notification: handleNewNotification,
    db_change: (data) => console.log("Real-time DB update:", data),
  });

  const markAsRead = async (id, actionUrl) => {
    try {
      const res = await apiFetch(`/api/v1/notifications/${id}/read`, {
        method: "PATCH",
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
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
      const res = await apiFetch("/api/v1/notifications/read-all", {
        method: "PATCH",
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: <Icons.Dashboard />, show: true },
    { name: "Articles", path: "/articles", icon: <Icons.Articles />, show: true },
    { name: "Acquisitions", path: "/intakes", icon: <Icons.Acquisitions />, show: true },
    { name: "Accessions", path: "/accessions", icon: <Icons.Accessions />, show: true },
    { name: "Inventory", path: "/inventory", icon: <Icons.Inventory />, show: true },
    { name: "Management", path: "/management", icon: <Icons.Management />, show: isAdmin },
    { name: "Audit Logs", path: "/audit-logs", icon: <Icons.AuditLogs />, show: isAdmin },
    { name: "Settings", path: "/settings", icon: <Icons.Settings />, show: true },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">
      
      {/* --- Sidebar --- */}
      <aside
        className={`bg-[#1c1c1c] flex flex-col transition-[width] duration-300 ease-in-out relative z-30 shadow-xl ${
          isCollapsed ? "w-20" : "w-[260px]"
        }`}
      >
        {/* Brand / User Profile Section */}
        <div className={`flex flex-col border-b border-white/5 pt-8 pb-6 transition-all duration-300 ${isCollapsed ? "items-center px-2" : "items-start px-7"}`}>
          
          {/* Avatar Ring */}
          <div className="p-[3px] border border-zinc-600 rounded-full mb-3">
            <div className="flex-shrink-0 h-11 w-11 rounded-full bg-[#FF5A5F] flex items-center justify-center text-white font-semibold text-sm uppercase tracking-widest shadow-inner">
              {userInitials}
            </div>
          </div>

          <div
            className={`flex flex-col transition-all duration-300 overflow-hidden ${isCollapsed ? "opacity-0 w-0 h-0" : "opacity-100 w-full h-auto"}`}
          >
            <span className="text-[10px] text-zinc-400 capitalize tracking-wide leading-tight mb-0.5">
              {user?.role || "Curator"}
            </span>
            <span className="text-[13px] font-bold text-white uppercase tracking-wider leading-tight">
              {user?.username || "JOHN RUSSEL DIGGA"}
            </span>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-1.5 scrollbar-hide ${isCollapsed ? "px-3" : "px-4"}`}>
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              // Highlight if it's an exact match OR if it's a sub-route (e.g. /intakes/...)
              const isActive = location.pathname === item.path || 
                               (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
                               
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={isCollapsed ? item.name : ""}
                  className={`flex items-center py-3 rounded-xl transition-all group ${
                    isActive
                      ? "bg-white text-black shadow-sm"
                      : "text-zinc-200 hover:bg-white/10 hover:text-white"
                  } ${isCollapsed ? "px-0 justify-center" : "px-4"}`}
                >
                  <span
                    className={`${isActive ? "text-black" : "text-zinc-300 group-hover:text-white"} transition-colors`}
                  >
                    {item.icon}
                  </span>

                  <span
                    className={`text-[14px] font-medium tracking-wide transition-all duration-300 overflow-hidden whitespace-nowrap ${
                      isCollapsed
                        ? "opacity-0 w-0 ml-0 hidden"
                        : "opacity-100 w-full ml-4"
                    }`}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
        </nav>

        {/* Bottom Logout Action */}
        <div className={`mt-auto pb-8 pt-4 border-t border-white/5 ${isCollapsed ? "px-3" : "px-4"}`}>
          <button
            onClick={logout}
            title={isCollapsed ? "Log out" : ""}
            className={`flex items-center w-full py-3 rounded-xl transition-all group text-zinc-400 hover:bg-white/10 hover:text-white ${isCollapsed ? "px-0 justify-center" : "px-4"}`}
          >
            <span className="text-zinc-400 group-hover:text-white transition-colors">
              <Icons.Logout />
            </span>
            <span
              className={`text-[14px] font-medium tracking-wide transition-all duration-300 overflow-hidden whitespace-nowrap text-left ${
                isCollapsed
                  ? "opacity-0 w-0 ml-0 hidden"
                  : "opacity-100 w-full ml-4"
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50 relative">
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 -ml-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-md transition-all focus:outline-none"
              aria-label="Toggle sidebar"
            >
              <Icons.Menu />
            </button>

            {/* Smaller Breadcrumb Style Header */}
            <div className="hidden sm:flex items-center text-xs font-semibold uppercase tracking-widest gap-2">
               <span className="text-gray-400">{location.pathname === "/dashboard" ? "Home" : "Pages"}</span>
               <span className="text-gray-300">/</span>
               <span className="text-gray-800">
                 {location.pathname === "/dashboard" ? "Dashboard" : location.pathname.split("/")[1].replace("-", " ")}
               </span>
            </div>
          </div>

          {/* Right Header Area */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsNotifOpen(true)}
              className="p-2 text-gray-400 hover:text-black transition-colors relative"
              aria-label="Open notifications"
            >
              <Icons.Bell />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#F05A5A] border-2 border-white rounded-full"></span>
              )}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <section className={`flex-1 overflow-y-auto bg-gray-50 relative ${location.pathname === '/articles' ? '!p-0' : ''}`}>
          <div className={`h-full flex flex-col relative ${location.pathname === '/articles' ? 'block' : 'hidden'}`}>
            {isCmsLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-[#7A40F2] rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-semibold text-gray-500 tracking-widest uppercase">Loading CMS...</p>
              </div>
            )}
            {shouldLoadCms && (
              <iframe 
                  src="http://localhost:3001/admin/collections/articles" 
                  className="w-full h-full flex-1 border-0"
                  title="Payload CMS Editor Preloaded"
                  onLoad={() => setIsCmsLoading(false)}
              />
            )}
          </div>
          <div className={location.pathname === '/articles' ? 'hidden' : 'block h-full'}>
            <Outlet />
          </div>
        </section>

        {/* --- Notification Drawer Overlay --- */}
        {isNotifOpen && (
          <div
            className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsNotifOpen(false)}
          />
        )}

        {/* Notification Drawer Panel */}
        <div
          className={`absolute inset-y-0 right-0 z-50 w-80 md:w-96 bg-white border-l border-gray-200 shadow-2xl transform transition-transform duration-300 ease-in-out ${
            isNotifOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-6 h-16 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold tracking-tight text-black">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-gray-100 text-black text-[10px] font-bold rounded-full border border-gray-200">
                  {unreadCount} New
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-semibold text-gray-400 hover:text-[#7A40F2] transition-colors mr-2 px-2 py-1 rounded hover:bg-gray-50"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsNotifOpen(false)}
                className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-md transition-all"
              >
                <Icons.Close />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto h-[calc(100vh-4rem)]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full text-gray-400">
                <div className="p-4 bg-gray-50 rounded-full mb-4">
                  <Icons.Bell />
                </div>
                <p className="text-sm font-bold text-gray-900 tracking-tight">
                  You're all caught up
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  No new alerts or system logs.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notif) => {
                  const typeColors = {
                    success: "bg-[#A3CC39]",
                    warning: "bg-[#F5A623]",
                    error: "bg-[#F05A5A]",
                    info: "bg-[#7A40F2]",
                  };

                  return (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.is_read) markAsRead(notif.id);
                        if (notif.action_url) navigateToResource(notif.action_url);
                      }}
                      className={`p-5 cursor-pointer transition-colors border-l-4 hover:bg-gray-50 ${
                        notif.is_read 
                          ? "border-transparent bg-white" 
                          : "border-[#7A40F2] bg-[#7A40F2]/5"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${typeColors[notif.type] || "bg-gray-300"}`}
                          ></span>
                          <h4
                            className={`text-sm tracking-tight ${notif.is_read ? "text-gray-600 font-medium" : "text-black font-bold"}`}
                          >
                            {notif.title}
                          </h4>
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap ml-2">
                          {new Date(notif.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[13px] text-gray-500 leading-relaxed pl-4">
                        {notif.message}
                      </p>
                      {notif.action_url && (
                        <div className="mt-3 pl-4 text-xs font-semibold text-[#7A40F2] flex items-center gap-1 hover:underline">
                          View Details <span>→</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}