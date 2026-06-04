import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        mytra: {
          bg: 'var(--bg)',
          card: 'var(--surface)',
          'card-hover': 'var(--surface-2)',
          input: 'var(--surface-inset)',
          border: 'var(--border)',
          'border-strong': 'var(--border-strong)',
          purple: 'var(--accent)',
          'purple-hover': 'var(--accent-hover)',
          'purple-glow': 'var(--accent-weak)',
        },
        fg: {
          DEFAULT: 'var(--fg)',
          2: 'var(--fg-2)',
          3: 'var(--fg-3)',
          4: 'var(--fg-4)',
        },
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        expired: 'var(--expired)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 220ms ease-out',
        slideDown: 'slideDown 220ms ease-out',
        fadeInUp: 'fadeInUp 330ms ease-out both',
      }
    },
  },
  plugins: [],
}
export default config
