'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Zap, Check, X, MessageSquare,
  Globe, Image, Crown, Sparkles, BookOpen, ArrowLeft, Loader2, CheckCircle2
} from 'lucide-react'

const FREE_FEATURES = [
  { label: `${process.env.NEXT_PUBLIC_USAGE_LIMIT || 5} AI questions per session`, included: true },
  { label: 'PDF-based RAG answers', included: true },
  { label: 'All exam types (NDA, CDS, AFCAT, SSB…)', included: true },
  { label: 'Practice MCQ quiz', included: true },
  { label: 'Chat history (session only)', included: true },
  { label: 'Voice input', included: true },
  { label: 'Unlimited queries', included: false },
  { label: 'Live web search', included: false },
  { label: 'Image / document upload', included: false },
  { label: 'Priority processing', included: false },
]

const PRO_FEATURES = [
  { label: '100 AI queries per 24h (Resets daily)', included: true },
  { label: 'PDF-based RAG answers', included: true },
  { label: 'All exam types (NDA, CDS, AFCAT, SSB…)', included: true },
  { label: 'Practice MCQ quiz', included: true },
  { label: 'Persistent chat history', included: true },
  { label: 'Voice input', included: true },
  { label: 'Live web search augmentation', included: true },
  { label: 'Image / document upload (multimodal)', included: true },
  { label: 'Priority processing', included: true },
  { label: 'Early access to new features', included: true },
]

