import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import NavHeader from '@/components/NavHeader'
import BottomTabBar from '@/components/BottomTabBar'
import SageTriage from '@/components/SageTriage'
import OnboardingTour from '@/components/onboarding/OnboardingTour'
import ModuleTourEngine from '@/components/onboarding/ModuleTourEngine'
import AuthProvider from '@/components/providers/AuthProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Sage | EHS',
  description: 'AI-assisted construction safety — Pre-Task Plans, permits, incident reporting, and equipment tracking for the field',
  applicationName: 'Sage',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sage',
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
        {/* iOS PWA Splash Screens */}
        <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1179x2556.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1290x2796.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="/splash/splash-750x1334.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1284x2778.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)" href="/splash/splash-1668x2388.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2)" href="/splash/splash-1640x2360.png" />
      </head>
      <body className="font-sans bg-mytra-bg text-fg min-h-screen pb-16 md:pb-0">
        <AuthProvider>
          <NavHeader />
          {children}
          <BottomTabBar />
          <SageTriage />
          <OnboardingTour />
          <ModuleTourEngine />
        </AuthProvider>
      </body>
    </html>
  )
}
