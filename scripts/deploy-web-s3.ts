import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(repoRoot, '.env') });

const region = process.env.AWS_REGION || 'ap-southeast-2';
const bucket = process.env.AWS_S3_BUCKET || 'ecopulse-evidence-dev';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  console.error('❌ AWS credentials missing in .env');
  process.exit(1);
}

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function getFilesRecursively(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

async function deployWebToS3() {
  console.log('============================================================');
  console.log(`🌐 EcoPulse Web Portal Deployment to AWS S3`);
  console.log(`   Bucket: ${bucket}`);
  console.log(`   Region: ${region}`);
  console.log('============================================================\n');

  const distDir = path.resolve(repoRoot, 'apps/web/dist');
  if (!fs.existsSync(distDir)) {
    console.error('❌ Web build output not found at apps/web/dist. Run "pnpm --filter @ecopulse/web build" first.');
    process.exit(1);
  }

  const allFiles = getFilesRecursively(distDir);
  console.log(`Found ${allFiles.length} files to upload from dist/...\n`);

  let count = 0;
  for (const filePath of allFiles) {
    const relativePath = path.relative(distDir, filePath).replace(/\\/g, '/');
    const s3Key = `web-portal/${relativePath}`;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const body = fs.readFileSync(filePath);

    console.log(`  ⬆️  Uploading ${s3Key} (${(body.length / 1024).toFixed(1)} KB) [${contentType}]`);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: body,
        ContentType: contentType,
        CacheControl: ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      })
    );
    count++;
  }

  console.log('\n============================================================');
  console.log(`🎉 Web Dashboard assets (${count} files) successfully deployed to S3!`);
  console.log(`   Prefix: s3://${bucket}/web-portal/`);
  console.log('============================================================\n');
}

deployWebToS3().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
