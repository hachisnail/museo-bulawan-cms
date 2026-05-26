import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './authContext';

const SSEContext = createContext(null);

export const SSEProvider = ({ children }) => {
    const { user } = useAuth();
    const [status, setStatus] = useState('disconnected');
    // Removed 'lastEvent' state to completely prevent global re-render storms
    const evtSource = useRef(null);
    const subscribers = useRef(new Set());
    const reconnectTimeout = useRef(null);

    const subscribe = useCallback((callback) => {
        subscribers.current.add(callback);
        return () => subscribers.current.delete(callback);
    }, []);

    const connect = useCallback(() => {
        // Strict check: ONLY connect if the user is fully logged in with an ID
        if (!user || !user.id) return; 
        
        if (evtSource.current) evtSource.current.close();

        const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        
        console.log('[SSE] Connecting to global stream...');
        evtSource.current = new EventSource(`${baseURL}/api/v1/realtime/stream`, {
            withCredentials: true,
        });

        evtSource.current.onopen = () => {
            console.log('[SSE] Connection established');
            setStatus('connected');
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
                reconnectTimeout.current = null;
            }
        };

        evtSource.current.onmessage = (e) => {
            try {
                const parsed = JSON.parse(e.data);
                subscribers.current.forEach(cb => cb({ event: 'message', data: parsed }));
            } catch (err) {}
        };

        // Standard listeners for the app
        ['db_change', 'notification', 'upload_status'].forEach(eventName => {
            evtSource.current.addEventListener(eventName, (e) => {
                try {
                    const parsed = JSON.parse(e.data);
                    // Emit only to subscribers, bypassing React state
                    subscribers.current.forEach(cb => cb({ event: eventName, data: parsed }));
                } catch (err) {}
            });
        });

        evtSource.current.onerror = () => {
            setStatus('error');
            evtSource.current.close();
            // Ensure we only reconnect if STILL logged in
            if (!reconnectTimeout.current && user && user.id) {
                reconnectTimeout.current = setTimeout(connect, 5000);
            }
        };
    }, [user]);

    useEffect(() => {
        if (user && user.id) {
            connect();
        } else {
            if (evtSource.current) {
                evtSource.current.close();
                evtSource.current = null;
            }
            setStatus('disconnected');
        }

        return () => {
            if (evtSource.current) evtSource.current.close();
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        };
    }, [user, connect]);

    return (
        <SSEContext.Provider value={{ status, subscribe }}>
            {children}
        </SSEContext.Provider>
    );
};

export const useSSEGlobal = () => {
    const context = useContext(SSEContext);
    if (!context) throw new Error('useSSEGlobal must be used within an SSEProvider');
    return context;
};