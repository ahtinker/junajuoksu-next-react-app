import { Pool, QueryResultRow } from 'pg';

// Create a connection pool - credentials are server-side only
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
    console.log('Database connected successfully');
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});

/**
 * Execute a parameterized query safely
 * @param text - SQL query with $1, $2, etc. placeholders
 * @param params - Array of parameter values
 * @returns Array of rows
 */
export async function query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
): Promise<T[]> {
    const client = await pool.connect();
    try {
        const result = await client.query<T>(text, params);
        return result.rows;
    } finally {
        client.release();
    }
}

/**
 * Execute a single query and return the first row or null
 */
export async function queryOne<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
): Promise<T | null> {
    const rows = await query<T>(text, params);
    return rows[0] || null;
}

/**
 * Check if the database connection is healthy
 */
export async function healthCheck(): Promise<boolean> {
    try {
        await query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

export default pool;
