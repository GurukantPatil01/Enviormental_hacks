import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

export interface ObservabilityContext {
  requestId?: string;
  correlationId?: string;
  reportId?: string;
  agentRunId?: string;
  toolCallId?: string;
  [key: string]: unknown;
}

export interface MetricDimension {
  name: string;
  value: string;
}

export type MetricUnit = "Milliseconds" | "Seconds" | "Count" | "Bytes" | "Percent";

export interface IObservability {
  log(level: "debug" | "info" | "warn" | "error", message: string, context?: ObservabilityContext): void;
  metric(name: string, value: number, unit?: MetricUnit, dimensions?: MetricDimension[]): Promise<void>;
  trace<T>(name: string, fn: () => Promise<T>, context?: ObservabilityContext): Promise<T>;
}

export class LocalObservability implements IObservability {
  log(level: "debug" | "info" | "warn" | "error", message: string, context?: ObservabilityContext): void {
    const timestamp = new Date().toISOString();
    const meta = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${meta}`;
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  async metric(name: string, value: number, unit: MetricUnit = "Count", dimensions?: MetricDimension[]): Promise<void> {
    const dims = dimensions?.map((d) => `${d.name}=${d.value}`).join(", ") ?? "";
    console.log(`[METRIC] ${name}: ${value} ${unit}${dims ? ` (${dims})` : ""}`);
  }

  async trace<T>(name: string, fn: () => Promise<T>, context?: ObservabilityContext): Promise<T> {
    const start = Date.now();
    this.log("debug", `[TRACE:START] ${name}`, context);
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.log("debug", `[TRACE:END] ${name} completed in ${duration}ms`, { ...context, durationMs: duration });
      await this.metric(`${name}.latency`, duration, "Milliseconds");
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.log("error", `[TRACE:ERROR] ${name} failed after ${duration}ms`, {
        ...context,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.metric(`${name}.errors`, 1, "Count");
      throw error;
    }
  }
}

export interface CloudWatchObservabilityOptions {
  region?: string;
  namespace?: string;
}

export class CloudWatchObservability implements IObservability {
  private client: CloudWatchClient;
  private namespace: string;
  private fallback: LocalObservability;

  constructor(options: CloudWatchObservabilityOptions = {}) {
    this.client = new CloudWatchClient({ region: options.region ?? process.env.AWS_REGION ?? "ap-south-1" });
    this.namespace = options.namespace ?? "EcoPulse/Intelligence";
    this.fallback = new LocalObservability();
  }

  log(level: "debug" | "info" | "warn" | "error", message: string, context?: ObservabilityContext): void {
    // CloudWatch logs are ingested via stdout/stderr in Lambda or CloudWatch Agent
    this.fallback.log(level, message, context);
  }

  async metric(name: string, value: number, unit: MetricUnit = "Count", dimensions?: MetricDimension[]): Promise<void> {
    try {
      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: [
          {
            MetricName: name,
            Value: value,
            Unit: unit,
            Dimensions: dimensions?.map((d) => ({ Name: d.name, Value: d.value })),
            Timestamp: new Date(),
          },
        ],
      });
      await this.client.send(command);
    } catch (err) {
      // In local or unconfigured AWS environments, fallback gracefully without throwing
      this.fallback.log("warn", `CloudWatch PutMetricData skipped: ${err instanceof Error ? err.message : String(err)}`);
      await this.fallback.metric(name, value, unit, dimensions);
    }
  }

  async trace<T>(name: string, fn: () => Promise<T>, context?: ObservabilityContext): Promise<T> {
    const start = Date.now();
    this.log("debug", `[TRACE:START] ${name}`, context);
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.log("debug", `[TRACE:END] ${name} completed in ${duration}ms`, { ...context, durationMs: duration });
      await this.metric(`${name}.latency`, duration, "Milliseconds");
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.log("error", `[TRACE:ERROR] ${name} failed after ${duration}ms`, {
        ...context,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.metric(`${name}.errors`, 1, "Count");
      throw error;
    }
  }
}
