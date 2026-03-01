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
      }
    },
  },
  plugins: [],
}
export default config
