#!/usr/bin/env node
/**
 * Diagnostic Verification Script for AWS Bedrock Multimodal Waste Vision Analysis.
 *
 * Usage:
 *   pnpm verify:bedrock [optional/path/to/image.jpg]
 *
 * Verifies live credentials, multimodal image byte delivery, Zod schema validation,
 * token usage, latency, and estimated cost without printing secrets.
 * Exits with code 0 on success, non-zero code on failure.
 */

import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { BedrockVisionProvider, calculateBedrockInferenceCost } from '../apps/api/src/agents/bedrock-provider.js';
import { bedrockVisionAnalysisSchema } from '../packages/validation/src/index.js';

import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  console.log('================================================================');
  console.log('🔍 EcoPulse: AWS Bedrock Multimodal Vision Verification');
  console.log('================================================================\n');

  // 1. Audit Configuration (Mask secrets strictly)
  const region = process.env.AWS_REGION || 'ap-south-1';
  const modelId =
    process.env.BEDROCK_VISION_MODEL_ID ||
    process.env.AWS_BEDROCK_MODEL ||
    'anthropic.claude-3-5-sonnet-20241022-v2:0';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY || '';
  const s3Bucket = process.env.AWS_S3_BUCKET || 'ecopulse-evidence-dev';
  const activeProvider = process.env.VISION_PROVIDER || 'bedrock';

  const maskedKey = accessKeyId.length > 8
    ? `${accessKeyId.slice(0, 4)}...${accessKeyId.slice(-4)}`
    : accessKeyId ? '[SET]' : '[NOT SET]';
  const secretStatus = secretKey ? '[CONFIGURED - MASKED]' : '[MISSING]';

  console.log('📋 Runtime Configuration:');
  console.log(`   • Active VISION_PROVIDER:   ${activeProvider}`);
  console.log(`   • AWS Region:               ${region}`);
  console.log(`   • Bedrock Model ID:         ${modelId}`);
  console.log(`   • AWS Access Key ID:        ${maskedKey}`);
  console.log(`   • AWS Secret Access Key:    ${secretStatus}`);
  console.log(`   • S3 Storage Bucket:        ${s3Bucket}`);
  console.log('');

  if (!accessKeyId || !secretKey) {
    console.error('❌ FAILURE: Missing AWS credentials in environment (AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY).');
    process.exit(1);
  }

  // 2. Select image target
  const cliTarget = process.argv[2];
  let imagePath = cliTarget;

  if (!imagePath) {
    // Look for existing sample evidence in uploads
    const candidatePaths = [
      path.resolve(repoRoot, 'apps/api/uploads/evidence/1791580009839-test-waste.jpg'),
      path.resolve(repoRoot, 'apps/api/uploads/evidence-1791642629681-b257dba78d90.jpg'),
      path.resolve(repoRoot, 'apps/api/uploads/evidence-1790982022411-83ef9501d2df.jpg'),
      path.resolve(process.cwd(), 'uploads/evidence/1791580009839-test-waste.jpg'),
      path.resolve(process.cwd(), 'uploads/evidence-1791642629681-b257dba78d90.jpg'),
    ];

    for (const cand of candidatePaths) {
      if (fs.existsSync(cand)) {
        imagePath = cand;
        break;
      }
    }
  }

  if (!imagePath || !fs.existsSync(imagePath)) {
    console.error(`❌ FAILURE: Image file not found at: ${imagePath || '[none provided]'}`);
    console.error('Please specify an image file: pnpm verify:bedrock path/to/image.jpg');
    process.exit(1);
  }

  const fileStats = fs.statSync(imagePath);
  console.log(`📷 Target Image:`);
  console.log(`   • Path:                     ${imagePath}`);
  console.log(`   • Size:                     ${(fileStats.size / 1024).toFixed(1)} KB (${fileStats.size} bytes)`);
  console.log('');

  const ext = path.extname(imagePath).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.webp') mimeType = 'image/webp';

  const imageBuffer = fs.readFileSync(imagePath);
  const dataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  // 3. Instantiate live Bedrock Vision Provider
  console.log('🚀 Dispatching live multimodal inference to Amazon Bedrock...');
  const provider = new BedrockVisionProvider({
    region,
    model: modelId,
    timeoutMs: 35000,
  });

  const startTime = Date.now();
  try {
    const observation = await provider.analyzeEnvironmentalEvidence({
      evidenceId: `diag-${Date.now()}`,
      mediaUrl: dataUri,
      categoryHint: 'WASTE_HOTSPOT',
      locationAddress: 'Live Diagnostic Verification',
    });

    const elapsedMs = Date.now() - startTime;
    const bedrockRaw = (observation as any).bedrockAnalysis;

    // 4. Validate output adhering to Zod schema
    const validated = bedrockVisionAnalysisSchema.parse(bedrockRaw);

    const metrics = (bedrockRaw as any)?.metrics || provider.getLastMetrics();
    const inputTokens = metrics.inputTokens || Math.ceil(imageBuffer.length / 750);
    const outputTokens = metrics.outputTokens || 250;
    const costUsd = calculateBedrockInferenceCost(modelId, inputTokens, outputTokens);

    console.log('\n================================================================');
    console.log('✅ AWS Bedrock Multimodal Vision Inference: SUCCESS');
    console.log('================================================================');
    console.log(`Provider:             ${observation.provider}`);
    console.log(`Model ID:             ${observation.model}`);
    console.log(`Region:               ${region}`);
    console.log(`Latency:              ${elapsedMs} ms`);
    console.log(`Tokens (In / Out):    ${inputTokens} / ${outputTokens}`);
    console.log(`Measured Cost (USD):  $${costUsd.toFixed(6)}`);
    console.log('----------------------------------------------------------------');
    console.log(`Waste Detected:       ${validated.wasteDetected ? 'YES' : 'NO'}`);
    console.log(`Waste Category:       ${validated.wasteCategory}`);
    console.log(`Visible Severity:     ${validated.visibleSeverity}`);
    console.log(`Obstruction:          ${validated.potentialObstruction}`);
    console.log(`Evidence Quality:     ${validated.evidenceQuality}`);
    console.log(`Human Review Needed:  ${validated.requiresHumanReview ? 'YES' : 'NO'}`);
    console.log(`Detected Objects:     ${validated.detectedObjects?.join(', ') || 'None'}`);
    console.log(`Observations:         ${validated.description || validated.observations}`);
    console.log(`Recommended Action:   ${validated.recommendedAction}`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    console.error('\n================================================================');
    console.error('❌ AWS Bedrock Vision Inference: FAILED');
    console.error('================================================================');
    console.error(`Provider:             BEDROCK`);
    console.error(`Model ID:             ${modelId}`);
    console.error(`Region:               ${region}`);
    console.error(`Elapsed Time:         ${elapsedMs} ms`);
    console.error(`Error Name:           ${err.name || 'Error'}`);
    console.error(`Error Message:        ${err.message}`);
    console.error('----------------------------------------------------------------');

    if (err.name === 'AccessDeniedException' || err.message?.includes('not authorized') || err.message?.includes('AccessDenied')) {
      console.error('💡 REMEDIATION — IAM POLICY REQUIRED:');
      console.error('The AWS credentials authenticate correctly, but lack bedrock:InvokeModel permission.');
      console.error('Attach the following policy to IAM user / role:');
      console.error(JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'bedrock:InvokeModel',
              'bedrock:InvokeModelWithResponseStream'
            ],
            Resource: [
              `arn:aws:bedrock:${region}::foundation-model/*`,
              `arn:aws:bedrock:${region}:*:inference-profile/*`
            ]
          }
        ]
      }, null, 2));
    } else if (err.name === 'ResourceNotFoundException' || err.message?.includes('end of its life')) {
      console.error('💡 REMEDIATION — MODEL AVAILABILITY:');
      console.error(`The requested model ID "${modelId}" is retired or not enabled in region "${region}".`);
      console.error('Recommended active models in ap-south-1 / APAC:');
      console.error('  • anthropic.claude-3-5-sonnet-20241022-v2:0');
      console.error('  • apac.anthropic.claude-3-5-sonnet-20241022-v2:0');
      console.error('  • amazon.nova-pro-v1:0');
      console.error('  • amazon.nova-lite-v1:0');
    }
    console.error('================================================================\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal diagnostic failure:', err);
  process.exit(1);
});
