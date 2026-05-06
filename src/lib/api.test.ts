import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient } from '@/lib/api'

type MockResponse = {
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
  clone: () => MockResponse
  headers: Headers
}

// Mock fetch globally
const fetchMock = vi.fn()
global.fetch = fetchMock

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    ApiClient.clearCache()
    ApiClient.clearResponseCache()
  })

  // Helper to create mock Response
  const createMockResponse = (body: unknown, options: { status?: number; ok?: boolean } = {}): MockResponse => {
    const { status = 200, ok = true } = options
    return {
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: () => Promise.resolve(body),
      clone: () => createMockResponse(body, options),
      headers: new Headers(),
    }
  }

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { data: 'test' }
      fetchMock.mockResolvedValueOnce(createMockResponse(mockResponse))

      const result = await ApiClient.get('/test')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockResponse)
    })

    it('should handle GET request errors', async () => {
      fetchMock.mockResolvedValueOnce(createMockResponse({ error: 'Not found' }, { status: 404, ok: false }))

      await expect(ApiClient.get('/test')).rejects.toThrow()
    })

    it('should cache GET responses', async () => {
      const mockResponse = { data: 'cached' }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        clone: () => ({ ok: true, json: () => Promise.resolve(mockResponse) }),
      })

      // First request
      await ApiClient.get('/cached', { cacheTtl: 5000 })
      // Second request (should use cache)
      await ApiClient.get('/cached', { cacheTtl: 5000 })

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('POST requests', () => {
    it('should make successful POST request', async () => {
      const mockResponse = { id: 1, created: true }
      const requestBody = { name: 'test' }

      fetchMock.mockResolvedValueOnce(createMockResponse(mockResponse))

      const result = await ApiClient.post('/create', requestBody)

      expect(result).toEqual(mockResponse)
    })
  })

  describe('Error handling', () => {
    it('should retry on network errors', async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce(createMockResponse({ success: true }))

      const result = await ApiClient.get('/retry-test')

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ success: true })
    })

    it('should not retry when skipRetry is true', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Network error'))

      await expect(
        ApiClient.get('/no-retry', { skipRetry: true })
      ).rejects.toThrow('Network error')

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('Request deduplication', () => {
    it.skip('should deduplicate concurrent GET requests', async () => {
      // TODO: Fix mock implementation for request deduplication testing
      fetchMock.mockResolvedValue(createMockResponse({ data: 'deduplicated' }))

      const promise1 = ApiClient.get('/dedup')
      const promise2 = ApiClient.get('/dedup')

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(result2)
    })
  })

  describe('Cache management', () => {
    it('should clear caches', () => {
      ApiClient.clearCache()
      ApiClient.clearResponseCache()

      const stats = ApiClient.getCacheStats()
      expect(stats.pendingRequests).toBe(0)
      expect(stats.cachedResponses).toBe(0)
    })
  })
})
