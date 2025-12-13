/**
 * 📊 Structured Logging & Analytics
 * 
 * Système de logging structuré pour le RouterSwap:
 * - Logs structurés en JSON pour analyse
 * - Métriques de performance
 * - Traçage des erreurs
 * - Analytics swap
 * 
 * @author SwapBack Team
 * @date January 2025
 */

// ============================================================================
// TYPES
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  /** Identifiant unique de la session */
  sessionId?: string;
  /** Identifiant de la transaction */
  transactionId?: string;
  /** Adresse du wallet */
  wallet?: string;
  /** Composant source */
  component: string;
  /** Action en cours */
  action: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metrics?: {
    durationMs?: number;
    memoryUsedMB?: number;
    [key: string]: number | undefined;
  };
}

export interface SwapMetrics {
  /** Temps total de l'opération en ms */
  totalDurationMs: number;
  /** Temps de fetch quote en ms */
  quoteFetchMs: number;
  /** Temps de simulation en ms */
  simulationMs: number;
  /** Temps de signature en ms */
  signingMs: number;
  /** Temps de confirmation en ms */
  confirmationMs: number;
  /** Slippage réel en bps */
  actualSlippageBps: number;
  /** Montant d'entrée */
  inputAmount: number;
  /** Montant de sortie */
  outputAmount: number;
  /** NPI généré en bps */
  npiBps: number;
  /** Venue utilisée */
  venue: string;
  /** Succès ou échec */
  success: boolean;
}

export interface AnalyticsEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: number;
  sessionId?: string;
  userId?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

let currentLogLevel: LogLevel = 'info';
let sessionId: string | null = null;
let analyticsBuffer: AnalyticsEvent[] = [];
const ANALYTICS_FLUSH_INTERVAL = 10000; // 10 secondes
const MAX_BUFFER_SIZE = 100;

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function initSession(): string {
  if (!sessionId) {
    sessionId = generateSessionId();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('swapback_session_id', sessionId);
    }
  }
  return sessionId;
}

export function getSessionId(): string | null {
  if (!sessionId && typeof window !== 'undefined') {
    sessionId = sessionStorage.getItem('swapback_session_id');
  }
  return sessionId;
}

// ============================================================================
// STRUCTURED LOGGER
// ============================================================================

class StructuredLogger {
  private component: string;
  private defaultContext: Partial<LogContext>;
  
  constructor(component: string, defaultContext?: Partial<LogContext>) {
    this.component = component;
    this.defaultContext = defaultContext || {};
  }
  
  private formatEntry(
    level: LogLevel,
    message: string,
    context: Partial<LogContext>,
    data?: Record<string, unknown>,
    error?: Error,
    metrics?: Record<string, number>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        sessionId: getSessionId() || undefined,
        component: this.component,
        action: context.action || 'unknown',
        ...this.defaultContext,
        ...context,
      },
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as Error & { code?: string }).code,
      } : undefined,
      metrics,
    };
  }
  
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
  }
  
  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;
    
    const consoleMethod = entry.level === 'fatal' ? 'error' : entry.level;
    const prefix = `[${entry.context.component}][${entry.context.action}]`;
    
    // En développement, affichage lisible
    if (process.env.NODE_ENV === 'development') {
      const color = {
        debug: '\x1b[90m',
        info: '\x1b[36m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
        fatal: '\x1b[35m',
      }[entry.level];
      
      console[consoleMethod](
        `${color}${entry.level.toUpperCase()}\x1b[0m ${prefix} ${entry.message}`,
        entry.data || '',
        entry.error?.message || ''
      );
    } else {
      // En production, JSON structuré
      console[consoleMethod](JSON.stringify(entry));
    }
    
    // Envoyer à l'analytics si error ou fatal
    if (entry.level === 'error' || entry.level === 'fatal') {
      trackEvent('log_error', {
        level: entry.level,
        message: entry.message,
        component: entry.context.component,
        action: entry.context.action,
        errorCode: entry.error?.code,
      });
    }
  }
  
  debug(message: string, data?: Record<string, unknown>, context?: Partial<LogContext>): void {
    this.output(this.formatEntry('debug', message, context || {}, data));
  }
  
  info(message: string, data?: Record<string, unknown>, context?: Partial<LogContext>): void {
    this.output(this.formatEntry('info', message, context || {}, data));
  }
  
  warn(message: string, data?: Record<string, unknown>, context?: Partial<LogContext>): void {
    this.output(this.formatEntry('warn', message, context || {}, data));
  }
  
  error(message: string, error?: Error, data?: Record<string, unknown>, context?: Partial<LogContext>): void {
    this.output(this.formatEntry('error', message, context || {}, data, error));
  }
  
  fatal(message: string, error?: Error, data?: Record<string, unknown>, context?: Partial<LogContext>): void {
    this.output(this.formatEntry('fatal', message, context || {}, data, error));
  }
  
  /** Log avec métriques de performance */
  metric(message: string, metrics: Record<string, number>, context?: Partial<LogContext>): void {
    this.output(this.formatEntry('info', message, context || {}, undefined, undefined, metrics));
  }
  
  /** Mesure la durée d'une opération async */
  async measure<T>(
    action: string,
    operation: () => Promise<T>,
    context?: Partial<LogContext>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const durationMs = Math.round(performance.now() - start);
      this.metric(`${action} completed`, { durationMs }, { ...context, action });
      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      this.error(`${action} failed`, error as Error, { durationMs }, { ...context, action });
      throw error;
    }
  }
  
  /** Crée un child logger avec contexte enrichi */
  child(additionalContext: Partial<LogContext>): StructuredLogger {
    return new StructuredLogger(this.component, {
      ...this.defaultContext,
      ...additionalContext,
    });
  }
}

