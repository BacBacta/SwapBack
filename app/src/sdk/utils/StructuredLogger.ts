type LogLevel = "info" | "warn" | "error" | "debug";

export interface StructuredLogPayload {
  event: string;
  [key: string]: unknown;
}

export class StructuredLogger {
  private readonly scope: string;

  constructor(scope: string) {
    this.scope = scope;
  }

  info(event: string, payload?: Record<string, unknown>): void {
    this.emit("info", event, payload);
  }

  warn(event: string, payload?: Record<string, unknown>): void {
    this.emit("warn", event, payload);
  }

  error(event: string, payload?: Record<string, unknown>): void {
    this.emit("error", event, payload);
  }

  debug(event: string, payload?: Record<string, unknown>): void {
    this.emit("debug", event, payload);
  }

  private emit(
    level: LogLevel,
    event: string,
    payload?: Record<string, unknown>
  ): void {
    const logEntry: StructuredLogPayload = {
      event,
      scope: this.scope,
      ts: new Date().toISOString(),
      ...(payload ?? {}),
    };

    const line = `[swapback][${this.scope}] ${event}`;

    switch (level) {
      case "info":
        console.info(line, logEntry);
        break;
      case "warn":
        console.warn(line, logEntry);
        break;
      case "error":
        console.error(line, logEntry);
        break;
      case "debug":
      default:
        console.debug(line, logEntry);
        break;
    }
  }
}

export const createScopedLogger = (scope: string): StructuredLogger =>
  new StructuredLogger(scope);
