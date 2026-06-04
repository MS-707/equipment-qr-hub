import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import NavHeader from '@/components/NavHeader'
import AuthProvider from '@/components/providers/AuthProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Equipment QR Hub | Mytra EHS',
  description: 'Equipment profiles, PM schedules, and QR code labels for shop floor equipment',
  applicationName: 'Equipment QR Hub',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Equipment QR Hub',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="font-sans bg-mytra-bg text-fg min-h-screen">
        <AuthProvider>
          <NavHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
