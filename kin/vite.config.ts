import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const KIN = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(KIN, '..')

/**
 * Vite build for the Kin SPA (KIN-4, KIN-M0-T5).
 *
 * Design constraints this config encodes:
 *
 * - root is kin/src and outDir is kin/dist. kin/scripts/kin-assets.mjs hashes
 *   whatever lands in kin/dist into kin/dist/asset-manifest.json, and the
 *   Worker serves /assets/* with `immutable` caching — so Vite's default
 *   content-hashed layout under assets/ is load-bearing, not cosmetic. Do not
 *   flatten it.
 *
 * - The three slice screens are carried across UNCHANGED from src/components.
 *   The '@' alias points at the repo's own src/, so they resolve in place and
 *   the Next app keeps shipping the same files. The only import in their
 *   dependency closure that the browser cannot resolve on its own is the
 *   framework link component, which is aliased to a local shim.
 *
 *   Measured closure of the three screens: 27 local files (3 components,
 *   16 src/lib, 2 src/data, 6 src/messages JSON) and exactly four bare
 *   specifiers — react, lucide-react, zod, and the aliased link. There is no
 *   router import anywhere in that graph, so no router shim is needed.
 *
 * - src/lib/i18n-core.ts guards its dev-only diagnostics on the Node build
 *   flag, which the browser has no notion of. `define` folds it to a literal
 *   so the production bundle drops the warn branch entirely. The substitution
 *   lives HERE rather than in kin/src on purpose: KIN-7 forbids that identifier
 *   anywhere under kin/src or kin/worker.
 */
export default defineConfig(({ mode }) => ({
  root: path.join(KIN, 'src'),
  base: '/',
  // kin/scripts/kin-build.mjs stages static passthrough files itself, after the
  // bundle is written, so nothing in a public dir can clobber Vite's index.html.
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: path.join(KIN, 'src', 'shims', 'next-link.tsx') },
      // English-only port (owner directive, commit a79ccb0). src/lib/i18n-core.ts
      // imports es.json STATICALLY, so without this the Spanish catalog ships to
      // field devices — 52,770 bytes, 11% of the bundle, for a locale the app
      // deliberately cannot reach. Binding es to {} is the mechanism the migration
      // assessment specified: t() falls through to English even if a device has
      // sage-locale-v2='es' in storage, because the payload is not present.
      // Covers es.json AND the four src/messages/data/*.es.json lookasides. Safe
      // because every accessor in src/lib/i18n-data.ts guards on locale !== 'es'
      // BEFORE dereferencing a map, so an empty object is never indexed.
      // Must precede the '@/' entry — first match wins.
      { find: /^@\/messages\/.*es\.json$/, replacement: path.join(KIN, 'src', 'shims', 'empty-messages.json') },
      { find: /^@\//, replacement: `${path.join(REPO, 'src')}/` },
    ],
  },
  css: {
    // Directory to load the PostCSS config from — kin/postcss.config.mjs,
    // which pins kin/tailwind.config.ts (the root design system + kin globs).
    postcss: KIN,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
  },
  build: {
    outDir: path.join(KIN, 'dist'),
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
  },
}))
