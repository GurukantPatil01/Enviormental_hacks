import type { DomainEvent, DomainEventType } from '@ecopulse/types';
import crypto from 'node:crypto';

export type EventHandler<T = any> = (event: DomainEvent<T>) => Promise<void> | void;

export class DomainEventBus {
  private handlers = new Map<DomainEventType, EventHandler[]>();

  public subscribe<T = any>(type: DomainEventType, handler: EventHandler<T>): () => void {
    const existing = this.handlers.get(type) || [];
    existing.push(handler as EventHandler);
    this.handlers.set(type, existing);

    return () => {
      const list = this.handlers.get(type) || [];
      this.handlers.set(type, list.filter((h) => h !== handler));
    };
  }

  public async publish<T = Record<string, unknown>>(
    type: DomainEventType,
    aggregateId: string,
    payload: T,
    actorId?: string | null
  ): Promise<DomainEvent<T>> {
    const event: DomainEvent<T> = {
      id: crypto.randomUUID(),
      type,
      aggregateId,
      actorId: actorId ?? null,
      timestamp: new Date().toISOString(),
      payload,
    };

    const listeners = this.handlers.get(type) || [];
    // Asynchronously dispatch events without blocking primary mutation
    for (const handler of listeners) {
      try {
        await Promise.resolve(handler(event));
      } catch (err) {
        console.error(`[EventBus] Error handling domain event ${type}:`, err);
      }
    }

    return event;
  }
}

export const eventBus = new DomainEventBus();
