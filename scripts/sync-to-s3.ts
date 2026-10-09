import fs from 'node:fs';
import path from 'node:path';
import { PutObjectCommand, S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const region = process.env.AWS_REGION || 'ap-southeast-2';
const bucket = process.env.AWS_S3_BUCKET || 'ecopulse-evidence-dev';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  console.error('❌ AWS credentials not found in .env');
  process.exit(1);
}

const client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

async function syncLocalToS3() {
  console.log(`\n============================================================`);
  console.log(`🚀 Syncing local evidence files to S3 bucket: ${bucket}`);
  console.log(`============================================================\n`);

  const uploadsDir = path.resolve(__dirname, '../apps/api/uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log('Uploads directory not found.');
    return;
  }

  const files = fs.readdirSync(uploadsDir);
  let uploadedCount = 0;

  for (const file of files) {
    const fullPath = path.join(uploadsDir, file);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile() || file.startsWith('.') || stat.size < 50) continue;

    console.log(`Uploading ${file} (${(stat.size / 1024).toFixed(1)} KB)...`);
    const fileBuffer = fs.readFileSync(fullPath);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `evidence/${file}`,
        Body: fileBuffer,
        ContentType: 'image/jpeg',
      })
    );
    uploadedCount++;
  }

  // Also check nested evidence directory if exists
  const nestedEvidenceDir = path.join(uploadsDir, 'evidence');
  if (fs.existsSync(nestedEvidenceDir)) {
    const nestedFiles = fs.readdirSync(nestedEvidenceDir);
    for (const file of nestedFiles) {
      const fullPath = path.join(nestedEvidenceDir, file);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile() || file.startsWith('.') || stat.size < 50) continue;

      console.log(`Uploading nested evidence/${file} (${(stat.size / 1024).toFixed(1)} KB)...`);
      const fileBuffer = fs.readFileSync(fullPath);

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: `evidence/${file}`,
          Body: fileBuffer,
          ContentType: 'image/jpeg',
        })
      );
      uploadedCount++;
    }
  }

  console.log(`\n✅ Successfully synced ${uploadedCount} file(s) to S3 bucket "${bucket}"!\n`);

  // Verify list
  const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 20 }));
  console.log(`📦 S3 Bucket currently contains ${list.KeyCount} object(s):`);
  for (const item of list.Contents || []) {
    console.log(`  • ${item.Key} (${item.Size} bytes)`);
  }
  console.log('\n============================================================\n');
}

syncLocalToS3().catch((err) => {
  console.error('Failed to sync to S3:', err);
  process.exit(1);
});
