import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AlphaClone Systems - Enterprise Platform',
    short_name: 'AlphaClone',
    description:
      'Enterprise-grade project management and communication platform with AI integration',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'minimal-ui'],
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'portrait',
    icons: [
      { src: '/favicon-48x48.png', sizes: '48x48', type: 'image/png', purpose: 'any maskable' },
      { src: '/favicon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any maskable' },
      { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    categories: ['business', 'productivity', 'utilities'],
    screenshots: [{ src: '/logo.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide' }],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Home',
        description: 'Open main dashboard',
        url: '/dashboard',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Messages',
        short_name: 'Chat',
        description: 'Quick access to your messages',
        url: '/dashboard/messages',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Meetings',
        short_name: 'Video',
        description: 'Join your scheduled meetings',
        url: '/dashboard/business/meetings',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
