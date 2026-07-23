import Providers from '@/components/Providers'
import ErrorBoundary from '@/components/ErrorBoundary'
import './globals.css'

export const metadata = {
  title: 'Defense GPT — AI Study Assistant for Indian Defense Exams',
  description: 'Precise, RAG-powered answers for NDA, CDS, AFCAT, Navy & SSB exam preparation.',
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  themeColor: '#0c0d0f',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0c0d0f] text-[#f0f0f0] font-geist">
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}
