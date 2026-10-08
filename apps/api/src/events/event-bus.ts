import crypto from 'node:crypto';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import type { DomainEventType, EcoPulseEvent } from '@ecopulse/types';
import { ecoPulseEventSchema } from '@ecopulse/validation';

export type EventHandler<T = any> = (event: EcoPulseEvent<T> & { id: string; type: DomainEventType; aggregateId: string; actorId?: string | null }) => Promise<void> | void;

/**
 * Universal EventBus interface decoupling domain logic from AWS EventBridge / in-memory dispatchers.
 */
export interface IEventBus {
  publish<T = Record<string, unknown>>(
    eventOrType: DomainEventType | EcoPulseEvent<T>,
    aggregateId?: string,
    payload?: T,
    actorId?: string | null,
    correlationId?: string
  ): Promise<EcoPulseEvent<T>>;

  publishEvent<T = Record<string, unknown>>(event: EcoPulseEvent<T>): Promise<void>;

  publishBatch<T = Record<string, unknown>>(events: EcoPulseEvent<T>[]): Promise<void>;

  subscribe<T = any>(
    type: DomainEventType,
    handler: EventHandler<T>
  ): () => void;
}

/**
 * In-memory EventBus for local development and unit/integration testing.
 */
export class LocalEventBus implements IEventBus {
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
    eventOrType: DomainEventType | EcoPulseEvent<T>,
    aggregateId?: string,
    payload?: T,
    actorId?: string | null,
    correlationId?: string
  ): Promise<EcoPulseEvent<T>> {
    let event: EcoPulseEvent<T> & { id: string; type: DomainEventType; aggregateId: string; actorId?: string | null };

    if (typeof eventOrType === 'object') {
      const e = eventOrType as EcoPulseEvent<T>;
      event = {
        ...e,
        id: e.id || e.eventId,
        type: e.type || e.eventType,
        aggregateId: e.aggregateId || (e.payload as any)?.reportId || (e.payload as any)?.eventId || e.eventId,
        actorId: e.actorId ?? null,
      };
    } else {
      const type = eventOrType;
      const aggId = aggregateId || crypto.randomUUID();
      event = {
        eventId: crypto.randomUUID(),
        id: crypto.randomUUID(),
        eventType: type,
        type,
        aggregateId: aggId,
        version: 1,
        source: 'ecopulse.api',
        timestamp: new Date().toISOString(),
        correlationId: correlationId || `corr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        payload: (payload ?? {}) as T,
        actorId: actorId ?? null,
      };
    }

    // Validate event schema
    ecoPulseEventSchema.safeParse(event);

    await this.dispatch(event);
    return event;
  }

  public async publishEvent<T = Record<string, unknown>>(event: EcoPulseEvent<T>): Promise<void> {
    await this.publish(event);
  }

  public async publishBatch<T = Record<string, unknown>>(events: EcoPulseEvent<T>[]): Promise<void> {
    for (const ev of events) {
      await this.publish(ev);
    }
  }

  private async dispatch<T>(event: EcoPulseEvent<T> & { id: string; type: DomainEventType; aggregateId: string; actorId?: string | null }): Promise<void> {
    const listeners = this.handlers.get(event.eventType) || [];
    for (const handler of listeners) {
      try {
        await Promise.resolve(handler(event));
      } catch (err) {
        console.error(`[LocalEventBus] Error handling domain event ${event.eventType}:`, err);
      }
    }
  }
}

/**
 * AWS EventBridge Bus adapter for serverless cloud execution.
 */
export class AWSEventBridgeBus implements IEventBus {
  private client: EventBridgeClient;
  private eventBusName: string;
  private localFallback: LocalEventBus;

  constructor(eventBusName?: string, region?: string) {
    this.eventBusName = eventBusName || process.env.EVENT_BUS_NAME || 'ecopulse-events-dev';
    this.client = new EventBridgeClient({
      region: region || process.env.AWS_REGION || 'ap-south-1',
    });
    this.localFallback = new LocalEventBus();
  }

  public subscribe<T = any>(type: DomainEventType, handler: EventHandler<T>): () => void {
    // In AWS, EventBridge routes to Lambdas / SQS. In-process subscribers can listen via local fallback.
    return this.localFallback.subscribe(type, handler);
  }

  public async publish<T = Record<string, unknown>>(
    eventOrType: DomainEventType | EcoPulseEvent<T>,
    aggregateId?: string,
    payload?: T,
    actorId?: string | null,
    correlationId?: string
  ): Promise<EcoPulseEvent<T>> {
    let event: EcoPulseEvent<T> & { id: string; type: DomainEventType; aggregateId: string; actorId?: string | null };

    if (typeof eventOrType === 'object') {
      const e = eventOrType as EcoPulseEvent<T>;
      event = {
        ...e,
        id: e.id || e.eventId,
        type: e.type || e.eventType,
        aggregateId: e.aggregateId || (e.payload as any)?.reportId || (e.payload as any)?.eventId || e.eventId,
        actorId: e.actorId ?? null,
      };
    } else {
      const type = eventOrType;
      const aggId = aggregateId || crypto.randomUUID();
      event = {
        eventId: crypto.randomUUID(),
        id: crypto.randomUUID(),
        eventType: type,
        type,
        aggregateId: aggId,
        version: 1,
        source: 'ecopulse.api',
        timestamp: new Date().toISOString(),
        correlationId: correlationId || `corr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        payload: (payload ?? {}) as T,
        actorId: actorId ?? null,
      };
    }

    ecoPulseEventSchema.safeParse(event);

    await this.publishEvent(event);
    return event;
  }

  public async publishEvent<T = Record<string, unknown>>(event: EcoPulseEvent<T>): Promise<void> {
    const command = new PutEventsCommand({
      Entries: [
        {
          EventBusName: this.eventBusName,
          Source: event.source,
          DetailType: event.eventType,
          Time: new Date(event.timestamp),
          Detail: JSON.stringify(event),
        },
      ],
    });

    try {
      await this.client.send(command);
    } catch (err) {
      console.warn(`[AWSEventBridgeBus] Failed to publish event to EventBridge, dispatching locally:`, err);
      await this.localFallback.publishEvent(event);
    }
  }

  public async publishBatch<T = Record<string, unknown>>(events: EcoPulseEvent<T>[]): Promise<void> {
    if (events.length === 0) return;

    const command = new PutEventsCommand({
      Entries: events.map((event) => ({
        EventBusName: this.eventBusName,
        Source: event.source,
        DetailType: event.eventType,
        Time: new Date(event.timestamp),
        Detail: JSON.stringify(event),
      })),
    });

    try {
      await this.client.send(command);
    } catch (err) {
      console.warn(`[AWSEventBridgeBus] Failed batch publish, dispatching locally:`, err);
      await this.localFallback.publishBatch(events);
    }
  }
}

/**
 * Factory creating either LocalEventBus or AWSEventBridgeBus based on environment.
 */
export function createEventBus(): IEventBus {
  const isAws = (process.env.APP_ENV || '').toLowerCase() === 'aws' || process.env.EVENT_BUS_TYPE === 'eventbridge';
  if (isAws) {
    return new AWSEventBridgeBus();
  }
  return new LocalEventBus();
}

export const eventBus: IEventBus = createEventBus();
