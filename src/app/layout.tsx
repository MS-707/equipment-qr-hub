import type { Metadata, Viewport } from 'next'
import { Roboto } from 'next/font/google'
import './globals.css'
import NavHeader from '@/components/NavHeader'

const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'] })

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
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${roboto.className} bg-mytra-bg text-white min-h-screen`}>
        <NavHeader />
        {children}
      </body>
    </html>
  )
}
