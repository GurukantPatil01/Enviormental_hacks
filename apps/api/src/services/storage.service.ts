import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PutObjectOptions {
  key: string;
  data: Buffer | string;
  contentType?: string;
  metadata?: Record<string, string>;
  maxSizeBytes?: number;
}

export interface IObjectStorage {
  putObject(options: PutObjectOptions): Promise<{ key: string; bytes: number; url?: string }>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  getSignedUrl(key: string, operation?: 'getObject' | 'putObject', expiresInSeconds?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
  getProviderName(): string;
  uploadEvidence(
    data: Buffer | string,
    filename: string,
    mimeType: string,
    metadata?: Record<string, unknown>
  ): Promise<{ storageKey: string; publicUrl: string; mimeType: string; sizeBytes: number }>;
  getEvidence(key: string): Promise<Buffer>;
  getAccessUrl(key: string): Promise<string>;
  deleteEvidence(key: string): Promise<boolean>;
}

/**
 * Validates object storage key against directory traversal and illegal characters.
 */
export function validateStorageKey(key: string): string {
  if (key.includes('..') || key.startsWith('/') || key.startsWith('\\')) {
    throw new Error(`Invalid storage key: "${key}"`);
  }
  const sanitized = path.normalize(key);
  if (!sanitized || sanitized === '.' || sanitized.includes('..')) {
    throw new Error(`Invalid storage key: "${key}"`);
  }
  return sanitized;
}

/**
 * Local filesystem object storage for development and unit tests.
 */
export class LocalObjectStorage implements IObjectStorage {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch {
        // ignore in readonly environments
      }
    }
  }

  getProviderName(): string {
    return 'LOCAL';
  }

  async putObject(options: PutObjectOptions): Promise<{ key: string; bytes: number; url: string }> {
    const key = validateStorageKey(options.key);
    const maxSizeBytes = options.maxSizeBytes || 25 * 1024 * 1024; // 25MB default

    let buffer: Buffer;
    if (Buffer.isBuffer(options.data)) {
      buffer = options.data;
    } else if (typeof options.data === 'string' && options.data.startsWith('data:')) {
      const base64Data = options.data.split(',')[1] || options.data;
      buffer = Buffer.from(base64Data, 'base64');
    } else if (typeof options.data === 'string') {
      const trimmed = options.data.trim();
      const isBase64 = trimmed.length > 50 && /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed);
      if (isBase64) {
        buffer = Buffer.from(trimmed, 'base64');
      } else {
        buffer = Buffer.from(options.data, 'utf-8');
      }
    } else {
      buffer = Buffer.from('');
    }

    if (buffer.length > maxSizeBytes) {
      throw new Error(`File size ${buffer.length} bytes exceeds maximum allowed limit of ${maxSizeBytes} bytes`);
    }

    const filePath = path.join(this.baseDir, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);

    return {
      key,
      bytes: buffer.length,
      url: `/uploads/${key}`,
    };
  }

  async getObject(key: string): Promise<Buffer> {
    const sanitized = validateStorageKey(key);
    const filePath = path.join(this.baseDir, sanitized);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    throw new Error(`Object not found: ${key}`);
  }

  async deleteObject(key: string): Promise<void> {
    const sanitized = validateStorageKey(key);
    const filePath = path.join(this.baseDir, sanitized);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async getSignedUrl(key: string, _operation: 'getObject' | 'putObject' = 'getObject', _expiresInSeconds = 3600): Promise<string> {
    const sanitized = validateStorageKey(key);
    // Local dev signed url is a clean direct route
    return `/uploads/${sanitized}`;
  }

  async exists(key: string): Promise<boolean> {
    const sanitized = validateStorageKey(key);
    const filePath = path.join(this.baseDir, sanitized);
    return fs.existsSync(filePath);
  }

  // Backward compatibility methods for existing report uploads
  async uploadEvidence(
    data: Buffer | string,
    filename: string,
    mimeType: string,
    metadata?: Record<string, unknown>
  ): Promise<{ storageKey: string; publicUrl: string; mimeType: string; sizeBytes: number }> {
    const ext = path.extname(filename) || '.jpg';
    const key = `evidence-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const res = await this.putObject({
      key,
      data,
      contentType: mimeType,
      metadata: metadata as Record<string, string>,
    });
    return {
      storageKey: res.key,
      publicUrl: res.url,
      mimeType,
      sizeBytes: res.bytes,
    };
  }

  async getEvidence(key: string): Promise<Buffer> {
    return this.getObject(key);
  }

  async getAccessUrl(key: string): Promise<string> {
    return this.getSignedUrl(key);
  }

  async deleteEvidence(key: string): Promise<boolean> {
    await this.deleteObject(key);
    return true;
  }
}

/**
 * AWS S3 Object Storage adapter using AWS SDK v3 with signed URLs.
 */
export class S3ObjectStorage implements IObjectStorage {
  private client: S3Client;
  private bucket: string;
  private localFallback: LocalObjectStorage;

  constructor(
    bucket?: string,
    region?: string,
    options?: {
      credentials?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
      endpoint?: string;
    }
  ) {
    this.bucket =
      bucket ||
      process.env.AWS_S3_BUCKET ||
      process.env.S3_BUCKET_NAME ||
      'ecopulse-evidence-dev';

    // Prevent AWS SDK v3 from stalling on EC2 metadata (IMDS) probes when running in local dev / test
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.VITEST ||
      (!process.env.AWS_EXECUTION_ENV && !process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI)
    ) {
      process.env.AWS_EC2_METADATA_DISABLED = process.env.AWS_EC2_METADATA_DISABLED ?? 'true';
    }

    const clientConfig: Record<string, any> = {
      region: region || process.env.AWS_REGION || 'ap-south-1',
    };

    if (options?.credentials) {
      clientConfig.credentials = options.credentials;
    } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
      };
    }

    const endpoint = options?.endpoint || process.env.AWS_S3_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3;
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    this.client = new S3Client(clientConfig);
    this.localFallback = new LocalObjectStorage();
  }

  getProviderName(): string {
    return 'S3';
  }

  getBucketName(): string {
    return this.bucket;
  }

  getS3Client(): S3Client {
    return this.client;
  }

  async putObject(options: PutObjectOptions): Promise<{ key: string; bytes: number; url?: string }> {
    const key = validateStorageKey(options.key);
    let buffer: Buffer;
    if (Buffer.isBuffer(options.data)) {
      buffer = options.data;
    } else if (typeof options.data === 'string' && options.data.startsWith('data:')) {
      const base64Data = options.data.split(',')[1] || options.data;
      buffer = Buffer.from(base64Data, 'base64');
    } else if (typeof options.data === 'string') {
      const trimmed = options.data.trim();
      const isBase64 = trimmed.length > 50 && /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed);
      if (isBase64) {
        buffer = Buffer.from(trimmed, 'base64');
      } else {
        buffer = Buffer.from(options.data, 'utf-8');
      }
    } else {
      buffer = Buffer.from('');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: options.contentType || 'image/jpeg',
        Metadata: options.metadata,
      });

      await this.client.send(command);
      return {
        key,
        bytes: buffer.length,
        url: `https://${this.bucket}.s3.amazonaws.com/${key}`,
      };
    } catch (err) {
      console.warn(`[S3ObjectStorage] S3 put failed, using local storage fallback:`, err);
      return this.localFallback.putObject(options);
    }
  }

  async getObject(key: string): Promise<Buffer> {
    const sanitized = validateStorageKey(key);
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: sanitized,
      });
      const response = await this.client.send(command);
      const byteArray = await response.Body?.transformToByteArray();
      return byteArray ? Buffer.from(byteArray) : Buffer.from('');
    } catch (err) {
      return this.localFallback.getObject(key);
    }
  }

  async deleteObject(key: string): Promise<void> {
    const sanitized = validateStorageKey(key);
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: sanitized,
      });
      await this.client.send(command);
    } catch {
      await this.localFallback.deleteObject(key);
    }
  }

  async getSignedUrl(key: string, operation: 'getObject' | 'putObject' = 'getObject', expiresInSeconds = 3600): Promise<string> {
    const sanitized = validateStorageKey(key);
    try {
      const command =
        operation === 'putObject'
          ? new PutObjectCommand({ Bucket: this.bucket, Key: sanitized })
          : new GetObjectCommand({ Bucket: this.bucket, Key: sanitized });

      return await awsGetSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch {
      return this.localFallback.getSignedUrl(key, operation, expiresInSeconds);
    }
  }

  async exists(key: string): Promise<boolean> {
    const sanitized = validateStorageKey(key);
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: sanitized,
      });
      await this.client.send(command);
      return true;
    } catch {
      return this.localFallback.exists(key);
    }
  }

  async uploadEvidence(
    data: Buffer | string,
    filename: string,
    mimeType: string,
    metadata?: Record<string, unknown>
  ): Promise<{ storageKey: string; publicUrl: string; mimeType: string; sizeBytes: number }> {
    const ext = path.extname(filename) || '.jpg';
    const key = `reports/evidence/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const res = await this.putObject({
      key,
      data,
      contentType: mimeType,
      metadata: metadata as Record<string, string>,
    });

    let accessUrl: string;
    try {
      accessUrl = await this.getSignedUrl(res.key, 'getObject', 7 * 24 * 3600);
    } catch {
      accessUrl = res.url || `https://${this.bucket}.s3.amazonaws.com/${res.key}`;
    }

    return {
      storageKey: res.key,
      publicUrl: accessUrl,
      mimeType,
      sizeBytes: res.bytes,
    };
  }

  async getEvidence(key: string): Promise<Buffer> {
    return this.getObject(key);
  }

  async getAccessUrl(key: string): Promise<string> {
    return this.getSignedUrl(key, 'getObject', 7 * 24 * 3600);
  }

  async deleteEvidence(key: string): Promise<boolean> {
    await this.deleteObject(key);
    return true;
  }
}

