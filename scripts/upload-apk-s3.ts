import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

async function uploadApk() {
  const apkPath = path.resolve(repoRoot, 'apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk');
  
  if (!fs.existsSync(apkPath)) {
    console.error(`❌ APK file not found at: ${apkPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(apkPath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`📦 Found APK: ${apkPath} (${sizeMb} MB)`);
  console.log(`Uploading to s3://${bucket}/downloads/ecopulse.apk...`);

  const fileStream = fs.createReadStream(apkPath);

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: 'downloads/ecopulse.apk',
    Body: fs.readFileSync(apkPath),
    ContentType: 'application/vnd.android.package-archive',
  }));

  console.log('✅ Uploaded to S3 successfully!');

  // Generate 7-day presigned download link
  const downloadUrl = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: bucket,
    Key: 'downloads/ecopulse.apk',
  }), { expiresIn: 604800 });

  console.log('\n============================================================');
  console.log('🎉 ANDROID APK DOWNLOAD LINK (Valid for 7 days):');
  console.log(downloadUrl);
  console.log('============================================================\n');
}

uploadApk().catch((err) => {
  console.error('Failed to upload APK:', err);
  process.exit(1);
});
