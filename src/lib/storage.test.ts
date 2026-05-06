import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StorageService } from '@/lib/storage'

vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('StorageService', () => {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    })
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockImplementation(() => {})
    localStorageMock.removeItem.mockImplementation(() => {})
    localStorageMock.clear.mockImplementation(() => {})
    localStorageMock.key.mockImplementation(() => null)
    localStorageMock.length = 0
  })

  afterEach(() => {
    StorageService.clearAll()
  })

  describe('set and get', () => {
    it('should store and retrieve data', () => {
      const testData = { name: 'test', value: 42 }

      StorageService.set('test-key', testData)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        expect.stringContaining(JSON.stringify(testData))
      )
    })

    it('should return stored data', () => {
      const testData = { message: 'hello' }
      const storedPayload = {
        version: 1,
        data: testData,
        timestamp: Date.now(),
      }

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedPayload))

      const result = StorageService.get('test-key')

      expect(result).toEqual(testData)
    })

    it('should return null for non-existent keys', () => {
      const result = StorageService.get('non-existent')

      expect(result).toBeNull()
    })

    it('should handle corrupted data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json')

      const result = StorageService.get('corrupted')

      expect(result).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('corrupted')
    })
  })

  describe('TTL functionality', () => {
    it('should expire data after TTL', () => {
      const testData = { temp: 'data' }
      const pastTime = Date.now() - 10000 // 10 seconds ago
      const storedPayload = {
        version: 1,
        data: testData,
        timestamp: pastTime,
        ttlMs: 5000, // 5 second TTL
      }

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedPayload))

      const result = StorageService.get('expired')

      expect(result).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('expired')
    })

    it('should keep data within TTL', () => {
      const testData = { valid: 'data' }
      const recentTime = Date.now() - 1000 // 1 second ago
      const storedPayload = {
        version: 1,
        data: testData,
        timestamp: recentTime,
        ttlMs: 5000, // 5 second TTL
      }

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedPayload))

      const result = StorageService.get('valid')

      expect(result).toEqual(testData)
    })
  })

  describe('validation', () => {
    it('should validate data with custom validator', () => {
      const testData = { count: 5 }
      const storedPayload = {
        version: 1,
        data: testData,
        timestamp: Date.now(),
      }

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedPayload))

      const validator = (data: unknown) =>
        typeof data === 'object' && data !== null && 'count' in data && Number((data as { count: unknown }).count) > 10
      const result = StorageService.get('validated', validator)

      expect(result).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('validated')
    })

    it('should pass validation', () => {
      const testData = { count: 15 }
      const storedPayload = {
        version: 1,
        data: testData,
        timestamp: Date.now(),
      }

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedPayload))

      const validator = (data: unknown) =>
        typeof data === 'object' && data !== null && 'count' in data && Number((data as { count: unknown }).count) > 10
      const result = StorageService.get('validated', validator)

      expect(result).toEqual(testData)
    })
  })

  describe('storage operations', () => {
    it('should remove items', () => {
      StorageService.remove('test-key')

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key')
    })

    it('should check if key exists', () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'existing' ? '{"version":1,"data":"test","timestamp":1234567890}' : null
      )

      expect(StorageService.has('existing')).toBe(true)
      expect(StorageService.has('non-existing')).toBe(false)
    })

    it('should clear all data', () => {
      StorageService.clearAll()

      expect(localStorageMock.clear).toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('should cleanup expired items', () => {
      const expiredPayload = {
        version: 1,
        data: { old: 'data' },
        timestamp: Date.now() - (40 * 24 * 60 * 60 * 1000), // 40 days ago
      }
      const validPayload = {
        version: 1,
        data: { fresh: 'data' },
        timestamp: Date.now(),
      }

      localStorageMock.key
        .mockReturnValueOnce('expired-key')
        .mockReturnValueOnce('valid-key')
        .mockReturnValueOnce(null)
      localStorageMock.length = 2

      localStorageMock.getItem
        .mockImplementation((key: string) => {
          if (key === 'expired-key') return JSON.stringify(expiredPayload)
          if (key === 'valid-key') return JSON.stringify(validPayload)
          return null
        })

      StorageService.cleanup(30) // 30 day cleanup

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('expired-key')
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('valid-key')
    })
  })
})
