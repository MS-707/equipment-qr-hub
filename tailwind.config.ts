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
      borderRadius: {
        card: 'var(--r-lg)',
        field: 'var(--r-md)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-6px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        blurIn: {
          from: { opacity: '0', transform: 'translateY(12px)', filter: 'blur(8px)' },
          to: { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(-5px)' },
          '50%': { transform: 'translateY(6px)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.75', transform: 'translateX(-50%) scale(1)' },
          '50%': { opacity: '1', transform: 'translateX(-50%) scale(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideDown: 'slideDown 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        fadeInUp: 'fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) both',
        slideInRight: 'slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1) both',
        slideInLeft: 'slideInLeft 300ms cubic-bezier(0.16, 1, 0.3, 1) both',
        scaleIn: 'scaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        blurIn: 'blurIn 450ms cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 7s ease-in-out infinite',
        floatSlow: 'float 10s ease-in-out infinite',
        glowPulse: 'glowPulse 9s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      }
    },
  },
  plugins: [],
}
export default config
