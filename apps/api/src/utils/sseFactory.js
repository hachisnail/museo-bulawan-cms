import { logger } from './logger.js';
import { appEvents } from './eventBus.js';

class SSEFactory {
    constructor() {
        this.clients = new Map();

        setInterval(() => {
            for (const client of this.clients.values()) {
                client.res.write(': ping\n\n');
            }
        }, 20000);

        // Listen to global DB events and broadcast them to subscribed clients
        appEvents.on('db_change', (eventData) => {
            // The resource name usually maps nicely to a channel name
            const channel = eventData.resource; 
            this.broadcast(channel, 'db_change', eventData);
        });
    }

    addClient(req, res, clientId, channels = ['global']) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' 
        });

        res.write('retry: 5000\n\n');
        res.write('event: connected\n');
        res.write(`data: ${JSON.stringify({ clientId, channels })}\n\n`);

        this.clients.set(clientId, {
            res,
            channels: new Set(channels),
            role: req.user?.role || 'visitor'
        });

        logger.info('SSE Client Connected', { clientId, channels });

        req.on('close', () => {
            this.removeClient(clientId);
        });
    }

    removeClient(clientId) {
        this.clients.delete(clientId);
        logger.info('SSE Client Disconnected', { clientId });
    }

    broadcast(channel, eventName, payload) {
        let sentCount = 0;

        for (const [clientId, client] of this.clients.entries()) {
            if (client.channels.has(channel) || client.channels.has('all') || client.channels.has('global')) {
                let outboundPayload = payload;
                if ((client.role === 'donor' || client.role === 'visitor') && payload && payload.record) {
                    outboundPayload = {
                        action: payload.action,
                        resource: payload.resource
                    };
                }

                const dataString = JSON.stringify(outboundPayload, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                );

                client.res.write(`event: ${eventName}\n`);
                client.res.write(`data: ${dataString}\n\n`);
                sentCount++;
            }
        }

        logger.debug(`Broadcasted SSE Event`, { channel, eventName, clientsReached: sentCount });
    }
}

export const sseManager = new SSEFactory();