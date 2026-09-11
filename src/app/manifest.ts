import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AlphaClone',
    short_name: 'AlphaClone',
    description: 'Your business operating system — CRM, mail, billing, and projects.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'minimal-ui', 'standalone'],
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'any',
    icons: [
      { src: '/favicon-48x48.png', sizes: '48x48', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['business', 'productivity', 'utilities'],
    shortcuts: [
      {
        name: 'Home',
        short_name: 'Home',
        url: '/dashboard',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'CRM',
        short_name: 'CRM',
        url: '/dashboard/crm',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Mail',
        short_name: 'Mail',
        url: '/dashboard/mail',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Clients',
        short_name: 'Clients',
        url: '/dashboard/leads',
        icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
