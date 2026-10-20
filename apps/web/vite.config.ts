import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { announcerWithoutInlineStyle, noTemplateStyleAttrs } from './build-plugins/announcer.ts';

const backend = 'http://localhost:8080';

export default defineConfig({
  plugins: [
    announcerWithoutInlineStyle(),
    noTemplateStyleAttrs(),
    sveltekit({
      adapter: adapter({ pages: 'build', assets: 'build', strict: true }),
      // Strict CSP (style-src 'self'): never inline CSS into the HTML.
      inlineStyleThreshold: 0,
      prerender: {
        handleHttpError: 'fail',
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
