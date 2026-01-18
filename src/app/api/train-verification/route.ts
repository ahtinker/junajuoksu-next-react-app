import { NextRequest } from 'next/server';

// Store active verification sessions
const verificationSessions = new Map<string, {
    clientId: string;
    trainId: string | null;
    clientLocation: { lat: number; lng: number } | null;
    status: 'pending' | 'verified' | 'failed';
    connectedAt: Date;
}>();

export async function GET(request: NextRequest) {
    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get('upgrade');

    if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket connection', { status: 426 });
    }

    // Note: Next.js App Router doesn't natively support WebSocket upgrades
    // This endpoint serves as the connection point - we'll need to configure
    // a custom server or use a WebSocket-compatible deployment

    return new Response('WebSocket upgrade required. See /api/train-verification/socket for WebSocket server setup.', {
        status: 200,
        headers: {
            'Content-Type': 'text/plain',
        },
    });
}

// POST endpoint to initiate a verification session (REST fallback)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientId, trainId } = body;

        if (!clientId) {
            return Response.json({ error: 'clientId is required' }, { status: 400 });
        }

        const sessionId = crypto.randomUUID();

        verificationSessions.set(sessionId, {
            clientId,
            trainId: trainId || null,
            clientLocation: null,
            status: 'pending',
            connectedAt: new Date(),
        });

        return Response.json({
            sessionId,
            message: 'Verification session created. Connect via WebSocket to continue.',
            wsEndpoint: `/api/train-verification/ws?sessionId=${sessionId}`,
        });
    } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
