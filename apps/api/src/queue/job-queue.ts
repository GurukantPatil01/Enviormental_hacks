import crypto from 'node:crypto';
import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { observability } from '../observability/observability.js';

export interface QueueJob<T = any> {
  id: string;
  payload: T;
  attempt: number;
  maxAttempts: number;
  correlationId: string;
  timestamp: string;
  error?: string;
}

export interface IJobQueue<T = any> {
  enqueue(payload: T, options?: { maxAttempts?: number; correlationId?: string }): Promise<string>;
  process(handler: (payload: T, metadata: QueueJob<T>) => Promise<void>): void;
  sendToDLQ(job: QueueJob<T>, error: Error): Promise<void>;
  getDLQJobs(): Promise<QueueJob<T>[]>;
  size(): number;
  getName(): string;
  isSQS(): boolean;
  startPolling?(): Promise<void>;
  stopPolling?(): void;
}

/**
 * In-Memory Asynchronous Job Queue with Bounded Retries & DLQ.
 * Standard for deterministic local development, unit tests, and CI/CD pipelines.
 */
export class InMemoryJobQueue<T = any> implements IJobQueue<T> {
  private queue: QueueJob<T>[] = [];
  private dlq: QueueJob<T>[] = [];
  private handlers: Array<(payload: T, metadata: QueueJob<T>) => Promise<void>> = [];
  private isProcessing = false;
  private queueName: string;
  private defaultMaxAttempts: number;

  constructor(queueName: string = 'evidence-processing', defaultMaxAttempts: number = 3) {
    this.queueName = queueName;
    this.defaultMaxAttempts = defaultMaxAttempts;
  }

  getName(): string {
    return this.queueName;
  }

  isSQS(): boolean {
    return false;
  }

  size(): number {
    return this.queue.length;
  }

  async getDLQJobs(): Promise<QueueJob<T>[]> {
    return [...this.dlq];
  }

