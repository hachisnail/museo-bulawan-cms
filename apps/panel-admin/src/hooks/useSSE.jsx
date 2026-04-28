import { useEffect, useRef } from "react";

export function useSSE(eventHandlers) {
  const savedHandlers = useRef(eventHandlers);
  const sseRef = useRef(null);

  useEffect(() => {
    savedHandlers.current = eventHandlers;
  }, [eventHandlers]);

  const shouldConnect = eventHandlers && Object.keys(eventHandlers).length > 0;

  useEffect(() => {
    if (!shouldConnect) {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      return; 
    }

    let reconnectTimeout;

    const connectSSE = () => {
      const baseURL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL;

      const sse = new EventSource(`${baseURL}/api/v1/realtime/stream`, {
        withCredentials: true,
      });

      sseRef.current = sse;

      sse.onopen = () => {
        console.log("[SSE] Connected to real-time stream");
      };

      sse.onerror = (error) => {
        console.error("[SSE] Connection dropped or unauthorized. Stopping aggressive auto-retry.");
        sse.close();

        reconnectTimeout = setTimeout(() => {
           console.log("[SSE] Attempting manual reconnect...");
           connectSSE();
        }, 5000); 
      };

      Object.keys(savedHandlers.current).forEach((eventName) => {
        sse.addEventListener(eventName, (event) => {
          try {
            const parsedData = JSON.parse(event.data);
            if (savedHandlers.current[eventName]) {
               savedHandlers.current[eventName](parsedData);
            }
          } catch (err) {
            console.error(`[SSE] Failed to parse data for event: ${eventName}`, err);
          }
        });
      });
    };

    connectSSE();

    return () => {
      clearTimeout(reconnectTimeout); 
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
        console.log("[SSE] Disconnected and fully cleaned up");
      }
    };
    
  }, [shouldConnect]);
}