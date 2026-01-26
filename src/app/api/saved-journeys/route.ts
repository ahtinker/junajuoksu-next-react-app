import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { query, queryOne } from '../../../lib/db';

// Types for saved journeys
interface SavedJourney {
    id: number;
    user_id: number;
    train_number: number;
    departure_date: string;
    train_type: string | null;
    train_commuter_line: string | null;
    origin_station_uic: number;
    origin_stop_index: number;
    destination_station_uic: number;
    origin_station_name: string | null;
    destination_station_name: string | null;
    final_destination_name: string | null;
    scheduled_departure: string | null;
    scheduled_arrival: string | null;
}

interface SaveJourneyRequest {
    trainNumber: number;
    departureDate: string;
    trainType?: string;
    trainCommuterLine?: string;
    originStationUic: number;
    originStopIndex: number;
    destinationStationUic: number;
    originStationName?: string;
    destinationStationName?: string;
    finalDestinationName?: string;
    scheduledDeparture?: string;
    scheduledArrival?: string;
}

/**
 * GET /api/saved-journeys
 * Get all saved journeys for the authenticated user
 */
export async function GET(request: NextRequest) {
    try {
        // Verify authentication
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Please log in to view saved journeys' },
                { status: 401 }
            );
        }

        // Get query params for filtering
        const searchParams = request.nextUrl.searchParams;
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100
        const offset = parseInt(searchParams.get('offset') || '0');

        // Fetch saved journeys for user, ordered by most recent first
        const journeys = await query<SavedJourney>(
            `SELECT * FROM saved_journeys 
             WHERE user_id = $1 
             ORDER BY scheduled_departure DESC 
             LIMIT $2 OFFSET $3`,
            [session.userId, limit, offset]
        );

        // Get total count for pagination
        const countResult = await queryOne<{ count: string }>(
            'SELECT COUNT(*) as count FROM saved_journeys WHERE user_id = $1',
            [session.userId]
        );

        return NextResponse.json({
            success: true,
            journeys,
            pagination: {
                total: parseInt(countResult?.count || '0'),
                limit,
                offset
            }
        });
    } catch (error) {
        console.error('Error fetching saved journeys:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: 'Failed to fetch saved journeys' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/saved-journeys
 * Save a new journey or toggle (delete if exists)
 */
export async function POST(request: NextRequest) {
    try {
        // Verify authentication
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Please log in to save journeys' },
                { status: 401 }
            );
        }

        // Parse and validate request body
        const body: SaveJourneyRequest = await request.json();

        // Validate required fields
        if (!body.trainNumber || !body.departureDate || !body.originStationUic || !body.destinationStationUic) {
            return NextResponse.json(
                { error: 'Bad request', message: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Validate train number is a positive integer
        if (!Number.isInteger(body.trainNumber) || body.trainNumber <= 0) {
            return NextResponse.json(
                { error: 'Bad request', message: 'Invalid train number' },
                { status: 400 }
            );
        }

        // Validate departure date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(body.departureDate)) {
            return NextResponse.json(
                { error: 'Bad request', message: 'Invalid departure date format' },
                { status: 400 }
            );
        }

        // Check if journey already exists (for toggle behavior)
        const existingJourney = await queryOne<SavedJourney>(
            `SELECT id FROM saved_journeys 
             WHERE user_id = $1 AND train_number = $2 AND departure_date = $3 
             AND origin_station_uic = $4 AND destination_station_uic = $5`,
            [session.userId, body.trainNumber, body.departureDate, body.originStationUic, body.destinationStationUic]
        );

        if (existingJourney) {
            // Journey exists, delete it (toggle off)
            await query(
                'DELETE FROM saved_journeys WHERE id = $1 AND user_id = $2',
                [existingJourney.id, session.userId]
            );

            return NextResponse.json({
                success: true,
                action: 'removed',
                message: 'Journey removed from saved'
            });
        }

        // Insert new saved journey
        const savedJourney = await queryOne<SavedJourney>(
            `INSERT INTO saved_journeys (
                user_id, train_number, departure_date, train_type, train_commuter_line,
                origin_station_uic, origin_stop_index, destination_station_uic,
                origin_station_name, destination_station_name, final_destination_name,
                scheduled_departure, scheduled_arrival
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *`,
            [
                session.userId,
                body.trainNumber,
                body.departureDate,
                body.trainType || null,
                body.trainCommuterLine || null,
                body.originStationUic,
                body.originStopIndex || 0,
                body.destinationStationUic,
                body.originStationName || null,
                body.destinationStationName || null,
                body.finalDestinationName || null,
                body.scheduledDeparture || null,
                body.scheduledArrival || null
            ]
        );

        return NextResponse.json({
            success: true,
            action: 'saved',
            journey: savedJourney
        }, { status: 201 });
    } catch (error) {
        console.error('Error saving journey:', error);

        // Handle unique constraint violation
        if ((error as { code?: string }).code === '23505') {
            return NextResponse.json(
                { error: 'Conflict', message: 'Journey already saved' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error', message: 'Failed to save journey' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/saved-journeys
 * Delete a specific saved journey
 */
export async function DELETE(request: NextRequest) {
    try {
        // Verify authentication
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Please log in to manage saved journeys' },
                { status: 401 }
            );
        }

        // Get journey ID from query params
        const searchParams = request.nextUrl.searchParams;
        const journeyId = searchParams.get('id');

        if (!journeyId || !Number.isInteger(parseInt(journeyId))) {
            return NextResponse.json(
                { error: 'Bad request', message: 'Invalid journey ID' },
                { status: 400 }
            );
        }

        // Delete the journey (only if it belongs to the user)
        const result = await query(
            'DELETE FROM saved_journeys WHERE id = $1 AND user_id = $2 RETURNING id',
            [parseInt(journeyId), session.userId]
        );

        if (result.length === 0) {
            return NextResponse.json(
                { error: 'Not found', message: 'Journey not found or not owned by user' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Journey deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting journey:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: 'Failed to delete journey' },
            { status: 500 }
        );
    }
}
