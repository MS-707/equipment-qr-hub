import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Equipment QR Hub | Mytra EHS',
  description: 'Equipment profiles, PM schedules, and QR code labels for shop floor equipment',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-mytra-bg text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
