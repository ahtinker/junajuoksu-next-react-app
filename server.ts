/**
 * Custom server for Next.js with WebSocket support
 * 
 * Run with: node server.js
 * Or for development: npx ts-node server.ts
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { createTrainVerificationWSS } from './src/app/api/train-verification/websocket-server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url || '', true);
        handle(req, res, parsedUrl);
    });

    // Initialize WebSocket server for train verification
    const wss = createTrainVerificationWSS(server);
    console.log('[Server] Train verification WebSocket server initialized');

    server.listen(port, () => {
        console.log(`[Server] Ready on http://${hostname}:${port}`);
        console.log(`[Server] WebSocket endpoint: ws://${hostname}:${port}/api/train-verification/ws`);
    });
});
