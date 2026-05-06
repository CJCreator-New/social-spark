import { http, HttpResponse } from 'msw'
import { mockUser, mockCalendar, mockProfile, mockScheduledPosts, mockApiResponses } from './mocks'

export const handlers = [
  // Auth endpoints
  http.post('*/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: mockUser,
    })
  }),

  // Profile endpoints
  http.get('*/rest/v1/profiles', ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')

    if (userId === 'eq.' + mockUser.id) {
      return HttpResponse.json([mockProfile])
    }

    return HttpResponse.json([])
  }),

  // Calendar endpoints
  http.get('*/rest/v1/saved_calendars', ({ request }) => {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (id === 'eq.' + mockCalendar.id) {
      return HttpResponse.json([mockCalendar])
    }

    return HttpResponse.json([mockCalendar]) // Return mock calendar for general queries
  }),

  http.post('*/rest/v1/saved_calendars', () => {
    return HttpResponse.json([{
      ...mockCalendar,
      id: 'new-calendar-id',
      created_at: new Date().toISOString(),
    }])
  }),

  // Scheduled posts endpoints
  http.get('*/rest/v1/scheduled_posts', ({ request }) => {
    const url = new URL(request.url)
    const calendarId = url.searchParams.get('calendar_id')

    if (calendarId === 'eq.' + mockCalendar.id) {
      return HttpResponse.json(mockScheduledPosts)
    }

    return HttpResponse.json([])
  }),

  // Edge function endpoints
  http.post('*/functions/v1/generate-calendar', () => {
    return HttpResponse.json(mockApiResponses.generateCalendar)
  }),

  http.post('*/functions/v1/generate-single-post', () => {
    return HttpResponse.json(mockApiResponses.generateSinglePost)
  }),

  http.post('*/functions/v1/regenerate-post', () => {
    return HttpResponse.json(mockApiResponses.regeneratePost)
  }),

  // Error simulation
  http.get('*/api/error-test', () => {
    return HttpResponse.json(
      { error: 'Test error' },
      { status: 500 }
    )
  }),

  http.get('*/api/rate-limit-test', () => {
    return HttpResponse.json(
      { error: 'Rate limited' },
      {
        status: 429,
        headers: {
          'retry-after': '60',
        },
      }
    )
  }),

  http.get('*/api/timeout-test', async () => {
    // Simulate slow response
    await new Promise(resolve => setTimeout(resolve, 35000))
    return HttpResponse.json({ data: 'timeout' })
  }),
]