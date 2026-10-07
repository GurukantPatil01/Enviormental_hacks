import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

import path from 'path';

// Ensure .env is loaded whether run from repo root or app subfolder
dotenv.config();
if (typeof __dirname !== 'undefined') {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
}

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

