const CACHE_NAME = 'icevibe-v1'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Solo cachear assets estáticos, nunca el API
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return
  if (e.request.method !== 'GET') return
  // Dejar pasar todo sin interceptar
  return
})