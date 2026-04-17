import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../shared/schema.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

const isServerless = !!process.env.VERCEL;

const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: isServerless ? 1 : 5,
  ssl: 'require',
});

export const db = drizzle(client, { schema });
