import { useState, useEffect, useRef } from 'react';

export function useSSE(topic = '*') {
    const [events, setEvents] = useState([]);
    const [status, setStatus] = useState('connecting'); // connecting, open, closed, error
    const evtSource = useRef(null);
    const reconnectTimeout = useRef(null);

    useEffect(() => {
        const connect = () => {
            const baseURL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL;
            // Connect to the backend stream endpoint. 
            // withCredentials ensures the HttpOnly JWT cookie is sent automatically.
            evtSource.current = new EventSource(`${baseURL}/api/v1/realtime/stream`, {
                withCredentials: true,
            });

            evtSource.current.onopen = () => {
                setStatus('open');
                // Reset reconnect timeout on successful connection
                if (reconnectTimeout.current) {
                    clearTimeout(reconnectTimeout.current);
                    reconnectTimeout.current = null;
                }
            };

            evtSource.current.onmessage = (e) => {
                try {
                    const parsed = JSON.parse(e.data);
                    
                    if (typeof topic === 'object' && topic !== null) {
                        const eventName = parsed.event || 'message';
                        if (topic[eventName]) {
                            topic[eventName](parsed.data || parsed);
                        }
                    } else {
                        setEvents(prev => [parsed, ...prev].slice(0, 50));
                    }
                } catch (err) {
                    console.error('Failed to parse SSE message', err);
                }
            };

            evtSource.current.onerror = (err) => {
                setStatus('error');
                evtSource.current.close();
                // Avoid multiple reconnect timeouts
                if (!reconnectTimeout.current) {
                    reconnectTimeout.current = setTimeout(connect, 5000);
                }
            };
        };

        connect();

        return () => {
            if (evtSource.current) {
                evtSource.current.close();
            }
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
        };
    }, [topic]);

    return { events, status };
}