// ============================================================================
// SWAP METRICS TRACKER
// ============================================================================

class SwapMetricsTracker {
  private metrics: Partial<SwapMetrics> = {};
  private startTime: number = 0;
  private checkpoints: Map<string, number> = new Map();
  private logger: StructuredLogger;
  
  constructor(transactionId?: string) {
    this.logger = createLogger('SwapMetrics', { transactionId });
  }
  
  start(): void {
    this.startTime = performance.now();
    this.checkpoint('start');
  }
  
  checkpoint(name: string): void {
    this.checkpoints.set(name, performance.now());
  }
  
  setMetric<K extends keyof SwapMetrics>(key: K, value: SwapMetrics[K]): void {
    this.metrics[key] = value;
  }
  
  getDuration(from: string, to: string): number {
    const fromTime = this.checkpoints.get(from);
    const toTime = this.checkpoints.get(to);
    if (fromTime === undefined || toTime === undefined) return 0;
    return Math.round(toTime - fromTime);
  }
  
  finalize(success: boolean): SwapMetrics {
    const now = performance.now();
    this.checkpoint('end');
    
    const finalMetrics: SwapMetrics = {
      totalDurationMs: Math.round(now - this.startTime),
      quoteFetchMs: this.getDuration('start', 'quote_fetched'),
      simulationMs: this.getDuration('quote_fetched', 'simulated'),
      signingMs: this.getDuration('simulated', 'signed'),
      confirmationMs: this.getDuration('signed', 'confirmed'),
      actualSlippageBps: this.metrics.actualSlippageBps || 0,
      inputAmount: this.metrics.inputAmount || 0,
      outputAmount: this.metrics.outputAmount || 0,
      npiBps: this.metrics.npiBps || 0,
      venue: this.metrics.venue || 'unknown',
      success,
    };
    
    this.logger.metric('Swap metrics finalized', finalMetrics as unknown as Record<string, number>);
    
    // Envoyer à l'analytics
    trackEvent('swap_completed', {
      ...finalMetrics,
      sessionId: getSessionId(),
    });
    
    return finalMetrics;
  }
}

// ============================================================================
// ANALYTICS
// ============================================================================

export function trackEvent(event: string, properties: Record<string, unknown>): void {
  const analyticsEvent: AnalyticsEvent = {
    event,
    properties,
    timestamp: Date.now(),
    sessionId: getSessionId() || undefined,
  };
  
  analyticsBuffer.push(analyticsEvent);
  
  // Flush si buffer plein
  if (analyticsBuffer.length >= MAX_BUFFER_SIZE) {
    flushAnalytics();
  }
}

export function flushAnalytics(): void {
  if (analyticsBuffer.length === 0) return;
  
  const eventsToSend = [...analyticsBuffer];
  analyticsBuffer = [];
  
  // Envoyer au backend (si disponible)
  if (typeof window !== 'undefined') {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: eventsToSend }),
      keepalive: true, // Permet l'envoi même si la page se ferme
    }).catch(() => {
      // Silencieux - analytics non critique
    });
  }
}

// Auto-flush périodique
if (typeof window !== 'undefined') {
  setInterval(flushAnalytics, ANALYTICS_FLUSH_INTERVAL);
  
  // Flush avant fermeture de page
  window.addEventListener('beforeunload', flushAnalytics);
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createLogger(component: string, context?: Partial<LogContext>): StructuredLogger {
  return new StructuredLogger(component, context);
}

export function createSwapTracker(transactionId?: string): SwapMetricsTracker {
  return new SwapMetricsTracker(transactionId);
}

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

// ============================================================================
// PRE-CONFIGURED LOGGERS
// ============================================================================

export const routerLogger = createLogger('NativeRouter');
export const quoteLogger = createLogger('QuoteService');
export const simulationLogger = createLogger('Simulation');
export const transactionLogger = createLogger('Transaction');
export const cacheLogger = createLogger('Cache');
export const oracleLogger = createLogger('Oracle');

// ============================================================================
// EXPORTS
// ============================================================================

export {
  StructuredLogger,
  SwapMetricsTracker,
};

export default {
  createLogger,
  createSwapTracker,
  trackEvent,
  flushAnalytics,
  setLogLevel,
  initSession,
  getSessionId,
};
