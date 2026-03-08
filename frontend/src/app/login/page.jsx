"use client"
import { Shield, Lock, ShieldCheck, Mail, KeyRound, Cpu, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Suspense } from 'react'

// NextAuth error messages mapped to user-friendly text
const ERROR_MESSAGES = {
  OAuthSignin: 'Error starting Google sign-in. Check your OAuth configuration.',
  OAuthCallback: 'Google sign-in callback failed. Check redirect URI settings.',
  OAuthCreateAccount: 'Could not create account with Google. Try email signup.',
  EmailCreateAccount: 'Could not create account with that email.',
  Callback: 'Authentication callback error. Please try again.',
  OAuthAccountNotLinked: 'This email is already registered with a different method.',
  CredentialsSignin: 'Invalid email or password.',
  SessionRequired: 'Please sign in to access this page.',
  Default: 'An authentication error occurred. Please try again.',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Capture error from URL query params (NextAuth redirects with ?error=...)
  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) {
      setError(ERROR_MESSAGES[urlError] || ERROR_MESSAGES.Default)
    }
  }, [searchParams])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      })

      if (res?.error) {
        setError(ERROR_MESSAGES.CredentialsSignin)
      } else {
        router.push('/chat')
      }
    } catch (err) {
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      await signIn('google', { callbackUrl: '/chat' })
    } catch (err) {
      setError('Failed to connect to Google. Please try again.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f0a] radar-grid-bg flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden text-gray-200">

      {/* Background Effects */}
      <div className="absolute inset-0 scan-line pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#00ff41]/5 to-transparent pointer-events-none" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="particle" style={{ left: `${20 + i * 15}%`, animationDuration: `${7 + i * 2}s`, animationDelay: `${i}s` }} />
      ))}

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center"
        >
          <div className="relative">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="absolute -inset-4 rounded-full border border-[#00ff41]/20 border-t-[#00ff41]/80" />
            <Shield size={40} className="text-[#00ff41] drop-shadow-[0_0_15px_rgba(0,255,65,0.6)]" />
          </div>
        </motion.div>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mt-6 text-center text-2xl font-bold tracking-tight text-white"
        >
          AUTH <span className="text-[#00ff41] animate-text-glow">REQUIRED</span>
        </motion.h2>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-2 text-center text-[11px] font-mono text-[#00ff41]/60 uppercase tracking-[0.2em]"
        >
          Establish secure connection to Command Center
        </motion.p>
      </div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="glass-card py-8 px-4 shadow-[0_0_30px_rgba(0,255,65,0.05)] sm:rounded-2xl sm:px-10 border border-[#00ff41]/20">

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-start gap-2"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#00ff41]/70 mb-2">
                Operative ID
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-[#00ff41]/40" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input block w-full pl-10 pr-3 py-2.5 rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#00ff41] font-mono"
                  placeholder="test@test.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#00ff41]/70 mb-2">
                Clearance Code
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-4 w-4 text-[#00ff41]/40" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input block w-full pl-10 pr-3 py-2.5 rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#00ff41] font-mono"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn-tactical w-full flex justify-center items-center gap-2 py-3 px-4 border border-[#00ff41]/40 rounded-lg shadow-sm text-sm font-bold text-[#00ff41] hover:bg-[#00ff41]/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00ff41] focus:ring-offset-[#0a0f0a] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest font-mono"
              >
                {loading ? (
                  <>
                    <Cpu className="animate-spin" size={16} />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    Initiate Uplink
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#00ff41]/20" />
              </div>
              <div className="relative flex justify-center text-[10px] font-mono uppercase tracking-widest">
                <span className="px-2 bg-[#0a0f0a] text-gray-500 border border-[#00ff41]/10 rounded-full">Or authorize via</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-gray-700/50 rounded-lg shadow-sm bg-[#1a2a1e]/40 text-sm font-medium text-gray-300 hover:bg-[#1a2a1e]/80 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <>
                    <Cpu className="animate-spin" size={16} />
                    Connecting to Google...
                  </>
                ) : (
                  <>
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="h-4" />
                    Google Network
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500 font-mono">
              Unregistered Operative?{' '}
              <Link href="/signup" className="text-[#00ff41] hover:text-[#00ff41]/80 hover:underline underline-offset-4 transition-colors">
                Request Access
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center">
        <Cpu className="animate-spin text-[#00ff41]" size={32} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