function FeatureRow({ label, included }) {
  return (
    <li className="flex items-center gap-3 text-xs py-1.5">
      {included ? (
        <Check className="w-4 h-4 text-[#22c55e] shrink-0" />
      ) : (
        <X className="w-4 h-4 text-[#374151] shrink-0" />
      )}
      <span className={included ? 'text-[#9ca3af]' : 'text-[#374151]'}>{label}</span>
    </li>
  )
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function PlansPage() {
  const router = useRouter()
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handleCheckout = async () => {
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      // 1. Create order from backend
      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing: annual ? 'annual' : 'monthly' }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not initiate checkout')

      // 2. If Razorpay API keys are configured, launch Razorpay Checkout modal
      if (!data.isTestMode) {
        const loaded = await loadRazorpayScript()
        if (!loaded) throw new Error('Razorpay SDK failed to load. Check your internet connection.')

        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          name: 'Defense GPT',
          description: `Commander Tier (${annual ? 'Annual' : 'Monthly'})`,
          order_id: data.orderId,
          theme: { color: '#22c55e' },
          handler: async function (response) {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              billing: annual ? 'annual' : 'monthly',
              isTestMode: false,
            })
          },
        }

        const rzp = new window.Razorpay(options)
        rzp.open()
        setLoading(false)
        return
      }

      // 3. Sandbox / Test Mode fallback (Instant verification when keys aren't added yet)
      await verifyPayment({
        razorpay_order_id: data.orderId,
        razorpay_payment_id: `pay_simulated_${Date.now()}`,
        billing: annual ? 'annual' : 'monthly',
        isTestMode: true,
      })

    } catch (err) {
      console.error('Checkout error:', err)
      setErrorMsg(err.message || 'Payment initiation failed')
      setLoading(false)
    }
  }

  const verifyPayment = async (payload) => {
    try {
      const res = await fetch('/api/checkout/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment verification failed')

      setSuccessMsg('Commander Tier activated! Unlimited queries unlocked.')
      setTimeout(() => {
        router.push('/chat')
      }, 1500)
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#0c0d0f] text-[#f0f0f0] relative overflow-hidden font-geist">

      {/* Grid background overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Nav */}
      <nav className="fixed w-full z-50 bg-[#0c0d0f]/90 backdrop-blur-md border-b border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/chat" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
              <BookOpen size={14} className="text-[#22c55e]" />
            </div>
            <span className="font-bold text-sm text-white tracking-tight">Defense GPT</span>
          </Link>
          <Link href="/chat" className="text-xs text-[#6b7280] hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft size={13} /> Back to Chat
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 pt-28 pb-20 relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#22c55e]/20 bg-[#22c55e]/10 text-[#22c55e] text-xs font-semibold mb-4">
            <Crown size={13} /> Student Budget Pricing
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Affordable preparation for cadets
          </h1>
          <p className="text-[#6b7280] max-w-md mx-auto text-sm leading-relaxed">
            Priced to fit a student budget while keeping the AI infrastructure lightning fast.
          </p>

          {/* Billing toggle */}
          <div className="mt-6 inline-flex items-center gap-3 bg-[#141518] p-1 rounded-xl border border-white/[0.06]">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !annual ? 'bg-[#1c1e22] text-white shadow-sm' : 'text-[#6b7280] hover:text-white'
              }`}
            >
              Monthly (₹199/mo)
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                annual ? 'bg-[#1c1e22] text-white shadow-sm' : 'text-[#6b7280] hover:text-white'
              }`}
            >
              Annual (₹125/mo)
              <span className="text-[10px] bg-[#22c55e]/20 text-[#22c55e] px-1.5 py-0.5 rounded font-semibold font-geist-mono">
                Save 35%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Notifications */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#86efac] text-xs flex items-center justify-center gap-2 font-medium max-w-md mx-auto"
            >
              <CheckCircle2 size={16} className="text-[#22c55e]" />
              <span>{successMsg}</span>
            </motion.div>
          )}

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#fca5a5] text-xs flex items-center justify-center gap-2 font-medium max-w-md mx-auto"
            >
              <X size={16} className="text-[#ef4444]" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">

          {/* Free */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#141518] rounded-2xl p-6 sm:p-8 border border-white/[0.08] flex flex-col justify-between"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-[#1c1e22] border border-white/[0.07] flex items-center justify-center mb-4">
                <Shield className="w-4 h-4 text-[#6b7280]" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] font-geist-mono mb-1">Recruit</p>
              <div className="flex items-end gap-1.5 mb-2">
                <span className="text-3xl font-bold text-white font-geist-mono">₹0</span>
                <span className="text-[#6b7280] text-xs font-geist-mono mb-1">/ forever</span>
              </div>
              <p className="text-[#6b7280] text-xs mb-6">Start your preparation. No credit card needed.</p>

              <ul className="space-y-0.5 mb-8">
                {FREE_FEATURES.map((f, i) => <FeatureRow key={i} {...f} />)}
              </ul>
            </div>

            <Link href="/chat">
              <button className="w-full py-2.5 rounded-lg border border-white/[0.10] text-[#9ca3af] hover:text-white hover:border-white/[0.20] hover:bg-white/[0.03] transition-all font-medium text-xs">
                Continue Free
              </button>
            </Link>
          </motion.div>

          {/* Pro */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative rounded-2xl p-6 sm:p-8 flex flex-col justify-between border border-[#22c55e]/30 bg-[#141518]"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px rgba(0,0,0,0.4)' }}
          >
            {/* Top gradient highlight */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#22c55e] to-transparent rounded-t-2xl opacity-60" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#22c55e]" />
                </div>
                <span className="text-[10px] font-semibold bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30 px-2.5 py-0.5 rounded-full font-geist-mono">
                  Recommended for Cadets
                </span>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider text-[#22c55e] font-geist-mono mb-1">Commander</p>
              <div className="flex items-end gap-1.5 mb-1">
                <span className="text-3xl font-bold text-white font-geist-mono">
                  {annual ? '₹1,499' : '₹199'}
                </span>
                <span className="text-[#6b7280] text-xs font-geist-mono mb-1">{annual ? '/ year' : '/ month'}</span>
              </div>
              {annual ? (
                <p className="text-[#22c55e]/80 text-xs font-geist-mono mb-6">Equals ₹125/mo — save ₹889/yr</p>
              ) : (
                <p className="text-[#6b7280] text-xs mb-6">Billed monthly. Cancel anytime.</p>
              )}

              <ul className="space-y-0.5 mb-8">
                {PRO_FEATURES.map((f, i) => <FeatureRow key={i} {...f} />)}
              </ul>
            </div>

            <div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCheckout}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-[#22c55e] text-[#0c0d0f] font-semibold text-xs hover:bg-[#16a34a] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={15} />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Upgrade via UPI / Cards (Razorpay)
                  </>
                )}
              </motion.button>
              <p className="text-center text-[10px] text-[#4b5563] font-geist-mono mt-2">
                Supports Google Pay, PhonePe, Paytm, RuPay, Netbanking & Cards
              </p>
            </div>
          </motion.div>
        </div>

        {/* Highlight grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-[#141518] rounded-2xl border border-white/[0.07] p-6 sm:p-8"
        >
          <h2 className="text-xs font-geist-mono uppercase tracking-wider text-[#6b7280] mb-6 text-center">Included with Commander Tier</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { icon: MessageSquare, label: 'Unlimited Queries', desc: 'No daily or session cap' },
              { icon: Globe, label: 'Live Web Intel', desc: 'Augmented search results' },
              { icon: Image, label: 'Multimodal', desc: 'Upload documents & images' },
              { icon: Zap, label: 'Priority Queue', desc: 'Faster response times' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="p-3">
                <div className="w-8 h-8 mx-auto rounded-lg bg-[#1c1e22] border border-white/[0.07] flex items-center justify-center mb-2">
                  <Icon className="w-4 h-4 text-[#22c55e]" />
                </div>
                <p className="text-xs font-semibold text-white mb-0.5">{label}</p>
                <p className="text-[10px] text-[#6b7280] font-geist-mono">{desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
