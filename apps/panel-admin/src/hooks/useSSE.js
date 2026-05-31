import { useState, useEffect, useCallback, useRef } from 'react';
import { useSSEGlobal } from '../context/sseContext';

/**
 * useSSE Hook
 * 
 * Now consumes a global singleton connection from SSEContext.
 * Usage 1: const { events, status } = useSSE('topic'); // Filters for 'db_change' on a specific resource
 * Usage 2: useSSE({ 'event_name': (data) => { ... } }); // Specific named event listeners
 */
export function useSSE(topicOrHandlers = '*') {
    const { status, subscribe } = useSSEGlobal();
    const [localEvents, setLocalEvents] = useState([]);

    // Store the handlers/topic in a ref so the callback identity remains stable
    const topicOrHandlersRef = useRef(topicOrHandlers);
    useEffect(() => {
        topicOrHandlersRef.current = topicOrHandlers;
    });

    const handleIncoming = useCallback(({ event, data }) => {
        const current = topicOrHandlersRef.current;
        // Mode 1: Named Handlers Object
        if (typeof current === 'object' && current !== null) {
            if (current[event]) {
                current[event](data);
            }
        } 
        // Mode 2: Resource Filtering (db_change)
        else if (event === 'db_change') {
            if (current === '*' || data.resource === current) {
                setLocalEvents(prev => [data, ...prev].slice(0, 50));
            }
        }
        // Mode 3: Anonymous messages
        else if (event === 'message') {
            setLocalEvents(prev => [data, ...prev].slice(0, 50));
        }
    }, []); // Stable callback identity

    useEffect(() => {
        return subscribe(handleIncoming);
    }, [subscribe, handleIncoming]);

    return { events: localEvents, status };
}
