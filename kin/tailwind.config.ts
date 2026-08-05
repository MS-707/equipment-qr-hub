import type { Config } from 'tailwindcss'
import base from '../tailwind.config'

/**
 * Tailwind config for the Kin SPA build (KIN-4).
 *
 * The design system itself — every token, colour alias, keyframe and plugin —
 * comes from the repo-root tailwind.config.ts unchanged, so the ported screens
 * render identically in both apps. The ONLY thing this file changes is the
 * content scan: the Kin build compiles `kin/src` (the shell, router and slice
 * screens) alongside the shared `src/` surfaces the port pulls in.
 *
 * `relative: true` resolves every glob against THIS file rather than the
 * process cwd, so the build is correct whether it is driven from the repo root
 * (`npm run kin:build`) or from `kin/`.
 */
const config: Config = {
  ...base,
  content: {
    relative: true,
    files: [
      './src/**/*.{js,ts,jsx,tsx,html}',
      '../src/components/**/*.{js,ts,jsx,tsx,mdx}',
      '../src/lib/**/*.{js,ts,jsx,tsx,mdx}',
      '../src/data/**/*.{js,ts,jsx,tsx,mdx}',
    ],
  },
}

export default config
