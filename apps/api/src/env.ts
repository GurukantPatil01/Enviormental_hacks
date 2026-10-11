import path from 'node:path';
import dotenv from 'dotenv';

const repoRoot = process.cwd();

dotenv.config();
dotenv.config({ path: path.resolve(repoRoot, '.env') });
dotenv.config({ path: path.resolve(repoRoot, '../../.env') });
