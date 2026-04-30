import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './authContext';

const SSEContext = createContext(null);

export const SSEProvider = ({ children }) => {
    const { user } = useAuth();
    const [status, setStatus] = useState('disconnected');
    const [lastEvent, setLastEvent] = useState(null);
    const evtSource = useRef(null);
    const subscribers = useRef(new Set());
    const reconnectTimeout = useRef(null);

    const subscribe = useCallback((callback) => {
        subscribers.current.add(callback);
        return () => subscribers.current.delete(callback);
    }, []);

    const connect = useCallback(() => {
        if (!user) return;
        if (evtSource.current) evtSource.current.close();

        const baseURL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL;
        
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
                setLastEvent(parsed);
                subscribers.current.forEach(cb => cb({ event: 'message', data: parsed }));
            } catch (err) {}
        };

        // Standard listeners for the app
        ['db_change', 'notification', 'upload_status'].forEach(eventName => {
            evtSource.current.addEventListener(eventName, (e) => {
                try {
                    const parsed = JSON.parse(e.data);
                    setLastEvent({ event: eventName, data: parsed });
                    subscribers.current.forEach(cb => cb({ event: eventName, data: parsed }));
                } catch (err) {}
            });
        });

        evtSource.current.onerror = () => {
            setStatus('error');
            evtSource.current.close();
            if (!reconnectTimeout.current && user) {
                reconnectTimeout.current = setTimeout(connect, 5000);
            }
        };
    }, [user]);

    useEffect(() => {
        if (user) {
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
        <SSEContext.Provider value={{ status, lastEvent, subscribe }}>
            {children}
        </SSEContext.Provider>
    );
};

export const useSSEGlobal = () => {
    const context = useContext(SSEContext);
    if (!context) throw new Error('useSSEGlobal must be used within an SSEProvider');
    return context;
};
