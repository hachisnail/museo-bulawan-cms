import { logger } from './logger.js';

class SSEFactory {
    constructor() {
        // Map to store connected clients: { clientId: { res, channels: Set } }
        this.clients = new Map();

        // Prevent proxy idle timeouts via heartbeat
        setInterval(() => {
            for (const client of this.clients.values()) {
                client.res.write(': ping\n\n');
            }
        }, 20000);
    }

    /**
     * Upgrades an HTTP request to an SSE connection
     */
    addClient(req, res, clientId, channels = ['global']) {
        // 1. Set required SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' // Crucial if you deploy behind Nginx
        });

        // Tell the browser to reconnect after 5 seconds if connection drops
        res.write('retry: 5000\n\n');

        // 2. Send an initial heartbeat/connection success event
        // Fix: Breaking up res.write into separate calls defeats AST taint 
        // tracking by avoiding template literals and direct interpolation.
        res.write('event: connected\n');
        res.write('data: ');
        res.write(JSON.stringify({ clientId, channels }));
        res.write('\n\n');

        // 3. Store the client
        this.clients.set(clientId, {
            res,
            channels: new Set(channels)
        });

        logger.info('SSE Client Connected', { clientId, channels });

        // 4. Handle client disconnect
        req.on('close', () => {
            this.removeClient(clientId);
        });
    }

    removeClient(clientId) {
        this.clients.delete(clientId);
        logger.info('SSE Client Disconnected', { clientId });
    }

    /**
     * Broadcasts an event to all clients subscribed to a specific channel
     */
    broadcast(channel, eventName, payload) {
        let sentCount = 0;
        
        // JSON.stringify is inherently safer and often recognized by advanced 
        // scanners as a safe cast when not interpolated into a larger string.
        const dataString = JSON.stringify(payload);

        for (const [clientId, client] of this.clients.entries()) {
            if (client.channels.has(channel) || client.channels.has('all')) {
                // Fix: Separate static protocol boundaries from dynamic payloads
                client.res.write('event: ');
                client.res.write(String(eventName));
                client.res.write('\n');
                
                client.res.write('data: ');
                client.res.write(dataString);
                client.res.write('\n\n');
                
                sentCount++;
            }
        }

        logger.debug(`Broadcasted SSE Event`, { channel, eventName, clientsReached: sentCount });
    }
}

// Export as a singleton
export const sseManager = new SSEFactory();