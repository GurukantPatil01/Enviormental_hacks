export interface QueuedMutation<T = unknown> {
  id: string;
  clientEventId: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: T;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'COMPLETED';
  lastError?: string;
}

export class SyncQueue {
  private queue: QueuedMutation[] = [];
  private isProcessing = false;

  public enqueue<T>(mutation: {
    endpoint: string;
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    payload: T;
    clientEventId: string;
    maxRetries?: number;
  }): QueuedMutation<T> {
    const item: QueuedMutation<T> = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      clientEventId: mutation.clientEventId,
      endpoint: mutation.endpoint,
      method: mutation.method || 'POST',
      payload: mutation.payload,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: mutation.maxRetries ?? 5,
      status: 'PENDING',
    };

    this.queue.push(item as QueuedMutation);
    console.log(`[SyncQueue] Enqueued mutation: ${item.clientEventId} -> ${item.endpoint}`);
    return item;
  }

  public getPending(): QueuedMutation[] {
    return this.queue.filter((m) => m.status === 'PENDING' || m.status === 'FAILED');
  }

  public async processQueue(
    executor: (item: QueuedMutation) => Promise<unknown>
  ): Promise<{ succeeded: number; failed: number }> {
    if (this.isProcessing) return { succeeded: 0, failed: 0 };
    this.isProcessing = true;

    let succeeded = 0;
    let failed = 0;

    for (const item of this.getPending()) {
      try {
        item.status = 'SYNCING';
        await executor(item);
        item.status = 'COMPLETED';
        succeeded++;
      } catch (err: any) {
        item.retryCount++;
        item.lastError = err?.message || 'Sync failed';
        if (item.retryCount >= item.maxRetries) {
          item.status = 'FAILED';
          console.error(`[SyncQueue] Mutation ${item.clientEventId} reached max retries.`);
        } else {
          item.status = 'PENDING';
          // Exponential backoff wait (e.g. 2^retryCount * 500ms)
          const delay = Math.pow(2, item.retryCount) * 500;
          await new Promise((r) => setTimeout(r, delay));
        }
        failed++;
      }
    }

    this.isProcessing = false;
    return { succeeded, failed };
  }

  public clearCompleted() {
    this.queue = this.queue.filter((m) => m.status !== 'COMPLETED');
  }
}

export const syncQueue = new SyncQueue();
