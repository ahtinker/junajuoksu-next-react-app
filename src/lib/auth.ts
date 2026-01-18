import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { query, queryOne } from './db';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "329262926570-c42l0cp1g01n80grfafhvgou5vomc9mk.apps.googleusercontent.com";
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET must be set in production'); })()
    : 'dev-secret-key-not-for-production');
const JWT_EXPIRES_IN = '7d';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface GoogleUserPayload {
    sub: string;           // Google's unique user ID
    email: string;
    email_verified: boolean;
    name: string;
    picture: string;
    given_name?: string;
    family_name?: string;
    locale?: string;
    hd?: string;           // Hosted domain (for Google Workspace accounts)
}

export interface User {
    id: number;
    google_id: string;
    email: string;
    name: string;
    picture: string;
    created_at: Date;
    updated_at: Date;
}

export interface SessionPayload {
    userId: number;
    googleId: string;
    email: string;
    name: string;
    picture: string;
}

/**
 * Verify Google ID token and extract user information
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleUserPayload | null> {
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload) {
            return null;
        }

        return {
            sub: payload.sub,
            email: payload.email || '',
            email_verified: payload.email_verified || false,
            name: payload.name || '',
            picture: payload.picture || '',
            given_name: payload.given_name,
            family_name: payload.family_name,
            locale: payload.locale,
            hd: payload.hd,
        };
    } catch (error) {
        console.error('Error verifying Google token:', error);
        return null;
    }
}

/**
 * Find or create a user in the database based on Google credentials
 */
export async function findOrCreateUser(googleUser: GoogleUserPayload): Promise<User> {
    // Try to find existing user by Google ID
    let user = await queryOne<User>(
        'SELECT * FROM users WHERE google_id = $1',
        [googleUser.sub]
    );

    if (user) {
        // Update user info if changed
        user = await queryOne<User>(
            `UPDATE users 
             SET email = $1, name = $2, picture = $3, updated_at = NOW() 
             WHERE google_id = $4 
             RETURNING *`,
            [googleUser.email, googleUser.name, googleUser.picture, googleUser.sub]
        );
    } else {
        // Create new user
        user = await queryOne<User>(
            `INSERT INTO users (google_id, email, name, picture, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, NOW(), NOW()) 
             RETURNING *`,
            [googleUser.sub, googleUser.email, googleUser.name, googleUser.picture]
        );
    }

    if (!user) {
        throw new Error('Failed to create or update user');
    }

    return user;
}

/**
 * Check if a user exists by Google ID (without creating)
 */
export async function checkUserExists(googleId: string): Promise<boolean> {
    const user = await queryOne<User>(
        'SELECT id FROM users WHERE google_id = $1',
        [googleId]
    );
    return !!user;
}

/**
 * Find existing user by Google ID
 */
export async function findUserByGoogleId(googleId: string): Promise<User | null> {
    return queryOne<User>(
        'SELECT * FROM users WHERE google_id = $1',
        [googleId]
    );
}

/**
 * Create a new user in the database
 */
export async function createUser(googleUser: GoogleUserPayload): Promise<User> {
    const user = await queryOne<User>(
        `INSERT INTO users (google_id, email, name, picture, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, NOW(), NOW()) 
         RETURNING *`,
        [googleUser.sub, googleUser.email, googleUser.name, googleUser.picture]
    );

    if (!user) {
        throw new Error('Failed to create user');
    }

    return user;
}

/**
 * Create a JWT session token
 */
export function createSessionToken(user: User): string {
    const payload: SessionPayload = {
        userId: user.id,
        googleId: user.google_id,
        email: user.email,
        name: user.name,
        picture: user.picture,
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as SessionPayload;
    } catch (error) {
        return null;
    }
}

/**
 * Set the session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
    });
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete('session');
}

/**
 * Get the current session from cookies
 */
export async function getSession(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
        return null;
    }

    return verifySessionToken(sessionCookie.value);
}

/**
 * Get the current user from the database based on session
 */
export async function getCurrentUser(): Promise<User | null> {
    const session = await getSession();
    if (!session) {
        return null;
    }

    return queryOne<User>(
        'SELECT * FROM users WHERE id = $1',
        [session.userId]
    );
}
