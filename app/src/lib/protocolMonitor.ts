/**
 * Protocol Monitor - Centralized error and warning tracking for SwapBack
 * Captures all protocol events, errors, and warnings for admin monitoring
 */

export type LogLevel = 'error' | 'warning' | 'info' | 'critical';

export type LogCategory = 
  | 'swap' 
  | 'dca' 
  | 'buyback' 
  | 'wallet' 
  | 'rpc' 
  | 'transaction' 
  | 'auth' 
  | 'api' 
  | 'protocol' 
  | 'ui'
  | 'system';

export interface ProtocolLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  title: string;
  message: string;
  details?: {
    errorCode?: string;
    transactionId?: string;
    walletAddress?: string;
    amount?: string;
    tokenMint?: string;
    component?: string;
    action?: string;
    stack?: string;
    rpcEndpoint?: string;
    httpStatus?: number;
    retryCount?: number;
  };
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

// In-memory store (will be persisted via API)
class ProtocolMonitor {
  private logs: ProtocolLog[] = [];
  private maxLogs = 500;
  private listeners: Set<(logs: ProtocolLog[]) => void> = new Set();

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Log a protocol event
   */
  log(
    level: LogLevel,
    category: LogCategory,
    title: string,
    message: string,
    details?: ProtocolLog['details']
  ): ProtocolLog {
    const log: ProtocolLog = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      category,
      title,
      message,
      details,
      resolved: false,
    };

    this.logs.unshift(log);
    
    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Notify listeners
    this.notifyListeners();

    // Console output with color
    this.logToConsole(log);

    // Send to server
    this.sendToServer(log);

