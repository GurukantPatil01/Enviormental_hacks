import path from 'node:path';
import dotenv from 'dotenv';
import { buildApp } from './app.js';
import { runMigrations } from './db/migrate.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    // Run schema migrations on boot
    await runMigrations();

    const app = buildApp();
    await app.listen({ port, host });
    console.log(`🌲 EcoPulse API running at http://${host}:${port}`);
    console.log(`💚 Health check: http://${host}:${port}/health`);
  } catch (err) {
    console.error('Failed to start EcoPulse server:', err);
    process.exit(1);
  }
}

start();
