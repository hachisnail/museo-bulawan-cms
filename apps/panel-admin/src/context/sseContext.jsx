import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './authContext';

const SSEContext = createContext(null);

export const SSEProvider = ({ children }) => {
    const { user } = useAuth();
    const [status, setStatus] = useState('disconnected');

    const evtSource = useRef(null);
    const subscribers = useRef(new Set());
    const reconnectTimeout = useRef(null);
    const isConnecting = useRef(false);

    // Use a ref for user so the connect/reconnect closures always see the latest value
    const userRef = useRef(user);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // Track reconnect attempts for exponential backoff
    const reconnectAttempts = useRef(0);

    const subscribe = useCallback((callback) => {
        subscribers.current.add(callback);
        return () => subscribers.current.delete(callback);
    }, []);

    const disconnect = useCallback(() => {
        if (evtSource.current) {
            evtSource.current.close();
            evtSource.current = null;
        }
        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = null;
        }
        isConnecting.current = false;
    }, []);

    // connect is stable (no deps) — reads user from userRef
    const connect = useCallback(() => {
        const currentUser = userRef.current;

        // Guard: only connect if the user is fully logged in with an ID
        if (!currentUser || !currentUser.id) {
            return;
        }

        // Guard: prevent duplicate connections
        if (isConnecting.current) {
            return;
        }
        isConnecting.current = true;

        // Close any existing connection
        if (evtSource.current) {
            evtSource.current.close();
            evtSource.current = null;
        }

        let baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
        if (baseURL.endsWith('/')) {
            baseURL = baseURL.slice(0, -1);
        }

        console.log('[SSE] Connecting to global stream...');
        const es = new EventSource(`${baseURL}/api/v1/realtime/stream`, {
            withCredentials: true,
        });
        evtSource.current = es;

        es.onopen = () => {
            console.log('[SSE] Connection established');
            setStatus('connected');
            reconnectAttempts.current = 0; // Reset backoff on success
            isConnecting.current = false;

            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
                reconnectTimeout.current = null;
            }
        };

        es.onmessage = (e) => {
            try {
                const parsed = JSON.parse(e.data);
                subscribers.current.forEach(cb => cb({ event: 'message', data: parsed }));
            } catch (err) {
                // Ignore malformed messages
            }
        };

        // Named event listeners — includes 'connected' for initial handshake data
        ['connected', 'db_change', 'notification', 'upload_status', 'force_logout'].forEach(eventName => {
            es.addEventListener(eventName, (e) => {
                try {
                    const parsed = JSON.parse(e.data);
                    subscribers.current.forEach(cb => cb({ event: eventName, data: parsed }));
                } catch (err) {
                    // Ignore malformed event data
                }
            });
        });

        es.onerror = (err) => {
            console.warn('[SSE] Connection error — will attempt reconnect', err);
            setStatus('error');
            isConnecting.current = false;

            // Close the failed source
            es.close();
            if (evtSource.current === es) {
                evtSource.current = null;
            }

            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }

            // Only reconnect if user is STILL logged in (read latest from ref)
            const latestUser = userRef.current;
            if (latestUser && latestUser.id) {
                // Exponential backoff: 5s, 10s, 20s, capped at 30s
                const delay = Math.min(5000 * Math.pow(2, reconnectAttempts.current), 30000);
                reconnectAttempts.current += 1;
                console.log(`[SSE] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts.current})...`);

                reconnectTimeout.current = setTimeout(() => {
                    reconnectTimeout.current = null;
                    connect();
                }, delay);
            } else {
                console.log('[SSE] User logged out — skipping reconnect');
                setStatus('disconnected');
            }
        };
    }, []); // Stable — no dependencies, reads user from userRef

    useEffect(() => {
        if (user && user.id) {
            connect();
        } else {
            disconnect();
            setStatus('disconnected');
        }

        return () => {
            disconnect();
        };
    }, [user?.id, connect, disconnect]); // Only reconnect when user ID actually changes

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