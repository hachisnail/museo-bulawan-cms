import { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie'; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const storedUser = Cookies.get('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });

    useEffect(() => {
        const verifySession = async () => {
            if (!user) return; 

            try {
                const baseURL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL;
                const res = await fetch(`${baseURL}/api/v1/auth/check`, {
                    credentials: 'include'
                });

                if (!res.ok) {
                    console.warn("Backend session invalid. Logging out locally.");
                    localLogout(); 
                }
            } catch (error) {
                console.error("Session verification failed", error);
            }
        };

        verifySession();
        const interval = setInterval(verifySession, 30000);

        return () => clearInterval(interval);
    }, [user]);

    const login = (userData) => {
        setUser(userData);
        // 3. Save to Cookie (expires in 1 day to match a standard session)
        // 'sameSite: strict' ensures it's only sent to your own domain
        Cookies.set('user', JSON.stringify(userData), { expires: 1, sameSite: 'strict' });
    };

    const localLogout = () => {
        setUser(null);
        // 4. Remove the Cookie
        Cookies.remove('user');
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

    return (
        <AuthContext.Provider value={{ user, login, logout, localLogout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);