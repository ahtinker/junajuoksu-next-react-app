import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';

export interface VerificationSession {
    clientId: string;
    trainId: string | null;
    clientLocation: { lat: number; lng: number; accuracy: number; timestamp: number } | null;
    trainLocation: { lat: number; lng: number; timestamp: number } | null;
    status: 'connecting' | 'awaiting_location' | 'verifying' | 'verified' | 'failed';
    connectedAt: Date;
    ws: WebSocket;
}

export interface ClientMessage {
    type: 'init' | 'location_update' | 'ping';
    clientId?: string;
    trainId?: string;
    location?: {
        lat: number;
        lng: number;
        accuracy: number;
        timestamp: number;
    };
}

export interface ServerMessage {
    type: 'session_created' | 'location_received' | 'verification_status' | 'train_location' | 'error' | 'pong';
    sessionId?: string;
    status?: VerificationSession['status'];
    message?: string;
    trainLocation?: { lat: number; lng: number };
    verified?: boolean;
    distance?: number;
}

// Active verification sessions
const sessions = new Map<string, VerificationSession>();

// Cleanup old sessions periodically (30 min timeout)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.connectedAt.getTime() > SESSION_TIMEOUT_MS) {
            session.ws.close(1000, 'Session timeout');
            sessions.delete(sessionId);
        }
    }
}, 60 * 1000);

export function createTrainVerificationWSS(server: any): WebSocketServer {
    const wss = new WebSocketServer({
        noServer: true,
        path: '/api/train-verification/ws'
    });

    server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
        const { pathname } = parse(request.url || '', true);

        if (pathname === '/api/train-verification/ws') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        }
    });

    wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
        const sessionId = crypto.randomUUID();
        console.log(`[TrainVerification] New WebSocket connection: ${sessionId}`);

        // Initialize session in connecting state
        const session: VerificationSession = {
            clientId: '',
            trainId: null,
            clientLocation: null,
            trainLocation: null,
            status: 'connecting',
            connectedAt: new Date(),
            ws,
        };
        sessions.set(sessionId, session);

        // Send session created message
        sendMessage(ws, {
            type: 'session_created',
            sessionId,
            status: 'connecting',
            message: 'WebSocket connected. Send init message with clientId and trainId.',
        });

        ws.on('message', (data) => {
            try {
                const message: ClientMessage = JSON.parse(data.toString());
                handleClientMessage(sessionId, message);
            } catch (error) {
                sendMessage(ws, {
                    type: 'error',
                    message: 'Invalid message format. Expected JSON.',
                });
            }
        });

        ws.on('close', () => {
            console.log(`[TrainVerification] Connection closed: ${sessionId}`);
            sessions.delete(sessionId);
        });

        ws.on('error', (error) => {
            console.error(`[TrainVerification] WebSocket error for ${sessionId}:`, error);
            sessions.delete(sessionId);
        });
    });

    return wss;
}

function handleClientMessage(sessionId: string, message: ClientMessage): void {
    const session = sessions.get(sessionId);
    if (!session) {
        return;
    }

    switch (message.type) {
        case 'init':
            handleInit(sessionId, session, message);
            break;
        case 'location_update':
            handleLocationUpdate(sessionId, session, message);
            break;
        case 'ping':
            sendMessage(session.ws, { type: 'pong' });
            break;
        default:
            sendMessage(session.ws, {
                type: 'error',
                message: `Unknown message type: ${(message as any).type}`,
            });
    }
}

function handleInit(sessionId: string, session: VerificationSession, message: ClientMessage): void {
    if (!message.clientId) {
        sendMessage(session.ws, {
            type: 'error',
            message: 'clientId is required in init message',
        });
        return;
    }

    session.clientId = message.clientId;
    session.trainId = message.trainId || null;
    session.status = 'awaiting_location';

    console.log(`[TrainVerification] Session ${sessionId} initialized for client ${session.clientId}, train ${session.trainId}`);

    sendMessage(session.ws, {
        type: 'verification_status',
        sessionId,
        status: 'awaiting_location',
        message: session.trainId
            ? `Ready to verify presence on train ${session.trainId}. Send location updates.`
            : 'Ready. Send location updates and trainId when available.',
    });
}

function handleLocationUpdate(sessionId: string, session: VerificationSession, message: ClientMessage): void {
    if (session.status === 'connecting') {
        sendMessage(session.ws, {
            type: 'error',
            message: 'Please send init message first',
        });
        return;
    }

    if (!message.location) {
        sendMessage(session.ws, {
            type: 'error',
            message: 'location is required in location_update message',
        });
        return;
    }

    // Update trainId if provided
    if (message.trainId) {
        session.trainId = message.trainId;
    }

    session.clientLocation = message.location;

    console.log(`[TrainVerification] Location update for ${sessionId}: ${message.location.lat}, ${message.location.lng} (accuracy: ${message.location.accuracy}m)`);

    sendMessage(session.ws, {
        type: 'location_received',
        message: 'Location received',
    });

    // If we have both client location and trainId, start verification
    if (session.trainId && session.clientLocation) {
        session.status = 'verifying';
        verifyTrainPresence(sessionId, session);
    }
}

async function verifyTrainPresence(sessionId: string, session: VerificationSession): Promise<void> {
    // TODO: Implement actual train position fetching from Digitraffic API
    // For now, this is a placeholder that will be expanded

    sendMessage(session.ws, {
        type: 'verification_status',
        sessionId,
        status: 'verifying',
        message: `Verifying presence on train ${session.trainId}...`,
    });

    // Placeholder: In the next step, we'll fetch real train position
    // and compare with client location
    console.log(`[TrainVerification] Starting verification for session ${sessionId}, train ${session.trainId}`);
}

function sendMessage(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

// Export for external use (e.g., to update train positions)
export function getSession(sessionId: string): VerificationSession | undefined {
    return sessions.get(sessionId);
}

export function getAllSessions(): Map<string, VerificationSession> {
    return sessions;
}

export function updateSessionTrainLocation(
    sessionId: string,
    trainLocation: { lat: number; lng: number; timestamp: number }
): void {
    const session = sessions.get(sessionId);
    if (session) {
        session.trainLocation = trainLocation;
        sendMessage(session.ws, {
            type: 'train_location',
            trainLocation: { lat: trainLocation.lat, lng: trainLocation.lng },
        });
    }
}
