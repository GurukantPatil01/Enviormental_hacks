// Ensure AWS SDK v3 does not hang attempting to reach EC2 IMDS during unit tests
process.env.AWS_EC2_METADATA_DISABLED = 'true';

import { describe, expect, it } from 'vitest';
import {
  LocalObjectStorage,
  S3ObjectStorage,
  createObjectStorage,
  validateStorageKey,
} from '../src/services/storage.service.js';

describe('AWS S3 & Evidence Storage System Tests', () => {
  describe('1. Storage Key Security & Sanitization', () => {
    it('should accept valid clean keys', () => {
      expect(validateStorageKey('reports/evidence/sample.jpg')).toBe('reports/evidence/sample.jpg');
      expect(validateStorageKey('evidence/image_123.png')).toBe('evidence/image_123.png');
      expect(validateStorageKey('data.json')).toBe('data.json');
    });

    it('should reject path traversal attempts and absolute paths', () => {
      expect(() => validateStorageKey('../../etc/passwd')).toThrow();
      expect(() => validateStorageKey('/var/data/image.jpg')).toThrow();
      expect(() => validateStorageKey('reports/../secrets.env')).toThrow();
      expect(() => validateStorageKey('\\windows\\system32')).toThrow();
      expect(() => validateStorageKey('.')).toThrow();
    });
  });

  describe('2. S3ObjectStorage Adapter Configuration', () => {
    it('should initialize with correct provider name and configured bucket', () => {
      const s3Storage = new S3ObjectStorage('test-custom-bucket', 'ap-south-1');
      expect(s3Storage.getProviderName()).toBe('S3');
      expect(s3Storage.getBucketName()).toBe('test-custom-bucket');
    });

    it('should implement all IObjectStorage evidence methods', () => {
      const s3Storage = new S3ObjectStorage('test-bucket', 'ap-south-1');
      expect(typeof s3Storage.putObject).toBe('function');
      expect(typeof s3Storage.getObject).toBe('function');
      expect(typeof s3Storage.deleteObject).toBe('function');
      expect(typeof s3Storage.getSignedUrl).toBe('function');
      expect(typeof s3Storage.exists).toBe('function');
      expect(typeof s3Storage.uploadEvidence).toBe('function');
      expect(typeof s3Storage.getEvidence).toBe('function');
      expect(typeof s3Storage.getAccessUrl).toBe('function');
      expect(typeof s3Storage.deleteEvidence).toBe('function');
    });

    it('should provide local fallback when S3 putObject fails without credentials', async () => {
      const s3Storage = new S3ObjectStorage('non-existent-bucket-unauthed', 'ap-south-1');
      const key = `reports/evidence/fallback-test-${Date.now()}.txt`;
      const testData = 'Fallback content testing';

      // Should not throw; falls back gracefully to local storage
      const result = await s3Storage.putObject({
        key,
        data: testData,
        contentType: 'text/plain',
      });

      expect(result.key).toBe(key);
      expect(result.bytes).toBeGreaterThan(0);

      // Verify retrieval works via fallback
      const exists = await s3Storage.exists(key);
      expect(exists).toBe(true);

      const buffer = await s3Storage.getObject(key);
      expect(buffer.toString('utf-8')).toBe(testData);

      // Cleanup
      await s3Storage.deleteObject(key);
    });

    it('should generate pre-signed URL with fallback', async () => {
      const s3Storage = new S3ObjectStorage('test-bucket', 'ap-south-1');
      const key = `reports/evidence/signed-test-${Date.now()}.jpg`;

      const signedUrl = await s3Storage.getSignedUrl(key, 'getObject', 3600);
      expect(typeof signedUrl).toBe('string');
      expect(signedUrl.length).toBeGreaterThan(0);
    });
  });

  describe('3. Local Evidence Storage Lifecycle', () => {
    it('should perform full evidence lifecycle: upload, access, and delete', async () => {
      const storage = new LocalObjectStorage();
      const testBuffer = Buffer.from('simulated-evidence-image-binary-data');

      const uploadResult = await storage.uploadEvidence(
        testBuffer,
        'hazard-proof.jpg',
        'image/jpeg',
        { reporterId: 'user-123' }
      );

      expect(uploadResult.storageKey).toMatch(/^evidence-/);
      expect(uploadResult.publicUrl).toContain('/uploads/');
      expect(uploadResult.mimeType).toBe('image/jpeg');
      expect(uploadResult.sizeBytes).toBe(testBuffer.length);

      const retrieved = await storage.getEvidence(uploadResult.storageKey);
      expect(retrieved.equals(testBuffer)).toBe(true);

      const accessUrl = await storage.getAccessUrl(uploadResult.storageKey);
      expect(accessUrl).toContain(uploadResult.storageKey);

      const deleted = await storage.deleteEvidence(uploadResult.storageKey);
      expect(deleted).toBe(true);

      const stillExists = await storage.exists(uploadResult.storageKey);
      expect(stillExists).toBe(false);
    });
  });

  describe('4. Storage Provider Factory', () => {
    it('should return LocalObjectStorage when STORAGE_PROVIDER=local', () => {
      const original = process.env.STORAGE_PROVIDER;
      process.env.STORAGE_PROVIDER = 'local';
      delete process.env.APP_ENV;

      const storage = createObjectStorage();
      expect(storage.getProviderName()).toBe('LOCAL');

      process.env.STORAGE_PROVIDER = original;
    });

    it('should return S3ObjectStorage when STORAGE_PROVIDER=s3', () => {
      const original = process.env.STORAGE_PROVIDER;
      process.env.STORAGE_PROVIDER = 's3';

      const storage = createObjectStorage();
      expect(storage.getProviderName()).toBe('S3');

      process.env.STORAGE_PROVIDER = original;
    });
  });
});
