import Link from 'next/link'
import { ArrowRight, Shield, BookOpen, Target, Brain, Radar, Crosshair, Users, Database, MessageSquare, Award, Lock } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="bg-[#0a0f0a] radar-grid-bg min-h-screen text-gray-200 font-sans selection:bg-[#00ff41]/30 selection:text-[#00ff41] relative overflow-hidden">

      {/* Tactical Grid Overlay */}
      <div className="absolute inset-0 scan-line pointer-events-none" />
      {[...Array(10)].map((_, i) => (
        <div key={i} className="particle" style={{ left: `${Math.random() * 100}%`, animationDuration: `${5 + Math.random() * 5}s`, animationDelay: `${Math.random() * 3}s` }} />
      ))}

      {/* Navigation */}
      <nav className="fixed w-full z-50 glass border-b border-[#00ff41]/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 group">
              <div className="relative">
                <div className="absolute inset-0 rounded-full border border-[#00ff41]/30 border-t-[#00ff41] animate-spin" style={{ animationDuration: '4s' }} />
                <Shield className="h-8 w-8 text-[#00ff41] drop-shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white uppercase font-mono">
                Defense <span className="text-[#00ff41]">GPT</span>
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-300 hover:text-[#00ff41] text-sm font-medium transition-colors font-mono uppercase tracking-wider"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="btn-tactical inline-flex items-center justify-center px-4 py-2 border border-[#00ff41]/40 rounded-lg shadow-sm text-sm font-bold text-[#00ff41] focus:outline-none uppercase tracking-widest font-mono hover:shadow-[0_0_15px_rgba(0,255,65,0.2)]"
              >
                Enlist Now
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-16 sm:pt-40 sm:pb-24 lg:pb-32 px-4 mx-auto max-w-7xl relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00ff41]/30 bg-[#00ff41]/5 text-[#4ade80] text-xs font-medium mb-8 uppercase tracking-[0.2em] font-mono shadow-[0_0_15px_rgba(0,255,65,0.1)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff41] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff41]"></span>
          </span>
          System Online • Ready for your success
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.02em] text-white leading-tight mb-6">
          Your personal AI trainer for India's toughest defense exams
        </h1>

        <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-400 leading-relaxed font-light">
          Train smarter, practice quizzes, and get actionable insights for NDA, CDS, AFCAT, Navy, CAPF, and SSB. Everything you need to boost your preparation and achieve your goals.
        </p>

        <div className="mt-10 flex justify-center gap-4 flex-col sm:flex-row">
          <Link
            href="/signup"
            className="btn-tactical flex items-center justify-center px-8 py-3.5 border border-[#00ff41]/40 text-base font-bold rounded-lg text-black bg-[#00ff41] hover:bg-[#4ade80] transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(0,255,65,0.3)]"
          >
            Begin Your Mission
            <ArrowRight className="ml-2 -mr-1 w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="flex items-center justify-center px-8 py-3.5 border border-[#00ff41]/20 text-base font-bold rounded-lg text-[#00ff41] bg-[#00ff41]/5 hover:bg-[#00ff41]/10 transition-all uppercase tracking-widest"
          >
            Access Dashboard
          </Link>
        </div>

        {/* Feature Dashboard */}
        <div className="mt-20 max-w-6xl mx-auto">
          <h2 className="text-sm font-mono uppercase tracking-[0.3em] text-[#00ff41]/60 mb-10">How You Benefit</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="glass-card p-8 rounded-2xl text-left border-t-2 border-t-[#00ff41]/40 group hover:shadow-[0_0_30px_rgba(0,255,65,0.1)]">
              <div className="w-12 h-12 bg-[#00ff41]/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6 text-[#00ff41]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-mono uppercase tracking-wider">Personalized Guidance</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Get answers to your questions, exam strategies, and study tips tailored to your needs.
              </p>
            </div>
            <div className="glass-card p-8 rounded-2xl text-left border-t-2 border-t-[#00ff41]/40 group hover:shadow-[0_0_30px_rgba(0,255,65,0.1)]">
              <div className="w-12 h-12 bg-[#00ff41]/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Award className="w-6 h-6 text-[#00ff41]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-mono uppercase tracking-wider">Practice Quizzes</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Sharpen your skills with topic-based quizzes and instant feedback. Track your progress and improve every day.
              </p>
            </div>
            <div className="glass-card p-8 rounded-2xl text-left border-t-2 border-t-[#00ff41]/40 group hover:shadow-[0_0_30px_rgba(0,255,65,0.1)]">
              <div className="w-12 h-12 bg-[#00ff41]/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6 text-[#00ff41]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-mono uppercase tracking-wider">Exam Insights</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Access up-to-date information, tips, and resources for all major defense exams in one place.
              </p>
            </div>
          </div>
        </div>

        {/* Exam Coverage */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-sm font-mono uppercase tracking-[0.3em] text-[#00ff41]/60 mb-8">Exam Coverage</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {['NDA', 'CDS', 'AFCAT', 'Navy SSR/AA', 'CAPF', 'SSB Interview', 'Indian Military History', 'General Knowledge', 'Current Affairs'].map((exam) => (
              <span key={exam} className="px-4 py-2 rounded-lg border border-[#00ff41]/20 bg-[#00ff41]/5 text-[#4ade80] text-sm font-mono uppercase tracking-wider hover:bg-[#00ff41]/10 transition-colors cursor-default">
                {exam}
              </span>
            ))}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#00ff41]/10 bg-[#0a0f0a]/80 backdrop-blur-md relative z-10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-[#00ff41]/50" />
            <span className="text-[#00ff41]/60 font-bold tracking-widest uppercase font-mono text-sm">Defense GPT</span>
          </div>
          <p className="text-[#00ff41]/40 text-xs font-mono tracking-widest uppercase text-center">
            Your trusted exam preparation partner. Prepare smarter, achieve higher, and unlock your potential.
          </p>
        </div>
      </footer>
    </div>
  )
}
