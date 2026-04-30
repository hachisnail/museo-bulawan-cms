import { useState, useEffect, useCallback } from 'react';
import { useSSEGlobal } from '../context/sseContext';

/**
 * useSSE Hook
 * 
 * Now consumes a global singleton connection from SSEContext.
 * Usage 1: const { events, status } = useSSE('topic'); // Filters for 'db_change' on a specific resource
 * Usage 2: useSSE({ 'event_name': (data) => { ... } }); // Specific named event listeners
 */
export function useSSE(topicOrHandlers = '*') {
    const { lastEvent, status, subscribe } = useSSEGlobal();
    const [localEvents, setLocalEvents] = useState([]);

    const handleIncoming = useCallback(({ event, data }) => {
        // Mode 1: Named Handlers Object
        if (typeof topicOrHandlers === 'object' && topicOrHandlers !== null) {
            if (topicOrHandlers[event]) {
                topicOrHandlers[event](data);
            }
        } 
        // Mode 2: Resource Filtering (db_change)
        else if (event === 'db_change') {
            if (topicOrHandlers === '*' || data.resource === topicOrHandlers) {
                setLocalEvents(prev => [data, ...prev].slice(0, 50));
            }
        }
        // Mode 3: Anonymous messages
        else if (event === 'message') {
            setLocalEvents(prev => [data, ...prev].slice(0, 50));
        }
    }, [topicOrHandlers]);

    useEffect(() => {
        return subscribe(handleIncoming);
    }, [subscribe, handleIncoming]);

    return { events: localEvents, status };
}