    return log;
  }

  /**
   * Shorthand methods
   */
  error(category: LogCategory, title: string, message: string, details?: ProtocolLog['details']): ProtocolLog {
    return this.log('error', category, title, message, details);
  }

  warning(category: LogCategory, title: string, message: string, details?: ProtocolLog['details']): ProtocolLog {
    return this.log('warning', category, title, message, details);
  }

  info(category: LogCategory, title: string, message: string, details?: ProtocolLog['details']): ProtocolLog {
    return this.log('info', category, title, message, details);
  }

  critical(category: LogCategory, title: string, message: string, details?: ProtocolLog['details']): ProtocolLog {
    return this.log('critical', category, title, message, details);
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(log: ProtocolLog): void {
    const icons: Record<LogLevel, string> = {
      critical: '🚨',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };

    const colors: Record<LogLevel, string> = {
      critical: 'color: #ff0000; font-weight: bold',
      error: 'color: #ff6b6b',
      warning: 'color: #ffa500',
      info: 'color: #4dabf7',
    };

    console.log(
      `%c${icons[log.level]} [${log.category.toUpperCase()}] ${log.title}`,
      colors[log.level]
    );
    console.log(`   ${log.message}`);
    
    if (log.details) {
      console.log('   Details:', log.details);
    }
  }

  /**
   * Send log to server for persistence
   */
  private async sendToServer(log: ProtocolLog): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      await fetch('/api/protocol-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
    } catch {
      // Silent fail - don't create error loops
    }
  }

  /**
   * Subscribe to log updates
   */
  subscribe(callback: (logs: ProtocolLog[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const logs = this.getLogs();
    this.listeners.forEach(callback => callback(logs));
  }

  /**
   * Get all logs
   */
  getLogs(): ProtocolLog[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): ProtocolLog[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs by category
   */
  getLogsByCategory(category: LogCategory): ProtocolLog[] {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * Get unresolved logs
   */
  getUnresolvedLogs(): ProtocolLog[] {
    return this.logs.filter(log => !log.resolved);
  }

  /**
   * Get critical and error logs
   */
  getCriticalLogs(): ProtocolLog[] {
    return this.logs.filter(log => log.level === 'critical' || log.level === 'error');
  }

  /**
   * Mark log as resolved
   */
  resolveLog(id: string, resolvedBy?: string): void {
    const log = this.logs.find(l => l.id === id);
    if (log) {
      log.resolved = true;
      log.resolvedAt = new Date().toISOString();
      log.resolvedBy = resolvedBy;
      this.notifyListeners();
    }
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.notifyListeners();
  }

  /**
   * Get log counts by level
   */
  getCounts(): Record<LogLevel, number> {
    return {
      critical: this.logs.filter(l => l.level === 'critical').length,
      error: this.logs.filter(l => l.level === 'error').length,
      warning: this.logs.filter(l => l.level === 'warning').length,
      info: this.logs.filter(l => l.level === 'info').length,
    };
  }

  /**
   * Get unresolved counts
   */
  getUnresolvedCounts(): Record<LogLevel, number> {
    const unresolved = this.getUnresolvedLogs();
    return {
      critical: unresolved.filter(l => l.level === 'critical').length,
      error: unresolved.filter(l => l.level === 'error').length,
      warning: unresolved.filter(l => l.level === 'warning').length,
      info: unresolved.filter(l => l.level === 'info').length,
    };
  }

  /**
   * Load logs from server
   */
  async loadFromServer(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const response = await fetch('/api/protocol-logs');
      if (response.ok) {
        const data = await response.json();
        if (data.logs && Array.isArray(data.logs)) {
          this.logs = data.logs;
          this.notifyListeners();
        }
      }
    } catch {
      // Silent fail
    }
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Download logs file
   */
  downloadLogs(): void {
    if (typeof window === 'undefined') return;

    const blob = new Blob([this.exportLogs()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Singleton instance
export const protocolMonitor = new ProtocolMonitor();

// Expose globally for debugging
if (typeof window !== 'undefined') {
  (window as any).protocolMonitor = protocolMonitor;
}

/**
 * Helper functions for common error patterns
 */
export const monitor = {
  // Swap errors
  swapError: (message: string, details?: ProtocolLog['details']) => 
    protocolMonitor.error('swap', 'Swap Failed', message, details),
  
  swapWarning: (message: string, details?: ProtocolLog['details']) => 
    protocolMonitor.warning('swap', 'Swap Warning', message, details),

  // DCA errors
  dcaError: (message: string, details?: ProtocolLog['details']) => 
    protocolMonitor.error('dca', 'DCA Error', message, details),
  
  dcaWarning: (message: string, details?: ProtocolLog['details']) => 
    protocolMonitor.warning('dca', 'DCA Warning', message, details),

  // Wallet errors
  walletError: (message: string, details?: ProtocolLog['details']) => 
    protocolMonitor.error('wallet', 'Wallet Error', message, details),
  
  walletDisconnected: (address?: string) => 
    protocolMonitor.warning('wallet', 'Wallet Disconnected', 
      `Wallet ${address ? address.slice(0,8) + '...' : ''} disconnected unexpectedly`),

  // RPC errors
  rpcError: (message: string, details?: ProtocolLog['details']) => 
    protocolMonitor.error('rpc', 'RPC Error', message, details),
  
  rpcTimeout: (endpoint?: string) => 
    protocolMonitor.warning('rpc', 'RPC Timeout', 
      `RPC request timed out${endpoint ? ` for ${endpoint}` : ''}`, { rpcEndpoint: endpoint }),

  // Transaction errors
  txError: (message: string, txId?: string, details?: ProtocolLog['details']) => 
    protocolMonitor.error('transaction', 'Transaction Failed', message, { ...details, transactionId: txId }),
  
  txTimeout: (txId?: string) => 
    protocolMonitor.warning('transaction', 'Transaction Timeout', 
      `Transaction confirmation timed out`, { transactionId: txId }),

  // Buyback errors
  buybackError: (message: string, details?: ProtocolLog['details']) => 
    protocolMonitor.error('buyback', 'Buyback Error', message, details),

  // API errors
  apiError: (message: string, status?: number, details?: ProtocolLog['details']) => 
    protocolMonitor.error('api', 'API Error', message, { ...details, httpStatus: status }),

  // Protocol critical
  protocolPaused: () => 
    protocolMonitor.critical('protocol', 'Protocol Paused', 
      'The protocol has been paused by the authority'),
  
  protocolResumed: () => 
    protocolMonitor.info('protocol', 'Protocol Resumed', 
      'The protocol has been resumed'),

  // Auth errors
  authError: (message: string, details?: ProtocolLog['details']) => 
    protocolMonitor.error('auth', 'Authorization Error', message, details),
  
  unauthorizedAccess: (action: string) => 
    protocolMonitor.warning('auth', 'Unauthorized Access Attempt', 
      `Unauthorized attempt to ${action}`, { action }),

  // System
  systemError: (message: string, details?: ProtocolLog['details']) => 
    protocolMonitor.error('system', 'System Error', message, details),

  // Low balance warnings
  lowBalance: (wallet: string, balance: number, threshold: number) => 
    protocolMonitor.warning('protocol', 'Low Balance Alert', 
      `${wallet} wallet balance (${balance}) is below threshold (${threshold})`),

  // Success info
  swapSuccess: (amount: string, fromToken: string, toToken: string, txId?: string) => 
    protocolMonitor.info('swap', 'Swap Successful', 
      `Swapped ${amount} ${fromToken} to ${toToken}`, { transactionId: txId }),

  dcaExecuted: (orderId: string, txId?: string) => 
    protocolMonitor.info('dca', 'DCA Executed', 
      `DCA order ${orderId} executed successfully`, { transactionId: txId }),

  buybackExecuted: (amount: string, txId?: string) => 
    protocolMonitor.info('buyback', 'Buyback Executed', 
      `Buyback of ${amount} BACK executed`, { transactionId: txId }),
};

export default protocolMonitor;
