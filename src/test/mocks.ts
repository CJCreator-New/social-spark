import { Post, FormPayload } from '@/lib/types'

// Mock user data
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: {
    display_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
  },
}

// Mock calendar data
export const mockCalendar = {
  id: 'test-calendar-id',
  user_id: 'test-user-id',
  title: 'Test Marketing Calendar',
  industry: 'marketing',
  industry_label: 'Marketing & Growth',
  platform: 'LinkedIn',
  core_idea: 'Content marketing strategies for B2B companies',
  form_payload: {
    industry: 'marketing',
    platform: 'LinkedIn',
    voice: 'Professional',
    style: 'Educational',
    goals: ['brand-awareness', 'lead-generation'],
    audiences: ['marketing-managers', 'business-owners'],
  } as FormPayload,
  posts: [
    {
      day: 1,
      dow: 'Mon',
      topic: 'Social Media Strategy',
      format: 'Article',
      title: '5 Essential LinkedIn Strategies for B2B Marketers',
      hook: 'Is your LinkedIn strategy driving real results?',
      body: 'In today\'s competitive B2B landscape...',
      cta: 'Download our free LinkedIn strategy guide',
      hashtags: '#LinkedInMarketing #B2BMarketing #SocialMediaStrategy',
      rationale: 'Educational content builds trust and authority',
    },
  ] as Post[],
  created_at: '2024-01-01T00:00:00Z',
  is_favorite: false,
  timezone: 'America/New_York',
  tracking_url: 'https://example.com/track',
  locked_hashtags: {},
}

// Mock profile data
export const mockProfile = {
  id: 'test-profile-id',
  user_id: 'test-user-id',
  display_name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg',
  default_voice: 'Professional',
  default_style: 'Educational',
  default_audiences: ['marketing-managers'],
  default_goals: ['brand-awareness'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// Mock scheduled posts
export const mockScheduledPosts = [
  {
    id: 'scheduled-1',
    calendar_id: 'test-calendar-id',
    post_day: 1,
    platform: 'LinkedIn',
    scheduled_at: '2024-01-08T09:00:00Z',
    status: 'scheduled',
    workflow_status: 'drafted' as const,
    copy_text: 'Sample post content...',
    post_snapshot: mockCalendar.posts[0],
    created_at: '2024-01-01T00:00:00Z',
  },
]

// Mock API responses
export const mockApiResponses = {
  generateCalendar: {
    posts: mockCalendar.posts,
    success: true,
  },
  generateSinglePost: {
    posts: [mockCalendar.posts[0]],
    success: true,
  },
  regeneratePost: {
    post: mockCalendar.posts[0],
    success: true,
  },
}

// Factory functions for generating test data
export const createMockCalendar = (overrides = {}) => ({
  ...mockCalendar,
  id: `calendar-${Math.random().toString(36).substr(2, 9)}`,
  ...overrides,
})

export const createMockUser = (overrides = {}) => ({
  ...mockUser,
  id: `user-${Math.random().toString(36).substr(2, 9)}`,
  ...overrides,
})

export const createMockPost = (overrides = {}) => ({
  ...mockCalendar.posts[0],
  day: Math.floor(Math.random() * 7) + 1,
  ...overrides,
})