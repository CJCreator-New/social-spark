/**
 * Centralized Error Logger for Social Spark
 * Integrates with error tracking services (Sentry, LogRocket)
 */

import { isAppError, getDeveloperMessage } from './errors';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  path?: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  error?: unknown;
  context?: LogContext;
  timestamp: number;
}

interface SentryLike {
  captureException: (error: unknown, options?: { contexts?: { app?: LogContext } }) => void;
  captureMessage: (message: string, level?: 'warning' | 'info') => void;
}

type WindowWithSentry = Window & {
  Sentry?: SentryLike;
};

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  /**
   * Check if error tracking service is configured
   */
  private isErrorTrackingConfigured(): boolean {
    // Check for Sentry or similar
    return typeof window !== 'undefined' && !!(window as WindowWithSentry).Sentry;
  }

  /**
   * Send to external error tracking service
   */
  private sendToExternalService(level: LogLevel, message: string, error?: unknown, context?: LogContext) {
    try {
      const Sentry = (window as WindowWithSentry).Sentry;
      if (!Sentry) return;

      const messageStr = `${message}${error ? ` - ${getDeveloperMessage(error)}` : ''}`;

      if (level === 'error') {
        Sentry.captureException(error || new Error(messageStr), {
          contexts: { app: context },
        });
      } else if (level === 'warn') {
        Sentry.captureMessage(messageStr, 'warning');
      } else if (level === 'info') {
        Sentry.captureMessage(messageStr, 'info');
      }
    } catch (e) {
      // Prevent logger errors from breaking the app
      console.warn('Failed to send log to external service', e);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext) {
    this.log('debug', message, undefined, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext) {
    this.log('info', message, undefined, context);
  }

  /**
   * Log warning
   */
  warn(message: string, error?: unknown, context?: LogContext) {
    this.log('warn', message, error, context);
  }

  /**
   * Log error
   */
  error(message: string, error?: unknown, context?: LogContext) {
    this.log('error', message, error, context);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, error?: unknown, context?: LogContext) {
    const timestamp = Date.now();
    const entry: LogEntry = { level, message, error, context, timestamp };

    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Keep only last 100 logs
    }

    // Console output (always)
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    const consoleFn = (console[consoleMethod as 'log' | 'warn' | 'error'] as (...args: unknown[]) => void).bind(console);
    consoleFn(
      `[${level.toUpperCase()}] ${message}`,
      error ? getDeveloperMessage(error) : '',
      context || ''
    );

    // Send to external service
    if (['error', 'warn'].includes(level)) {
      this.sendToExternalService(level, message, error, context);
    }
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 20): LogEntry[] {
    return this.logs.slice(-limit);
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON (for debugging)
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Singleton instance
export const logger = new Logger();

/**
 * Global error handler for uncaught errors
 */
export function setupGlobalErrorHandlers() {
  // Handle uncaught errors
  window.addEventListener('error', (event: ErrorEvent) => {
    logger.error('Uncaught error', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    logger.error('Unhandled promise rejection', event.reason);
  });
}

/**
 * Create a scoped logger for a specific component or module
 */
export function createScopedLogger(scope: string) {
  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(`[${scope}] ${message}`, context),
    info: (message: string, context?: LogContext) => logger.info(`[${scope}] ${message}`, context),
    warn: (message: string, error?: unknown, context?: LogContext) =>
      logger.warn(`[${scope}] ${message}`, error, context),
    error: (message: string, error?: unknown, context?: LogContext) =>
      logger.error(`[${scope}] ${message}`, error, context),
  };
}
