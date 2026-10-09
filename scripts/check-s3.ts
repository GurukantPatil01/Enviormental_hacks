import crypto from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListBucketsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

async function checkS3() {
  console.log('\n============================================================');
  console.log('🌲 EcoPulse AWS S3 Evidence Storage Diagnostics');
  console.log('============================================================\n');

  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
  const region = process.env.AWS_REGION || 'ap-south-1';
  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || 'ecopulse-evidence-dev';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_S3_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3;

  console.log(`Current Configuration:`);
  console.log(`  • STORAGE_PROVIDER     : ${provider}`);
  console.log(`  • AWS_REGION           : ${region}`);
  console.log(`  • AWS_S3_BUCKET        : ${bucket}`);
  console.log(`  • AWS_ACCESS_KEY_ID    : ${accessKeyId ? `${accessKeyId.slice(0, 4)}...${accessKeyId.slice(-4)}` : '(not configured in .env)'}`);
  console.log(`  • AWS_SECRET_ACCESS_KEY: ${secretAccessKey ? '********' : '(not configured in .env)'}`);
  if (endpoint) {
    console.log(`  • Custom S3 Endpoint   : ${endpoint}`);
  }
  console.log('');

  if (!accessKeyId || !secretAccessKey) {
    console.log('⚠️  AWS Credentials are not configured in your .env file.');
    console.log('   The system is currently operating in local fallback mode (LocalObjectStorage).');
    console.log('   To activate AWS S3 cloud evidence storage, set the following in .env:');
    console.log('   ------------------------------------------------------------');
    console.log('   STORAGE_PROVIDER=s3');
    console.log('   AWS_REGION=ap-south-1');
    console.log(`   AWS_S3_BUCKET=${bucket}`);
    console.log('   AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx');
    console.log('   AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    console.log('   ------------------------------------------------------------\n');
    return;
  }

  const clientConfig: any = { region };
  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId,
      secretAccessKey,
      ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
    };
  }
  if (endpoint) {
    clientConfig.endpoint = endpoint;
    clientConfig.forcePathStyle = true;
  }

  const client = new S3Client(clientConfig);

  try {
    console.log(`1. Checking access to S3 bucket "${bucket}"...`);
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`   ✅ S3 Bucket "${bucket}" is accessible.`);
    } catch (headErr: any) {
      if (headErr?.name === 'NotFound' || headErr?.$metadata?.httpStatusCode === 404) {
        console.log(`   ⚠️  Bucket "${bucket}" does not exist yet.`);
        console.log(`   You can provision it using Terraform in infra/aws/ or the AWS Console.`);
      } else if (headErr?.$metadata?.httpStatusCode === 403) {
        console.log(`   ⚠️  Access denied to bucket "${bucket}". Check IAM permissions.`);
      } else {
        console.log(`   ⚠️  HeadBucket notice: ${headErr.message}`);
      }
    }

    console.log('\n2. Testing PutObject (evidence upload simulation)...');
    const testKey = `reports/evidence/test-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
    const testPayload = Buffer.from('EcoPulse Environmental Evidence Test Payload');

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: testPayload,
        ContentType: 'image/jpeg',
        Metadata: {
          system: 'ecopulse',
          verifiedAt: new Date().toISOString(),
        },
      })
    );
    console.log(`   ✅ Test evidence uploaded: s3://${bucket}/${testKey}`);

    console.log('\n3. Testing Presigned URL generation for secure evidence download...');
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: testKey });
    const signedGetUrl = await getSignedUrl(client, getCommand, { expiresIn: 3600 });
    console.log(`   ✅ Presigned GET URL generated (1 hr validity):`);
    console.log(`      ${signedGetUrl.slice(0, 80)}...`);

    console.log('\n4. Testing Presigned PUT URL for direct client-side upload...');
    const putCommand = new PutObjectCommand({ Bucket: bucket, Key: `reports/evidence/upload-test.jpg` });
    const signedPutUrl = await getSignedUrl(client, putCommand, { expiresIn: 900 });
    console.log(`   ✅ Presigned PUT URL generated (15 min validity):`);
    console.log(`      ${signedPutUrl.slice(0, 80)}...`);

    console.log('\n5. Cleaning up test object...');
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
    console.log(`   ✅ Test object deleted successfully.`);

    console.log('\n============================================================');
    console.log('🎉 AWS S3 Evidence Storage is FULLY FUNCTIONAL and verified!');
    console.log('============================================================\n');
  } catch (err: any) {
    console.error('\n❌ AWS S3 Diagnostic Failed:');
    console.error(`   Error: ${err.message}`);
    if (err.name) console.error(`   Code: ${err.name}`);
    console.log('\nDiagnostics & Recommendations:');
    console.log('1. Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are active.');
    console.log('2. Ensure the IAM user has s3:PutObject, s3:GetObject, s3:DeleteObject permissions.');
    console.log(`3. Confirm the S3 bucket "${bucket}" exists in region "${region}".\n`);
  }
}

checkS3();
