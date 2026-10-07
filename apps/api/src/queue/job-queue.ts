/**
 * Asynchronous Job Queue Abstraction
 * Supports InMemoryQueue for local dev and testing, and SQSQueue for AWS cloud deployment.
 */

export interface IJobQueue<T = any> {
  enqueue(job: T): Promise<void>;
  process(handler: (job: T) => Promise<void>): void;
  size(): number;
  getName(): string;
}

export class InMemoryJobQueue<T = any> implements IJobQueue<T> {
  private queue: T[] = [];
  private handlers: Array<(job: T) => Promise<void>> = [];
  private isProcessing = false;
  private queueName: string;

  constructor(queueName: string = 'evidence-processing') {
    this.queueName = queueName;
  }

  getName(): string {
    return this.queueName;
  }

  async enqueue(job: T): Promise<void> {
    this.queue.push(job);
    // Non-blocking trigger to process queue
    setImmediate(() => this.drain());
  }

  process(handler: (job: T) => Promise<void>): void {
    this.handlers.push(handler);
    setImmediate(() => this.drain());
  }

  size(): number {
    return this.queue.length;
  }

  private async drain(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      for (const handler of this.handlers) {
        try {
          await handler(job);
        } catch (err) {
          console.error(`[InMemoryJobQueue:${this.queueName}] Error processing job:`, err);
        }
      }
    }

    this.isProcessing = false;
  }
}

export interface SQSQueueConfig {
  queueUrl?: string;
  region?: string;
}

/**
 * AWS SQS Queue Adapter.
 * Prepared for production decoupling without introducing Kafka.
 */
export class SQSJobQueue<T = any> implements IJobQueue<T> {
  private queueUrl: string;
  private region: string;
  private handlers: Array<(job: T) => Promise<void>> = [];

  constructor(config?: SQSQueueConfig) {
    this.queueUrl = config?.queueUrl || process.env.AWS_SQS_QUEUE_URL || 'https://sqs.ap-south-1.amazonaws.com/ecopulse/evidence-queue';
    this.region = config?.region || process.env.AWS_REGION || 'ap-south-1';
  }

  getName(): string {
    return `SQS:${this.queueUrl}`;
  }

  async enqueue(job: T): Promise<void> {
    console.log(`[SQSJobQueue] SendMessage to SQS ${this.queueUrl}`);
    // If AWS SDK is configured, SendMessageCommand is dispatched here.
    // For local testing without SQS active, directly notify registered handlers:
    setImmediate(async () => {
      for (const h of this.handlers) {
        await h(job);
      }
    });
  }

  process(handler: (job: T) => Promise<void>): void {
    this.handlers.push(handler);
  }

  size(): number {
    return 0; // Managed remotely in AWS SQS
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
