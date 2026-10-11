import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutBucketWebsiteCommand,
  PutObjectCommand,
  PutPublicAccessBlockCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(repoRoot, '.env') });

const region = process.env.AWS_REGION || 'ap-southeast-2';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const bucketName = 'ecopulse-portal-ap-southeast-2';

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

async function main() {
  console.log('============================================================');
  console.log('🚀 Deploying EcoPulse Web Portal to AWS S3 Static Website');
  console.log(`   Bucket: ${bucketName}`);
  console.log(`   Region: ${region}`);
  console.log('============================================================\n');

  // 1. Ensure bucket exists
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`✅ Bucket ${bucketName} exists.`);
  } catch {
    console.log(`Creating bucket ${bucketName}...`);
    try {
      await s3.send(
        new CreateBucketCommand({
          Bucket: bucketName,
          CreateBucketConfiguration: { LocationConstraint: region },
        })
      );
      console.log(`✅ Bucket ${bucketName} created.`);
    } catch (err: any) {
      console.error(`Failed to create bucket:`, err.message);
      process.exit(1);
    }
  }

  // 2. Disable Public Access Block for Static Website Hosting
  console.log('Configuring public access block...');
  try {
    await s3.send(
      new PutPublicAccessBlockCommand({
        Bucket: bucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: false,
          IgnorePublicAcls: false,
          BlockPublicPolicy: false,
          RestrictPublicBuckets: false,
        },
      })
    );
    console.log('✅ Public access block disabled for static hosting.');
  } catch (err: any) {
    console.log('⚠️ Public access block note:', err.message);
  }

  // 3. Apply Bucket Policy for Public Read
  console.log('Applying public read policy...');
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadGetObject',
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${bucketName}/*`,
      },
    ],
  };

  try {
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(policy),
      })
    );
    console.log('✅ Bucket Policy applied for anonymous web browsing.');
  } catch (err: any) {
    console.log('⚠️ Bucket Policy note:', err.message);
  }

  // 4. Enable S3 Static Website Hosting
  console.log('Enabling static website hosting...');
  try {
    await s3.send(
      new PutBucketWebsiteCommand({
        Bucket: bucketName,
        WebsiteConfiguration: {
          IndexDocument: { Suffix: 'index.html' },
          ErrorDocument: { Key: 'index.html' },
        },
      })
    );
    console.log('✅ S3 Website hosting enabled.');
  } catch (err: any) {
    console.error('❌ Failed to enable website hosting:', err.message);
  }

  // 5. Upload files
  const distDir = path.resolve(repoRoot, 'apps/web/dist');
  const allFiles = getFilesRecursively(distDir);
  console.log(`\nUploading ${allFiles.length} files from dist/...`);

  for (const filePath of allFiles) {
    const relativePath = path.relative(distDir, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const body = fs.readFileSync(filePath);

    console.log(`  ⬆️ ${relativePath} (${(body.length / 1024).toFixed(1)} KB)`);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: relativePath,
        Body: body,
        ContentType: contentType,
        CacheControl: ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      })
    );
  }

  const websiteUrl = `http://${bucketName}.s3-website-${region}.amazonaws.com`;

  console.log('\n============================================================');
  console.log('🎉 DEPLOYMENT COMPLETE — AWS S3 HOSTED');
  console.log(`🌐 AWS Website URL: ${websiteUrl}`);
  console.log('============================================================\n');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
