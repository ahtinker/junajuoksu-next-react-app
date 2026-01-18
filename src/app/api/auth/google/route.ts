import { NextRequest, NextResponse } from 'next/server';
import {
    verifyGoogleToken,
    findOrCreateUser,
    createSessionToken,
    setSessionCookie,
    getSession,
    clearSessionCookie,
    checkUserExists,
    findUserByGoogleId,
    createUser
} from '@/lib/auth';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "329262926570-c42l0cp1g01n80grfafhvgou5vomc9mk.apps.googleusercontent.com";

/**
 * POST /api/auth/google
 * Verify Google ID token and create a session
 * 
 * Request body options:
 * - { credential, action: 'check' } - Check if user exists (for terms acceptance flow)
 * - { credential, action: 'create' } - Create new user (after terms acceptance)
 * - { credential } - Legacy: find or create user
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { credential, g_csrf_token, action } = body;

        // Validate required fields
        if (!credential) {
            return NextResponse.json(
                { error: 'Missing credential token' },
                { status: 400 }
            );
        }

        // Validate CSRF token (only for form POST flow, not JavaScript callback flow)
        const cookieCsrfToken = request.cookies.get('g_csrf_token')?.value;
        if (cookieCsrfToken && g_csrf_token !== cookieCsrfToken) {
            // If a CSRF cookie exists, the token must match (form POST flow)
            return NextResponse.json(
                { error: 'Invalid CSRF token' },
                { status: 403 }
            );
        }
        // Note: For JavaScript callback flow, CSRF validation is not required
        // because the ID token verification provides sufficient security

        // Verify the Google ID token
        const googleUser = await verifyGoogleToken(credential);
        if (!googleUser) {
            return NextResponse.json(
                { error: 'Invalid Google token' },
                { status: 401 }
            );
        }

        // Check if email is verified
        if (!googleUser.email_verified) {
            return NextResponse.json(
                { error: 'Email not verified' },
                { status: 401 }
            );
        }

        // Handle different actions
        if (action === 'check') {
            // Only check if user exists, don't create
            const exists = await checkUserExists(googleUser.sub);
            return NextResponse.json({
                success: true,
                exists,
                googleId: googleUser.sub,
                // Include basic info for the terms modal
                pendingUser: !exists ? {
                    email: googleUser.email,
                    name: googleUser.name,
                    picture: googleUser.picture,
                } : undefined,
            });
        }

        if (action === 'create') {
            // Create new user (called after terms acceptance)
            // First check if user already exists (safety check)
            const existingUser = await findUserByGoogleId(googleUser.sub);
            if (existingUser) {
                // User already exists, just log them in
                const sessionToken = createSessionToken(existingUser);
                await setSessionCookie(sessionToken);
                return NextResponse.json({
                    success: true,
                    user: {
                        id: existingUser.id,
                        email: existingUser.email,
                        name: existingUser.name,
                        picture: existingUser.picture,
                    },
                });
            }

            // Create new user
            const newUser = await createUser(googleUser);
            const sessionToken = createSessionToken(newUser);
            await setSessionCookie(sessionToken);

            return NextResponse.json({
                success: true,
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                    picture: newUser.picture,
                },
                isNewUser: true,
            });
        }

        // Default behavior (legacy): Find or create user
        const user = await findOrCreateUser(googleUser);

        // Create session token
        const sessionToken = createSessionToken(user);

        // Set session cookie
        await setSessionCookie(sessionToken);

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                picture: user.picture,
            },
        });
    } catch (error) {
        console.error('Auth error:', error);
        return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/auth/google
 * Get current session info
 */
export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { authenticated: false },
                { status: 200 }
            );
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                id: session.userId,
                email: session.email,
                name: session.name,
                picture: session.picture,
            },
        });
    } catch (error) {
        console.error('Session error:', error);
        return NextResponse.json(
            { authenticated: false, error: 'Session error' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/auth/google
 * Sign out and clear session
 */
export async function DELETE() {
    try {
        await clearSessionCookie();

        return NextResponse.json({
            success: true,
            message: 'Signed out successfully',
        });
    } catch (error) {
        console.error('Sign out error:', error);
        return NextResponse.json(
            { error: 'Sign out failed' },
            { status: 500 }
        );
    }
}
