import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import dynamic from 'next/dynamic'
import './globals.css'
import NavHeader from '@/components/NavHeader'
import BottomTabBar from '@/components/BottomTabBar'
import StorageAlert from '@/components/StorageAlert'
import AuthProvider from '@/components/providers/AuthProvider'
import SyncProvider from '@/components/providers/SyncProvider'

const SyncToast = dynamic(() => import('@/components/SyncToast'), { ssr: false })
const SwUpdateBanner = dynamic(() => import('@/components/SwUpdateBanner'), { ssr: false })
const SageTriage = dynamic(() => import('@/components/SageTriage'), { ssr: false })
const OnboardingTour = dynamic(() => import('@/components/onboarding/OnboardingTour'), { ssr: false })
const ModuleTourEngine = dynamic(() => import('@/components/onboarding/ModuleTourEngine'), { ssr: false })
const TourAutoPrompt = dynamic(() => import('@/components/onboarding/TourAutoPrompt'), { ssr: false })

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Sage | EHS',
  description: 'AI-powered EHS safety — Pre-Task Plans, permits, incident reporting, and equipment tracking for teams of every size',
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
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
  ],
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('sage-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}else{var d=matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.dataset.theme=d?'dark':'light'}}catch(e){document.documentElement.dataset.theme='dark'}})()` }} />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* iOS PWA Splash Screens */}
        <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1179x2556.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1290x2796.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="/splash/splash-750x1334.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1284x2778.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)" href="/splash/splash-1668x2388.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2)" href="/splash/splash-1640x2360.png" />
      </head>
      <body className="font-sans bg-mytra-bg text-fg min-h-screen pb-20 md:pb-0">
        <AuthProvider>
          <SyncProvider>
            <NavHeader />
            {children}
            <BottomTabBar />
            <SageTriage />
            <OnboardingTour />
            <ModuleTourEngine />
            <TourAutoPrompt />
            <StorageAlert />
            <SyncToast />
            <SwUpdateBanner />
          </SyncProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
