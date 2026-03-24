const CACHE_NAME = 'icevibe-v1'
const ASSETS = [
  '/',
  '/index.html',
  '/mesas.html',
  '/pos-mesero.html',
  '/dashboard-admin.html',
  '/dashboard-gerente.html',
  '/css/pos-styles.css',
  '/js/config.js',
  '/js/auth.js',
  '/js/pos-mesero.js',
  '/js/dashboard-admin.js',
  '/js/dashboard-gerente.js'
]

// Instalar y cachear archivos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  )
  self.skipWaiting()
})

// Activar y limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Estrategia: red primero, cache como respaldo
self.addEventListener('fetch', e => {
  // No cachear llamadas al API
  if (e.request.url.includes('/api/')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})