export function createObjectStorage(): IObjectStorage & LocalObjectStorage {
  const isAws = (process.env.APP_ENV || '').toLowerCase() === 'aws' || (process.env.STORAGE_PROVIDER || '').toLowerCase() === 's3';
  if (isAws) {
    return new S3ObjectStorage() as any;
  }
  return new LocalObjectStorage();
}

export const objectStorage = createObjectStorage();
export const storageService = objectStorage; // Backward compatibility for report routes
export const evidenceStorage = {
  upload: async (params: { data: Buffer; filename: string; mimeType: string; metadata?: Record<string, string> }) => {
    const key = `reports/evidence/${Date.now()}-${params.filename}`;
    const result = await objectStorage.putObject({
      key,
      data: params.data,
      contentType: params.mimeType,
      metadata: params.metadata,
    });
    return { url: result.url || `/uploads/${key}`, key };
  },
  getBuffer: async (keyOrUrl: string) => {
    return objectStorage.getObject(keyOrUrl);
  },
};

export class LocalEvidenceStorage {
  private storage: LocalObjectStorage;

  constructor(baseDir?: string) {
    this.storage = new LocalObjectStorage(baseDir);
  }

  async uploadEvidence(
    data: Buffer,
    fileName: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<{ storageKey: string; publicUrl: string; mimeType: string; sizeBytes: number }> {
    const storageKey = `evidence/${Date.now()}-${fileName}`;
    const result = await this.storage.putObject({
      key: storageKey,
      data,
      contentType: mimeType,
      metadata,
    });
    return {
      storageKey,
      publicUrl: result.url || `/uploads/${storageKey}`,
      mimeType,
      sizeBytes: result.bytes,
    };
  }

  async getEvidence(storageKey: string): Promise<Buffer> {
    return this.storage.getObject(storageKey);
  }

  async getAccessUrl(storageKey: string): Promise<string> {
    return this.storage.getSignedUrl(storageKey, 'getObject');
  }

  async deleteEvidence(storageKey: string): Promise<boolean> {
    await this.storage.deleteObject(storageKey);
    return true;
  }
}


