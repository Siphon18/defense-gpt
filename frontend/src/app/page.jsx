'use client'
import Link from 'next/link'
import { ArrowRight, Shield, BookOpen, MessageSquare, Award, Radar } from 'lucide-react'
import { motion } from 'framer-motion'

export default function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.3 }
    }
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  }

  return (
    <div className="bg-[#0a0f0a] radar-grid-bg min-h-screen text-gray-200 font-sans selection:bg-[#00ff41]/30 selection:text-[#00ff41] relative overflow-hidden">
      
      {/* Tactical Grid Overlay */}
      <div className="absolute inset-0 scan-line pointer-events-none" />
      {[...Array(15)].map((_, i) => (
        <div key={i} className="particle" style={{ left: `${Math.random() * 100}%`, animationDuration: `${5 + Math.random() * 5}s`, animationDelay: `${Math.random() * 3}s` }} />
      ))}

      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 50, damping: 20 }}
        className="fixed w-full z-50 glass border-b border-[#00ff41]/15"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border border-[#00ff41]/30 border-t-[#00ff41]" 
                />
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
                className="btn-tactical relative inline-flex items-center justify-center px-5 py-2 border border-[#00ff41]/40 rounded-lg shadow-sm text-sm font-bold text-[#00ff41] focus:outline-none uppercase tracking-widest font-mono hover:shadow-[0_0_15px_rgba(0,255,65,0.3)] overflow-hidden group"
              >
                <span className="absolute inset-0 w-full h-full bg-[#00ff41]/10 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left ease-out"></span>
                <span className="relative z-10">Enlist Now</span>
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <main className="pt-32 pb-16 sm:pt-40 sm:pb-24 lg:pb-32 px-4 mx-auto max-w-7xl relative z-10 text-center flex flex-col items-center">
        
        {/* Background Radar Vector */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none opacity-10 z-[-1] flex items-center justify-center">
             <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="w-full h-full border-4 border-dashed border-[#00ff41] rounded-full"
             />
             <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute w-3/4 h-3/4 border-2 border-dotted border-[#00ffff] rounded-full"
             />
        </div>

        <motion.div 
          initial="hidden"
          animate="show"
          variants={containerVariants}
          className="max-w-4xl"
        >
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00ffff]/30 bg-[#00ffff]/5 text-[#00ffff] text-xs font-black mb-8 uppercase tracking-[0.25em] font-mono shadow-[0_0_20px_rgba(0,255,255,0.15)] backdrop-blur-md">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ffff] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00ffff]"></span>
              </span>
              System Online • Tactical Interface Active
            </motion.div>

            <motion.h1 variants={itemVariants} className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
              YOUR PERSONAL AI COMMANDER FOR <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff41] to-[#00ffff] animate-text-glow italic">DEFENSE EXAMS</span>
            </motion.h1>

            <motion.p variants={itemVariants} className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-gray-400 leading-relaxed font-mono font-light">
              Advanced simulation paradigms and real-time intelligence gathering for NDA, CDS, AFCAT, and SSB. Master the syllabus with military precision.
            </motion.p>

            <motion.div variants={itemVariants} className="mt-12 flex justify-center gap-5 flex-col sm:flex-row">
              <Link
                href="/signup"
                className="group relative flex items-center justify-center px-8 py-4 text-sm font-black rounded-xl text-black bg-[#00ff41] hover:bg-[#4ade80] transition-all uppercase tracking-[0.2em] shadow-[0_0_25px_rgba(0,255,65,0.4)] hover:shadow-[0_0_40px_rgba(0,255,65,0.6)] overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-white/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>
                Begin Your Mission
                <ArrowRight className="ml-3 -mr-1 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="flex items-center justify-center px-8 py-4 border border-[#00ffff]/20 text-sm font-black rounded-xl text-[#00ffff] bg-[#00ffff]/5 hover:bg-[#00ffff]/10 transition-all uppercase tracking-[0.2em] hover:shadow-[0_0_15px_rgba(0,255,255,0.2)] glass"
              >
                Access Terminal
              </Link>
            </motion.div>
        </motion.div>

        {/* Feature Dashboard */}
        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-32 max-w-6xl mx-auto w-full"
        >
          <div className="flex items-center justify-center gap-3 mb-12">
             <Radar className="w-5 h-5 text-[#00ffff]/70" />
             <h2 className="text-sm font-mono uppercase tracking-[0.3em] text-[#00ffff]/70">Core Capabilities Detected</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="glass-card p-8 rounded-2xl text-left border-t-2 border-t-[#00ff41] group hover:border-t-[#00ffff] transition-colors relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#00ff41]/5 rounded-full blur-[30px] group-hover:bg-[#00ffff]/10 transition-colors"></div>
              <div className="w-12 h-12 bg-[#00ff41]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#00ffff]/10 transition-colors">
                <MessageSquare className="w-6 h-6 text-[#00ff41] group-hover:text-[#00ffff] transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 font-mono uppercase tracking-wider group-hover:text-[#00ffff] transition-colors">Actionable Intel</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Direct neural-link to verified defense syllabus data. Get direct answers stripped of civilian noise.
              </p>
            </div>
            
            <div className="glass-card p-8 rounded-2xl text-left border-t-2 border-t-[#00ff41] group hover:border-t-[#00ffff] transition-colors relative overflow-hidden">
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#00ff41]/5 rounded-full blur-[30px] group-hover:bg-[#00ffff]/10 transition-colors"></div>
              <div className="w-12 h-12 bg-[#00ff41]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#00ffff]/10 transition-colors">
                <Award className="w-6 h-6 text-[#00ff41] group-hover:text-[#00ffff] transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 font-mono uppercase tracking-wider group-hover:text-[#00ffff] transition-colors">Evaluation Drills</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Dynamic target practice. AI-generated Q&A to stress-test your knowledge under simulated exam pressure.
              </p>
            </div>
            
            <div className="glass-card p-8 rounded-2xl text-left border-t-2 border-t-[#00ff41] group hover:border-t-[#00ffff] transition-colors relative overflow-hidden">
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#00ff41]/5 rounded-full blur-[30px] group-hover:bg-[#00ffff]/10 transition-colors"></div>
              <div className="w-12 h-12 bg-[#00ff41]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#00ffff]/10 transition-colors">
                <BookOpen className="w-6 h-6 text-[#00ff41] group-hover:text-[#00ffff] transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 font-mono uppercase tracking-wider group-hover:text-[#00ffff] transition-colors">Strategic Ops</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Aggregated study methodologies. Map out your victory condition using documented success patterns.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Exam Coverage */}
        <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-32 max-w-4xl mx-auto w-full glass p-8 rounded-3xl border-[#00ff41]/10"
        >
          <h2 className="text-xs font-mono uppercase tracking-[0.4em] text-[#00ff41]/60 mb-8 border-b border-[#00ff41]/10 pb-4 inline-block">Authorized Divisions</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {['NDA', 'CDS', 'AFCAT', 'Navy SSR/AA', 'CAPF', 'SSB Interview', 'Indian Military History', 'General Knowledge', 'Current Affairs'].map((exam, i) => (
              <motion.span 
                key={exam} 
                whileHover={{ scale: 1.05, borderColor: 'rgba(0, 255, 65, 0.5)' }}
                className="px-5 py-2.5 rounded-lg border border-[#00ff41]/15 bg-[#00ff41]/[0.02] text-[#e0e0e0] text-xs font-mono uppercase tracking-widest hover:bg-[#00ff41]/10 transition-colors cursor-default shadow-sm"
              >
                {exam}
              </motion.span>
            ))}
          </div>
        </motion.div>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#00ff41]/15 bg-[#050806] relative z-10 py-10 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-6 w-6 text-[#00ff41]/40" />
            <span className="text-[#00ff41]/50 font-bold tracking-[0.3em] uppercase font-mono text-xs">Defense GPT Core</span>
          </div>
          <p className="text-[#00ff41]/30 text-[10px] font-mono tracking-[0.2em] uppercase text-center max-w-md leading-relaxed">
            Unclassified System. Authorized personnel only. Data processed via secure LLM nodes. For educational deployment.
          </p>
        </div>
      </footer>
    </div>
  )
}
