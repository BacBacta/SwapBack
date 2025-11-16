/**
 * Detailed logging system to capture errors
 * Records client-side and server-side errors with full context
 */

export interface ErrorLog {
  timestamp: string;
  error: {
    message: string;
    name: string;
    stack?: string;
    cause?: unknown;
  };
  context: {
    component?: string;
    action?: string;
    userAgent?: string;
    url?: string;
    pathname?: string;
  };
  environment: {
    isClient: boolean;
    isServer: boolean;
    network?: string;
    hasWallet?: boolean;
  };
  additionalData?: Record<string, unknown>;
}

class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs = 100;

  /**
   * Record an error with full context
   */
  log(
    error: Error | unknown,
    context: {
      component?: string;
      action?: string;
      additionalData?: Record<string, unknown>;
    } = {}
  ): ErrorLog {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      error: this.serializeError(error),
      context: {
        component: context.component,
        action: context.action,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "server",
        url: typeof window !== "undefined" ? window.location.href : "server",
        pathname: typeof window !== "undefined" ? window.location.pathname : "server",
      },
      environment: {
        isClient: typeof window !== "undefined",
        isServer: typeof window === "undefined",
        network: process.env.NEXT_PUBLIC_SOLANA_NETWORK,
        hasWallet: typeof window !== "undefined" && "solana" in window,
      },
      additionalData: context.additionalData,
    };

    // Add to buffer
    this.logs.push(errorLog);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log console détaillé
    this.logToConsole(errorLog);

    // Envoyer au serveur si côté client
    if (typeof window !== "undefined") {
      this.sendToServer(errorLog).catch(console.error);
    }

    return errorLog;
  }

  /**
   * Serialize an error for logging
   */
  private serializeError(error: unknown): ErrorLog["error"] {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
      };
    }

    if (typeof error === "string") {
      return {
        message: error,
        name: "StringError",
      };
    }

    return {
      message: JSON.stringify(error),
      name: "UnknownError",
    };
  }

  /**
   * Display error in console with formatting
   */
  private logToConsole(log: ErrorLog): void {
    console.group(`🔴 ERROR: ${log.error.name}`);
    console.error("Message:", log.error.message);
    console.error("Timestamp:", log.timestamp);
    
    if (log.context.component) {
      console.error("Component:", log.context.component);
    }
    
    if (log.context.action) {
      console.error("Action:", log.context.action);
    }
    
    console.error("Environment:", {
      isClient: log.environment.isClient,
      network: log.environment.network,
      hasWallet: log.environment.hasWallet,
    });
    
    if (log.context.pathname) {
      console.error("Pathname:", log.context.pathname);
    }
    
    if (log.error.stack) {
      console.error("Stack trace:", log.error.stack);
    }
    
    if (log.additionalData && Object.keys(log.additionalData).length > 0) {
      console.error("Additional data:", log.additionalData);
    }
    
    console.groupEnd();
  }

  /**
   * Send error to server for persistence
   */
  private async sendToServer(log: ErrorLog): Promise<void> {
    try {
      await fetch("/api/log-error", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(log),
      });
    } catch (err) {
      // Silencieux - ne pas créer de boucle d'erreurs
      console.warn("Failed to send error to server:", err);
    }
  }

  /**
   * Récupère tous les logs
   */
  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  /**
   * Récupère les logs récents
   */
  getRecentLogs(count: number = 10): ErrorLog[] {
    return this.logs.slice(-count);
  }

  /**
   * Efface tous les logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Exporte les logs en JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Télécharge les logs
   */
  downloadLogs(): void {
    if (typeof window === "undefined") return;

    const blob = new Blob([this.exportLogs()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Instance singleton
export const errorLogger = new ErrorLogger();

/**
 * Hook React pour capturer les erreurs
 */
export function logError(
  error: Error | unknown,
  context?: {
    component?: string;
    action?: string;
    additionalData?: Record<string, unknown>;
  }
): ErrorLog {
  return errorLogger.log(error, context);
}

/**
 * Wrapper pour les fonctions async avec logging automatique
 */
export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: { component: string; action: string }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, context);
      throw error;
    }
  }) as T;
}

/**
 * Expose errorLogger globalement pour debug dans console
 */
if (typeof window !== "undefined") {
  (window as any).errorLogger = errorLogger;
  console.log(
    "💡 Error logger available globally. Use window.errorLogger.getLogs() to view logs."
  );
}
