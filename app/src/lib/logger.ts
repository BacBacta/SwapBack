/**
 * Conditional Logger for SwapBack
 * Automatically disables verbose logging in production
 * while preserving critical error/warning logs
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabledInProduction: boolean;
  prefix: string;
  minLevel: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProduction = process.env.NODE_ENV === 'production';
const isDebugMode = process.env.NEXT_PUBLIC_DEBUG === 'true';

// In production, only show warnings and errors unless debug mode is enabled
const productionMinLevel: LogLevel = isDebugMode ? 'debug' : 'warn';

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      enabledInProduction: config.enabledInProduction ?? false,
      prefix: config.prefix ?? '[SwapBack]',
      minLevel: config.minLevel ?? (isProduction ? productionMinLevel : 'debug'),
    };
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, skip debug/info logs unless explicitly enabled
    if (isProduction && !this.config.enabledInProduction && !isDebugMode) {
      return LOG_LEVELS[level] >= LOG_LEVELS['warn'];
    }
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    return `${this.config.prefix} [${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  /**
   * Create a child logger with a specific prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: `${this.config.prefix} [${prefix}]`,
    });
  }

  /**
   * Group related logs together
   */
  group(label: string, fn: () => void): void {
    if (this.shouldLog('debug')) {
      console.group(this.formatMessage('debug', label));
      fn();
      console.groupEnd();
    }
  }

  /**
   * Log performance timing
   */
  time(label: string): () => void {
    if (!this.shouldLog('debug')) {
      return () => {}; // No-op in production
    }
    
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.debug(`${label} completed in ${duration.toFixed(2)}ms`);
    };
  }

  /**
   * Log only in development
   */
  dev(message: string, ...args: unknown[]): void {
    if (!isProduction) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }
}

// Singleton instance
export const logger = new Logger();

// Factory for creating module-specific loggers
export function createLogger(module: string): Logger {
  return logger.child(module);
}

// Export for testing or custom configurations
export type { Logger, LoggerConfig, LogLevel };

// Default export
export default logger;
