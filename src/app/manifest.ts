import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AlphaClone — AI Business Execution Layer',
    short_name: 'AlphaClone',
    description: 'Connect AI to authorized CRM, communication, project, document, social, and finance workflows in one secure workspace.',
    id: '/dashboard?source=pwa',
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    background_color: '#212446',
    theme_color: '#212446',
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
      { name: 'Home', short_name: 'Home', url: '/dashboard', icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'CRM', short_name: 'CRM', url: '/dashboard/crm', icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Projects', short_name: 'Projects', url: '/dashboard/projects', icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Money', short_name: 'Money', url: '/dashboard/finance', icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Bonnie AI', short_name: 'Bonnie', url: '/dashboard/bonnie', icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }] },
    ],
    share_target: {
      action: '/dashboard/share-intake',
      method: 'GET',
      enctype: 'application/x-www-form-urlencoded',
      params: { title: 'title', text: 'text', url: 'url' },
    },
  };
}
