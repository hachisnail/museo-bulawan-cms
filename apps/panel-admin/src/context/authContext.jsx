import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie'; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const storedUser = Cookies.get('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });

    const localLogout = useCallback(() => {
        setUser(null);
        Cookies.remove('user');
    }, []);

    const verifySession = useCallback(async () => {
        if (!Cookies.get('user')) return; 

        try {
            const baseURL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL;
            const res = await fetch(`${baseURL}/api/v1/auth/check`, {
                credentials: 'include'
            });

            if (!res.ok) {
                console.warn("Backend session invalid. Logging out locally.");
                localLogout(); 
            } else {
                const data = await res.json();
                if (data.valid && data.user) {
                    const freshUser = data.user;
                    // Only update state if JSON stringified data actually differs to prevent unnecessary re-renders
                    setUser(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(freshUser)) return prev;
                        return freshUser;
                    });
                    
                    Cookies.set('user', JSON.stringify(freshUser), { 
                        expires: 1, 
                        sameSite: 'strict',
                        secure: window.location.protocol === 'https:' 
                    });
                } else {
                    localLogout();
                }
            }
        } catch (error) {
            console.error("Session verification failed", error);
            // Don't logout on network error to allow offline resilience
        }
    }, [localLogout]);

    useEffect(() => {
        verifySession();
        
        // Check session less aggressively but reliably
        const interval = setInterval(verifySession, 60000); // every 1 min

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                verifySession();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [verifySession]);

    const login = (userData) => {
        setUser(userData);
        Cookies.set('user', JSON.stringify(userData), { 
            expires: 1, 
            sameSite: 'strict',
            secure: window.location.protocol === 'https:'
        });
    };

    const updateUser = (partial) => {
        setUser(prev => {
            const merged = { ...prev, ...partial };
            Cookies.set('user', JSON.stringify(merged), { 
                expires: 1, 
                sameSite: 'strict',
                secure: window.location.protocol === 'https:'
            });
            return merged;
        });
    };

    const logout = async () => {
        try {
            const baseURL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL;
            await fetch(`${baseURL}/api/v1/auth/logout`, { 
                method: 'POST', 
                credentials: 'include' 
            });
        } catch (e) {
            console.error("Logout request failed", e);
        } finally {
            localLogout();
        }
    };

    /**
     * Authenticated fetch wrapper that automatically handles 401 Unauthorized errors
     * by clearing local state, forcing the user back to the login screen.
     */
    const apiFetch = async (url, options = {}) => {
        const baseURL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL;
        const fetchUrl = url.startsWith('http') ? url : `${baseURL}${url}`;
        
        // Ensure headers object exists
        const headers = { ...(options.headers || {}) };

        // Automatically add CSRF token for unsafe methods (POST, PUT, DELETE, PATCH)
        const method = (options.method || 'GET').toUpperCase();
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            const xsrfToken = Cookies.get('XSRF-TOKEN');
            if (xsrfToken) {
                headers['X-XSRF-TOKEN'] = xsrfToken;
            }
        }

        const fetchOptions = {
            ...options,
            headers,
            credentials: 'include',
        };

        try {
            const response = await fetch(fetchUrl, fetchOptions);
            
            // If the response is 401 (Unauthorized) or 403 (Forbidden due to CSRF fail),
            // we should consider the session invalid if it's a persistent issue.
            // Note: CSRF failures return 403.
            if (response.status === 401) {
                console.warn('Authentication failed (401). Logging out.');
                localLogout();
            }
            
            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, localLogout, updateUser, apiFetch }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);