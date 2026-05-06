/**
 * Custom Error Types for Social Spark
 * Provides structured error handling across the application
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isRetryable: boolean = false,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
      context: this.context,
    };
  }
}

export class NetworkError extends AppError {
  constructor(message: string, isRetryable: boolean = true, context?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', 0, isRetryable, context);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, false, context);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Unauthorized', isRetryable: boolean = false) {
    super(message, 'AUTH_ERROR', 401, isRetryable);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', retryAfterMs?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429, true, { retryAfterMs });
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }

  getRetryAfter(): number {
    return (this.context?.retryAfterMs as number) || 5000;
  }
}

export class TimeoutError extends AppError {
  constructor(message: string = 'Request timeout', durationMs?: number) {
    super(message, 'TIMEOUT_ERROR', 408, true, { durationMs });
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export class APIError extends AppError {
  constructor(message: string, statusCode: number, code: string = 'API_ERROR', context?: Record<string, unknown>) {
    const isRetryable = statusCode >= 500 || statusCode === 429;
    super(message, code, statusCode, isRetryable, context);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

export class StorageError extends AppError {
  constructor(message: string, code: string = 'STORAGE_ERROR', context?: Record<string, unknown>) {
    super(message, code, 500, false, context);
    this.name = 'StorageError';
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Extract user-friendly message from any error
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    // Avoid exposing stack traces to users
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return 'Connection error. Please check your internet and try again.';
    }
    if (message.includes('timeout')) {
      return 'Request took too long. Please try again.';
    }
    return 'Something went wrong. Please try again.';
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Extract developer-friendly message from any error
 */
export function getDeveloperMessage(error: unknown): string {
  if (isAppError(error)) {
    return `[${error.code}] ${error.message}${error.context ? ` - ${JSON.stringify(error.context)}` : ''}`;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}
