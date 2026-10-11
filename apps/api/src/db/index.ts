import '../env.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

const connectionString =
  process.env.DATABASE_URL || 'postgres://gurukantpatil@localhost:5432/ecopulse';

const isNeonOrSsl =
  connectionString.includes('sslmode=require') ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('ssl=true') ||
  process.env.NODE_ENV === 'production';

export const pool = new Pool({
  connectionString,
  ssl: isNeonOrSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });
export type AppDatabase = typeof db;

