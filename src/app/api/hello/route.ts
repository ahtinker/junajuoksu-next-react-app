import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/db';

export async function GET() {
    try {
        // Check database connectivity
        const dbHealthy = await healthCheck();

        return NextResponse.json({
            message: 'Hello World!',
            timestamp: new Date().toISOString(),
            database: {
                connected: dbHealthy,
                status: dbHealthy ? 'healthy' : 'disconnected'
            }
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            {
                message: 'Hello World!',
                error: 'Database connection failed',
                database: {
                    connected: false,
                    status: 'error'
                }
            },
            { status: 200 } // Still return 200 since hello world works
        );
    }
}
