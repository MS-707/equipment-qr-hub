import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/**
 * PostCSS config for the Kin SPA build. Mirrors the repo-root
 * postcss.config.mjs (tailwindcss only, no autoprefixer in this repo) but pins
 * the Tailwind config to kin/tailwind.config.ts, which re-exports the root
 * design system with the kin/src content globs added.
 *
 * kin/vite.config.ts points css.postcss at this directory.
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    tailwindcss: { config: path.join(HERE, 'tailwind.config.ts') },
  },
}

export default config
