import { describe, it, expect } from 'vitest'
import {
  AppError,
  NetworkError,
  ValidationError,
  AuthError,
  RateLimitError,
  TimeoutError,
  APIError,
  isAppError,
  getUserFriendlyMessage,
  getDeveloperMessage,
} from '@/lib/errors'

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test message', 'TEST_CODE', 400, true, { extra: 'data' })

      expect(error.message).toBe('Test message')
      expect(error.code).toBe('TEST_CODE')
      expect(error.statusCode).toBe(400)
      expect(error.isRetryable).toBe(true)
      expect(error.context).toEqual({ extra: 'data' })
    })

    it('should serialize to JSON', () => {
      const error = new AppError('Test', 'TEST', 500, false, { test: true })

      const json = error.toJSON()

      expect(json).toEqual({
        name: 'AppError',
        message: 'Test',
        code: 'TEST',
        statusCode: 500,
        isRetryable: false,
        context: { test: true },
      })
    })
  })

  describe('NetworkError', () => {
    it('should create NetworkError with retryable default', () => {
      const error = new NetworkError('Connection failed')

      expect(error.message).toBe('Connection failed')
      expect(error.code).toBe('NETWORK_ERROR')
      expect(error.statusCode).toBe(0)
      expect(error.isRetryable).toBe(true)
    })

    it('should allow overriding retryable', () => {
      const error = new NetworkError('Auth failed', false)

      expect(error.isRetryable).toBe(false)
    })
  })

  describe('ValidationError', () => {
    it('should create ValidationError as non-retryable', () => {
      const error = new ValidationError('Invalid input')

      expect(error.message).toBe('Invalid input')
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.statusCode).toBe(400)
      expect(error.isRetryable).toBe(false)
    })
  })

  describe('AuthError', () => {
    it('should create AuthError with defaults', () => {
      const error = new AuthError()

      expect(error.message).toBe('Unauthorized')
      expect(error.code).toBe('AUTH_ERROR')
      expect(error.statusCode).toBe(401)
      expect(error.isRetryable).toBe(false)
    })
  })

  describe('RateLimitError', () => {
    it('should create RateLimitError with retry after', () => {
      const error = new RateLimitError('Too many requests', 30000)

      expect(error.message).toBe('Too many requests')
      expect(error.code).toBe('RATE_LIMIT_ERROR')
      expect(error.statusCode).toBe(429)
      expect(error.isRetryable).toBe(true)
      expect(error.getRetryAfter()).toBe(30000)
    })

    it('should default retry after to 5 seconds', () => {
      const error = new RateLimitError()

      expect(error.getRetryAfter()).toBe(5000)
    })
  })

  describe('TimeoutError', () => {
    it('should create TimeoutError', () => {
      const error = new TimeoutError('Request timed out', 10000)

      expect(error.message).toBe('Request timed out')
      expect(error.code).toBe('TIMEOUT_ERROR')
      expect(error.statusCode).toBe(408)
      expect(error.isRetryable).toBe(true)
      expect(error.context?.durationMs).toBe(10000)
    })
  })

  describe('APIError', () => {
    it('should create APIError as retryable for server errors', () => {
      const error = new APIError('Server error', 500)

      expect(error.code).toBe('API_ERROR')
      expect(error.statusCode).toBe(500)
      expect(error.isRetryable).toBe(true)
    })

    it('should create APIError as non-retryable for client errors', () => {
      const error = new APIError('Bad request', 400)

      expect(error.statusCode).toBe(400)
      expect(error.isRetryable).toBe(false)
    })
  })
})

describe('Error Utilities', () => {
  describe('isAppError', () => {
    it('should identify AppError instances', () => {
      expect(isAppError(new AppError('test'))).toBe(true)
      expect(isAppError(new Error('test'))).toBe(false)
      expect(isAppError('string')).toBe(false)
      expect(isAppError(null)).toBe(false)
    })
  })

  describe('getUserFriendlyMessage', () => {
    it('should return message for AppError', () => {
      const error = new NetworkError('Connection failed')
      expect(getUserFriendlyMessage(error)).toBe('Connection failed')
    })

    it('should convert generic errors to user-friendly messages', () => {
      expect(getUserFriendlyMessage(new Error('network error'))).toBe('Connection error. Please check your internet and try again.')
      expect(getUserFriendlyMessage(new Error('timeout'))).toBe('Request took too long. Please try again.')
      expect(getUserFriendlyMessage(new Error('some other error'))).toBe('Something went wrong. Please try again.')
    })

    it('should handle string inputs', () => {
      expect(getUserFriendlyMessage('Custom error')).toBe('Custom error')
    })

    it('should handle non-error inputs', () => {
      expect(getUserFriendlyMessage({})).toBe('An unexpected error occurred. Please try again.')
    })
  })

  describe('getDeveloperMessage', () => {
    it('should format AppError with context', () => {
      const error = new APIError('Server error', 500, 'TEST_ERROR', { url: '/api/test' })
      const message = getDeveloperMessage(error)

      expect(message).toContain('[TEST_ERROR] Server error')
      expect(message).toContain('{"url":"/api/test"}')
    })

    it('should format generic Error', () => {
      const error = new Error('Test error')
      error.name = 'CustomError'

      const message = getDeveloperMessage(error)
      expect(message).toBe('CustomError: Test error')
    })

    it('should handle non-error inputs', () => {
      expect(getDeveloperMessage('string')).toBe('string')
      expect(getDeveloperMessage({})).toBe('[object Object]')
    })
  })
})