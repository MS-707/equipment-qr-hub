import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        mytra: {
          bg: '#0A0A0A',
          card: '#161616',
          'card-hover': '#1E1E1E',
          input: '#0F0F0F',
          border: '#232323',
          purple: '#583AF6',
          'purple-hover': '#6B4FF7',
          'purple-glow': 'rgba(88, 58, 246, 0.12)',
        }
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
        fadeIn: 'fadeIn 200ms ease-out',
        slideDown: 'slideDown 200ms ease-out',
        fadeInUp: 'fadeInUp 300ms ease-out both',
      }
    },
  },
  plugins: [],
}
export default config
