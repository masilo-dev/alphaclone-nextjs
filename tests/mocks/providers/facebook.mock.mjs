/** Opt-in Facebook Graph API mock for staging integration tests. */
export function mockFacebookPhotoPublishSuccess(pageId = 'page-1') {
  return {
    id: `${pageId}_photo_123`,
    post_id: `${pageId}_post_456`,
  };
}

export function mockFacebookGraphError(overrides = {}) {
  return {
    error: {
      message: 'An unknown error has occurred.',
      type: 'OAuthException',
      code: 190,
      error_subcode: 460,
      fbtrace_id: 'MOCK-TRACE-001',
      error_user_msg: 'Mock page token expired',
      ...overrides,
    },
  };
}
