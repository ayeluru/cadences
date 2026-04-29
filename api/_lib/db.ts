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
  connect_timeout: 10,
  idle_timeout: 20,
  connection: {
    statement_timeout: '30000' as any,
  },
});

export const db = drizzle(client, { schema });
