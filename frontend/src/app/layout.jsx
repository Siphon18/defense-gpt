import Providers from '@/components/Providers'
import ErrorBoundary from '@/components/ErrorBoundary'
import './globals.css'

export const metadata = {
  title: 'Defense GPT — Indian Defense Exam AI',
  description: 'AI-powered preparation for NDA, CDS, AFCAT, Navy & SSB examinations',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Defense GPT',
  },
}

export const viewport = {
  themeColor: '#070e09',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}
