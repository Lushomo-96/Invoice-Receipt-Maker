import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'

function pwaStaticShell(): Plugin {
  let resolvedConfig: ResolvedConfig

  return {
    name: 'pwa-static-shell',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config
    },
    generateBundle(_options, bundle) {
      const base = resolvedConfig.base.endsWith('/')
        ? resolvedConfig.base
        : `${resolvedConfig.base}/`
      const publicFiles = readdirSync(resolvedConfig.publicDir, { withFileTypes: true })
        .flatMap((entry) => {
          const fullPath = resolve(resolvedConfig.publicDir, entry.name)
          if (entry.isDirectory()) {
            return readdirSync(fullPath, { recursive: true, withFileTypes: true })
              .filter((nestedEntry) => nestedEntry.isFile())
              .map((nestedEntry) => relative(resolvedConfig.publicDir, resolve(nestedEntry.parentPath, nestedEntry.name)))
          }
          return entry.isFile() ? [entry.name] : []
        })
        .map((file) => file.split(sep).join('/'))

      const bundleFiles = Object.keys(bundle).filter((file) => {
        if (file === 'sw.js') return false
        return ['.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.woff', '.woff2', '.ttf', '.otf', '.json'].includes(extname(file).toLowerCase())
      })
      const files = [...new Set([...bundleFiles, ...publicFiles])].sort()
      const appShellPath = base
      const urls = [...new Set([appShellPath, ...files.map((file) => `${base}${file}`)])]
      const version = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12)
      const precacheUrls = JSON.stringify(urls)

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
const CACHE_PREFIX = 'invoice-receipt-maker-shell-';
const CACHE_NAME = CACHE_PREFIX + '${version}';
const PRECACHE_URLS = ${precacheUrls};
const APP_SHELL_PATH = '${appShellPath}';
const APP_SHELL_URL = new URL(APP_SHELL_PATH, self.location.origin).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.add(APP_SHELL_URL);
        const optionalUrls = PRECACHE_URLS.filter((url) => url !== APP_SHELL_PATH);
        await Promise.allSettled(optionalUrls.map((url) => cache.add(url)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL_URL, copy));
          return response;
        })
        .catch(() => caches.match(APP_SHELL_URL))
    );
    return;
  }

  if (!PRECACHE_URLS.includes(requestUrl.pathname)) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Deployed as a GitHub Pages *project site* under {owner}.github.io/{repo}.
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Invoice-Receipt-Maker/' : '/',
  plugins: [react(), pwaStaticShell()],
})

