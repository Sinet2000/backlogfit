import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const backend = 'http://localhost:8080';

/** Footer links to the (content) pages (A6). */
const CONTENT_PAGES = [
  '/faq',
  '/how-story-point-estimation-works',
  '/planning-poker-alternative',
  '/compare',
  '/guides',
  '/security',
  '/privacy',
  '/self-hosting',
];

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ pages: 'build', assets: 'build', strict: true }),
      // Strict CSP (style-src 'self'): never inline CSS into the HTML.
      inlineStyleThreshold: 0,
      prerender: {
        // Content pages owned by A6 live on another branch until integration; a 404 for one of
        // them is tolerated, every other broken link fails the build.
        handleHttpError: ({ path, status, message }) => {
          if (status === 404 && CONTENT_PAGES.includes(path)) return;
          throw new Error(message);
        },
        handleMissingId: 'fail',
      },
      version: { pollInterval: 0 },
      // Absolute asset paths: the bootstrap script is moved to an external file (see
      // scripts/externalize.ts), where relative imports would resolve against the wrong URL.
      paths: { relative: false },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: backend, changeOrigin: false },
      '/ws': { target: backend, ws: true, changeOrigin: false },
    },
  },
  build: {
    // CSP img-src/font-src 'self': never inline assets as data: URLs.
    assetsInlineLimit: 0,
  },
});
