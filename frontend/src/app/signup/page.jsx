"use client"
import { UserPlus, Mail, KeyRound, User, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { signIn } from 'next-auth/react'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!email || !password || !name) {
        setError('Please complete all mandatory fields.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.')
        setLoading(false)
        return
      }

      router.push('/login?registered=true')
    } catch (err) {
      setError('Registration failed. Please try again.')
      setLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    setGoogleLoading(true)
    signIn('google', { callbackUrl: '/chat' })
  }

  return (
    <div className="min-h-[100dvh] bg-[#0c0d0f] text-[#f0f0f0] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-geist">

      {/* Grid background overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-8 h-8 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center group-hover:border-[#22c55e]/40 transition-colors">
              <UserPlus size={16} className="text-[#22c55e]" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">Defense GPT</span>
          </Link>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
            Create an account
          </h2>
          <p className="text-xs text-[#6b7280]">
            Get access to RAG answers, practice quizzes, and live web search
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div
          className="bg-[#141518] border border-white/[0.08] rounded-2xl py-8 px-6 sm:px-8 shadow-2xl"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px rgba(0,0,0,0.4)' }}
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#fca5a5] p-3 rounded-lg text-xs flex items-start gap-2"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#ef4444]" />
                <span>{error}</span>
              </motion.div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">
                Full name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#4b5563]">
                  <User size={15} />
                </div>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-base block w-full pl-9 pr-3 py-2 text-xs"
                  placeholder="Cadet Name"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#4b5563]">
                  <Mail size={15} />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base block w-full pl-9 pr-3 py-2 text-xs"
                  placeholder="cadet@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#4b5563]">
                  <KeyRound size={15} />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base block w-full pl-9 pr-3 py-2 text-xs"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg bg-[#22c55e] text-[#0c0d0f] text-xs font-semibold hover:bg-[#16a34a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={15} />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account <ArrowRight size={14} />
                  </>
                )}
              </motion.button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.06]" />
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="px-3 bg-[#141518] text-[#4b5563] font-geist-mono">or continue with</span>
              </div>
            </div>

            <div className="mt-5">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex justify-center items-center gap-2.5 py-2 px-4 rounded-lg border border-white/[0.08] bg-[#1c1e22] text-xs font-medium text-[#9ca3af] hover:text-white hover:border-white/[0.14] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={15} />
                    Connecting...
                  </>
                ) : (
                  <>
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="h-4 w-4" />
                    Google Account
                  </>
                )}
              </motion.button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#6b7280]">
              Already have an account?{' '}
              <Link href="/login" className="text-[#22c55e] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
