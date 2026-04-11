import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

// Use postgres.js for serverless (better connection handling)
const client = postgres(process.env.DATABASE_URL, {
  prepare: false, // Required for Supabase transaction pooler
  max: 1, // Limit connections in serverless
  ssl: 'require',
});

export const db = drizzle(client, { schema });
