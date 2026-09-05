'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion'
import { BookOpen, ArrowRight, CheckCircle2, Zap, Globe, FileText, Award, ChevronRight } from 'lucide-react'

// ── Text Scramble Effect ─────────────────────────────────────────
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
function useScramble(target, duration = 1000) {
  const [text, setText] = useState('')
  useEffect(() => {
    let frame = 0
    const totalFrames = Math.ceil(duration / 16)
    let raf
    const tick = () => {
      frame++
      const progress = Math.min(frame / totalFrames, 1)
      const revealed = Math.floor(progress * target.length)
      let result = ''
      for (let i = 0; i < target.length; i++) {
        if (i < revealed) result += target[i]
        else result += CHARS[Math.floor(Math.random() * CHARS.length)]
      }
      setText(result)
      if (progress < 1) raf = requestAnimationFrame(tick)
      else setText(target)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return text
}

// ── Magnetic Button ──────────────────────────────────────────────
function MagneticCTA({ href, children, primary = false }) {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 150, damping: 18 })
  const sy = useSpring(y, { stiffness: 150, damping: 18 })

  const onMove = (e) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - r.left - r.width / 2) * 0.3)
    y.set((e.clientY - r.top - r.height / 2) * 0.3)
  }
  const reset = () => { x.set(0); y.set(0) }

  return (
    <motion.div ref={ref} style={{ x: sx, y: sy }} onMouseMove={onMove} onMouseLeave={reset}>
      <Link href={href}>
        <motion.span
          whileTap={{ scale: 0.97 }}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            primary
              ? 'bg-[#22c55e] text-[#0c0d0f] hover:bg-[#16a34a]'
              : 'bg-[#141518] text-[#9ca3af] border border-white/[0.08] hover:border-white/[0.14] hover:text-white'
          }`}
        >
          {children}
        </motion.span>
      </Link>
    </motion.div>
  )
}

// ── Spotlight Feature Card ────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, delay }) {
  const ref = useRef(null)
  const onMove = (e) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--mouse-x', `${e.clientX - r.left}px`)
    ref.current.style.setProperty('--mouse-y', `${e.clientY - r.top}px`)
  }
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 24 }}
      onMouseMove={onMove}
      className="spotlight-card p-5 group"
    >
      <div className="w-9 h-9 rounded-lg bg-[#1c1e22] border border-white/[0.07] flex items-center justify-center mb-3 group-hover:border-[#22c55e]/20 transition-colors duration-300">
        <Icon size={16} className="text-[#6b7280] group-hover:text-[#22c55e] transition-colors duration-300" />
      </div>
      <p className="text-sm font-semibold text-white mb-1">{title}</p>
      <p className="text-xs text-[#6b7280] leading-relaxed">{desc}</p>
    </motion.div>
  )
}

const FEATURES = [
  { icon: FileText, title: 'PDF Knowledge Base', desc: 'Answers grounded in official NDA/CDS/AFCAT syllabus documents using RAG.' },
  { icon: Globe,    title: 'Live Web Search', desc: 'Toggle real-time web augmentation for current affairs and recent updates.' },
  { icon: Award,    title: 'Practice Quizzes', desc: 'Auto-generate MCQ sets from any answer and track your weak areas.' },
  { icon: Zap,      title: 'Streaming Answers', desc: 'Token-by-token streaming for a fast, interactive study session.' },
]

const EXAMS = ['NDA', 'CDS', 'AFCAT', 'SSB', 'Navy', 'CAPF']

export default function LandingPage() {
  const headline = useScramble('DEFENSE GPT', 900)
  const [examIndex, setExamIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setExamIndex(i => (i + 1) % EXAMS.length), 1800)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-[100dvh] bg-[#0c0d0f] text-[#f0f0f0] overflow-x-hidden">

      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── Nav ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-10 h-14 bg-[#0c0d0f]/90 backdrop-blur-md border-b border-white/[0.05]"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
            <BookOpen size={14} className="text-[#22c55e]" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">Defense GPT</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-[#6b7280] hover:text-white transition-colors">
            Sign in
          </Link>
          <Link href="/signup">
            <motion.span
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#22c55e] text-[#0c0d0f] text-sm font-semibold hover:bg-[#16a34a] transition-colors cursor-pointer"
            >
              Get started <ChevronRight size={14} />
            </motion.span>
          </Link>
        </div>
      </motion.nav>

      {/* ── Hero — Asymmetric split ── */}
      <section className="min-h-[100dvh] flex items-center pt-14">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-16 items-center">

            {/* Left — text content */}
            <div className="max-w-2xl">
              {/* Exam type ticker */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2.5 mb-7"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-status" />
                <span className="text-xs text-[#4b5563] font-geist-mono uppercase tracking-widest">AI-Powered for</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={examIndex}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="text-xs text-[#22c55e] font-geist-mono uppercase tracking-widest font-bold"
                  >
                    {EXAMS[examIndex]}
                  </motion.span>
                </AnimatePresence>
              </motion.div>

              {/* Headline with scramble */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.3 }}
              >
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-none text-white mb-2 font-geist-mono">
                  {headline}
                </h1>
                <p className="text-lg sm:text-xl text-[#6b7280] leading-relaxed mt-5 max-w-lg">
                  Study smarter for Indian defense exams. Get precise, source-backed answers from NDA, CDS, AFCAT syllabus documents — with live web augmentation.
                </p>
              </motion.div>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-wrap items-center gap-3 mt-8"
              >
                <MagneticCTA href="/signup" primary>
                  Start for free <ArrowRight size={14} />
                </MagneticCTA>
                <MagneticCTA href="/chat">
                  Try without account
                </MagneticCTA>
              </motion.div>

              {/* Proof points */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="flex flex-wrap gap-4 mt-6"
              >
                {['Free to start', 'No setup required', 'PDF + web context'].map(pt => (
                  <span key={pt} className="flex items-center gap-1.5 text-xs text-[#4b5563] font-geist-mono">
                    <CheckCircle2 size={13} className="text-[#22c55e]" />
                    {pt}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Right — live chat preview card */}
            <motion.div
              initial={{ opacity: 0, x: 24, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:block w-[360px]"
            >
              <div className="bg-[#141518] border border-white/[0.08] rounded-2xl overflow-hidden"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 48px rgba(0,0,0,0.4)' }}
              >
                {/* Window bar */}
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.05]">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/60" />
                  <span className="ml-2 text-[11px] text-[#374151] font-geist-mono">Defense GPT</span>
                </div>
                <div className="p-5 space-y-3">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="bg-[#1c1e22] border border-white/[0.07] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                      <p className="text-xs text-[#f0f0f0] leading-relaxed">What is the NDA Paper 2 exam structure?</p>
                    </div>
                  </div>
                  {/* Assistant message */}
                  <div className="border-l-2 border-[#22c55e]/30 pl-3 py-1">
                    <p className="text-xs text-[#9ca3af] leading-relaxed">
                      NDA Paper 2 covers General Ability Test (GAT) — 600 marks. It's split into English (200 marks) and GK (400 marks) covering Physics, Chemistry, History, Geography, and Current Affairs.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <FileText size={10} className="text-[#22c55e]" />
                      <span className="text-[10px] text-[#374151] font-geist-mono">NDA_Official_Syllabus.pdf · p.4</span>
                    </div>
                  </div>
                  {/* Input */}
                  <div className="mt-2 flex items-center gap-2 bg-[#1c1e22] border border-white/[0.07] rounded-lg px-3 py-2">
                    <span className="text-xs text-[#374151] flex-1">Ask about CDS eligibility...</span>
                    <div className="w-6 h-6 rounded-md bg-[#22c55e] flex items-center justify-center">
                      <ArrowRight size={12} className="text-[#0c0d0f]" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
              Everything you need to prepare
            </h2>
            <p className="text-[#6b7280] max-w-md">
              Purpose-built for Indian defense exam candidates — not a generic chatbot.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 0.08} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip ── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-[#141518] border border-white/[0.07] rounded-2xl px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
          >
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Ready to start studying?</h3>
              <p className="text-sm text-[#6b7280]">8 free questions per session. No credit card.</p>
            </div>
            <MagneticCTA href="/signup" primary>
              Create free account <ArrowRight size={14} />
            </MagneticCTA>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] px-6 sm:px-10 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-[#374151] font-geist-mono">
          <span>Defense GPT</span>
          <div className="flex items-center gap-4">
            <Link href="/plans" className="hover:text-[#6b7280] transition-colors">Plans</Link>
            <Link href="/login" className="hover:text-[#6b7280] transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