  async enqueue(payload: T, options?: { maxAttempts?: number; correlationId?: string }): Promise<string> {
    const job: QueueJob<T> = {
      id: crypto.randomUUID(),
      payload,
      attempt: 0,
      maxAttempts: options?.maxAttempts || this.defaultMaxAttempts,
      correlationId: options?.correlationId || `corr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
    };

    this.queue.push(job);
    await observability.metric('Queue.Enqueued', 1, 'Count', [
      { name: 'Queue', value: this.queueName },
      { name: 'Provider', value: 'IN_MEMORY' },
    ]);

    // Asynchronous drain
    setImmediate(() => this.drain());
    return job.id;
  }

  process(handler: (payload: T, metadata: QueueJob<T>) => Promise<void>): void {
    this.handlers.push(handler);
    setImmediate(() => this.drain());
  }

  async sendToDLQ(job: QueueJob<T>, error: Error): Promise<void> {
    job.error = error.message;
    this.dlq.push(job);
    observability.log('error', `[Queue:${this.queueName}] Job routed to Dead-Letter Queue (DLQ)`, {
      jobId: job.id,
      correlationId: job.correlationId,
      attempts: job.attempt,
      error: error.message,
    });
    await observability.metric('Queue.DLQRouted', 1, 'Count', [
      { name: 'Queue', value: this.queueName },
    ]);
  }

  private async drain(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      job.attempt += 1;
      let succeeded = false;

      for (const handler of this.handlers) {
        try {
          await handler(job.payload, job);
          succeeded = true;
          await observability.metric('Queue.Processed', 1, 'Count', [
            { name: 'Queue', value: this.queueName },
          ]);
        } catch (err: any) {
          observability.log('warn', `[Queue:${this.queueName}] Job attempt ${job.attempt}/${job.maxAttempts} failed`, {
            jobId: job.id,
            correlationId: job.correlationId,
            attempt: job.attempt,
            error: err.message,
          });

          if (job.attempt >= job.maxAttempts) {
            await this.sendToDLQ(job, err);
          } else {
            // Re-enqueue with bounded backoff
            const backoffMs = Math.min(100 * Math.pow(2, job.attempt), 2000);
            setTimeout(() => {
              this.queue.push(job);
              this.drain();
            }, backoffMs);
          }
        }
      }

      if (succeeded) {
        observability.log('debug', `[Queue:${this.queueName}] Job ${job.id} completed successfully`);
      }
    }

    this.isProcessing = false;
  }
}

export interface SQSQueueConfig {
  queueUrl?: string;
  dlqUrl?: string;
  region?: string;
  maxAttempts?: number;
  mockClient?: any;
}

/**
 * AWS SQS Enterprise Production Queue Adapter.
 * Connects directly to Amazon SQS with bounded retries, long polling, visibility timeouts,
 * and automated Dead-Letter Queue (DLQ) message handling.
 */
export class SQSJobQueue<T = any> implements IJobQueue<T> {
  private client: SQSClient;
  private queueUrl: string;
  private dlqUrl: string;
  private region: string;
  private maxAttempts: number;
  private handlers: Array<(payload: T, metadata: QueueJob<T>) => Promise<void>> = [];
  private isPolling = false;
  private inMemoryDLQ: QueueJob<T>[] = []; // Local cache of DLQ jobs for inspection

  constructor(config?: SQSQueueConfig) {
    this.region = config?.region || process.env.AWS_REGION || 'ap-south-1';
    this.queueUrl =
      config?.queueUrl ||
      process.env.AWS_SQS_QUEUE_URL ||
      'https://sqs.ap-south-1.amazonaws.com/730012679620/ecopulse-evidence-queue-dev';
    this.dlqUrl =
      config?.dlqUrl ||
      process.env.AWS_SQS_DLQ_URL ||
      'https://sqs.ap-south-1.amazonaws.com/730012679620/ecopulse-evidence-dlq-dev';
    this.maxAttempts = config?.maxAttempts || 3;

    if (config?.mockClient) {
      this.client = config.mockClient;
    } else {
      const clientConfig: Record<string, any> = { region: this.region };
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        clientConfig.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
        };
      }
      this.client = new SQSClient(clientConfig);
    }
  }

  getName(): string {
    return `SQS:${this.queueUrl}`;
  }

  isSQS(): boolean {
    return true;
  }

  size(): number {
    return 0; // Remotely managed in AWS
  }

  async getDLQJobs(): Promise<QueueJob<T>[]> {
    return [...this.inMemoryDLQ];
  }

  async enqueue(payload: T, options?: { maxAttempts?: number; correlationId?: string }): Promise<string> {
    const job: QueueJob<T> = {
      id: crypto.randomUUID(),
      payload,
      attempt: 0,
      maxAttempts: options?.maxAttempts || this.maxAttempts,
      correlationId: options?.correlationId || `corr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
    };

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(job),
      MessageAttributes: {
        CorrelationId: {
          DataType: 'String',
          StringValue: job.correlationId,
        },
        Timestamp: {
          DataType: 'String',
          StringValue: job.timestamp,
        },
      },
    });

    try {
      const res = await this.client.send(command);
      observability.log('info', `[SQSJobQueue] Dispatched message to SQS ${this.queueUrl}`, {
        messageId: res.MessageId,
        correlationId: job.correlationId,
      });

      await observability.metric('Queue.Enqueued', 1, 'Count', [
        { name: 'Queue', value: 'SQS_PRIMARY' },
      ]);
      return res.MessageId || job.id;
    } catch (err: any) {
      observability.log('error', `[SQSJobQueue] Failed to enqueue to SQS ${this.queueUrl}: ${err.message}`);
      throw err;
    }
  }

  process(handler: (payload: T, metadata: QueueJob<T>) => Promise<void>): void {
    this.handlers.push(handler);
    if (!this.isPolling) {
      this.startPolling().catch((err) => {
        observability.log('warn', `[SQSJobQueue] SQS polling encountered error: ${err.message}`);
      });
    }
  }

  async sendToDLQ(job: QueueJob<T>, error: Error): Promise<void> {
    job.error = error.message;
    this.inMemoryDLQ.push(job);

    const command = new SendMessageCommand({
      QueueUrl: this.dlqUrl,
      MessageBody: JSON.stringify(job),
      MessageAttributes: {
        CorrelationId: {
          DataType: 'String',
          StringValue: job.correlationId,
        },
        ErrorReason: {
          DataType: 'String',
          StringValue: error.message.substring(0, 200),
        },
      },
    });

    try {
      await this.client.send(command);
      observability.log('error', `[SQSJobQueue] Forwarded exhausted job to DLQ ${this.dlqUrl}`, {
        jobId: job.id,
        correlationId: job.correlationId,
        attempts: job.attempt,
        error: error.message,
      });

      await observability.metric('Queue.DLQRouted', 1, 'Count', [
        { name: 'Queue', value: 'SQS_DLQ' },
      ]);
    } catch (err: any) {
      observability.log('error', `[SQSJobQueue] Failed to send to SQS DLQ: ${err.message}`);
    }
  }

  async startPolling(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    while (this.isPolling) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 5, // Long polling
          VisibilityTimeout: 30,
          MessageSystemAttributeNames: ['ApproximateReceiveCount'],
        });

        const response = await this.client.send(command);
        const messages = response.Messages || [];

        for (const msg of messages) {
          if (!msg.Body || !msg.ReceiptHandle) continue;

          let job: QueueJob<T>;
          try {
            job = JSON.parse(msg.Body);
          } catch {
            // Malformed body: delete poison message directly
            await this.client.send(
              new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: msg.ReceiptHandle })
            );
            continue;
          }

          const receiveCount = Number(msg.Attributes?.ApproximateReceiveCount || job.attempt || 1);
          job.attempt = receiveCount;

          let succeeded = false;
          for (const handler of this.handlers) {
            try {
              await handler(job.payload, job);
              succeeded = true;
            } catch (err: any) {
              observability.log('warn', `[SQSJobQueue] Processing failed for message ${msg.MessageId} (attempt ${job.attempt}/${job.maxAttempts}): ${err.message}`);

              if (job.attempt >= job.maxAttempts) {
                // Route to DLQ & remove from primary queue
                await this.sendToDLQ(job, err);
                await this.client.send(
                  new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: msg.ReceiptHandle })
                );
              } else {
                // Exponential backoff visibility timeout change
                const backoffSeconds = Math.min(Math.pow(2, job.attempt) * 5, 60);
                await this.client.send(
                  new ChangeMessageVisibilityCommand({
                    QueueUrl: this.queueUrl,
                    ReceiptHandle: msg.ReceiptHandle,
                    VisibilityTimeout: backoffSeconds,
                  })
                );
              }
            }
          }

          if (succeeded) {
            await this.client.send(
              new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: msg.ReceiptHandle })
            );
            await observability.metric('Queue.Processed', 1, 'Count', [
              { name: 'Queue', value: 'SQS_PRIMARY' },
            ]);
          }
        }
      } catch (err: any) {
        if (!this.isPolling) break;
        // In local/unauthorized testing, backoff to avoid tight polling loops
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
  }

  stopPolling(): void {
    this.isPolling = false;
  }
}

export function createJobQueue<T = any>(name: string = 'evidence-processing'): IJobQueue<T> {
  const provider = (process.env.QUEUE_PROVIDER || '').toLowerCase();
  if (provider === 'sqs' && process.env.AWS_SQS_QUEUE_URL) {
    return new SQSJobQueue<T>();
  }
  return new InMemoryJobQueue<T>(name);
}

export const evidenceProcessingQueue = createJobQueue<{
  evidenceId: string;
  reportId?: string | null;
  uploaderId?: string | null;
}>('evidence-processing');
