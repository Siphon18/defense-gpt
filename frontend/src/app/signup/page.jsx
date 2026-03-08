"use client"
import { Shield, UserPlus, ShieldCheck, Mail, KeyRound, Cpu, User } from 'lucide-react'
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!email || !password || !name) {
        setError('Complete all mandatory fields.')
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
        setError(data.error || 'Registration failed. Try again.')
        setLoading(false)
        return
      }

      router.push('/login?registered=true')
    } catch (err) {
      setError('Registration failed. Try again.')
      setLoading(false)
    }
  }


  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/chat' })
  }

  return (
    <div className="min-h-screen bg-[#0a0f0a] radar-grid-bg flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden text-gray-200">

      {/* Background Effects */}
      <div className="absolute inset-0 scan-line pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#00ff41]/5 to-transparent pointer-events-none" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="particle" style={{ left: `${80 - i * 15}%`, animationDuration: `${6 + i * 2}s`, animationDelay: `${i * 0.5}s` }} />
      ))}

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center"
        >
          <div className="relative">
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} className="absolute -inset-4 rounded-full border border-[#00ff41]/20 border-b-[#00ff41]/80" />
            <UserPlus size={40} className="text-[#00ff41] drop-shadow-[0_0_15px_rgba(0,255,65,0.6)]" />
          </div>
        </motion.div>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mt-6 text-center text-2xl font-bold tracking-tight text-white"
        >
          NEW <span className="text-[#00ff41] animate-text-glow">OPERATIVE</span>
        </motion.h2>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-2 text-center text-[11px] font-mono text-[#00ff41]/60 uppercase tracking-[0.2em]"
        >
          Register for Clearance
        </motion.p>
      </div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="glass-card py-8 px-4 shadow-[0_0_30px_rgba(0,255,65,0.05)] sm:rounded-2xl sm:px-10 border border-[#00ff41]/20">

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
                <ShieldCheck size={16} />
                <span>Error: {error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#00ff41]/70 mb-2">
                Designation / Name
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-[#00ff41]/40" />
                </div>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input block w-full pl-10 pr-3 py-2.5 rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#00ff41] font-mono"
                  placeholder="Cadet Name"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#00ff41]/70 mb-2">
                Comm Channel (Email)
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
                  placeholder="name@unit.com"
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
                    Processing...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Request Authorization
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
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-gray-700/50 rounded-lg shadow-sm bg-[#1a2a1e]/40 text-sm font-medium text-gray-300 hover:bg-[#1a2a1e]/80 transition-all duration-300"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="h-4" />
                Google Network
              </button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500 font-mono">
              Already holds clearance?{' '}
              <Link href="/login" className="text-[#00ff41] hover:text-[#00ff41]/80 hover:underline underline-offset-4 transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
