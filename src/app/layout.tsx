import type { Metadata } from 'next'
import { Lato, Raleway } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

const lato = Lato({ subsets: ['latin', 'latin-ext'], weight: ['300', '400', '700', '900'], variable: '--font-lato' })
const raleway = Raleway({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700'], variable: '--font-raleway' })

export const metadata: Metadata = {
  title: 'Don Papa Match Play - Karolinka Golf Park',
  description: 'Liga golfowa Match Play - Karolinka Golf Park, Kamień Śląski',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#134a56" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Don Papa MP" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className={`${lato.variable} ${raleway.variable} bg-gray-50 min-h-screen`}>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  )
}
