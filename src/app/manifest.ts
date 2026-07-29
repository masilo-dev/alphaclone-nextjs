import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
<<<<<<< HEAD
    name: 'AlphaClone — AI Business Operating System',
    short_name: 'AlphaClone',
    description: 'Run CRM, work, money, communications, documents, and AI-assisted operations in one secure workspace.',
    id: '/dashboard?source=pwa',
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'minimal-ui', 'standalone'],
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'any',
    icons: [
      { src: '/favicon-48x48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
      { src: '/favicon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['business', 'productivity', 'utilities'],
    shortcuts: [
      {
        name: 'Home',
        short_name: 'Home',
=======
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
      { src: '/favicon-48x48.png', sizes: '48x48', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['business', 'productivity', 'utilities'],
    screenshots: [{ src: '/logo.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide' }],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Home',
        description: 'Open main dashboard',
>>>>>>> origin/main
        url: '/dashboard',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
<<<<<<< HEAD
        name: 'CRM',
        short_name: 'CRM',
        url: '/dashboard/crm',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Work',
        short_name: 'Work',
        url: '/dashboard/projects',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Money',
        short_name: 'Money',
        url: '/dashboard/finance',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Bonnie AI',
        short_name: 'Bonnie',
        url: '/dashboard/bonnie',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Communications',
        short_name: 'Comms',
        url: '/dashboard/comms',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
    share_target: {
      action: '/dashboard/share-intake',
      method: 'GET',
      enctype: 'application/x-www-form-urlencoded',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    },
=======
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
>>>>>>> origin/main
  };
}
