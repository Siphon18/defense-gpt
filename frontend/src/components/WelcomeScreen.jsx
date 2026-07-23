'use client'
import { motion } from 'framer-motion'
import { BookOpen, Zap, Globe, Users, FileText, Crosshair } from 'lucide-react'

const QUICK_PROMPTS = [
  { icon: Crosshair, label: 'NDA Syllabus', prompt: 'What is the complete NDA exam syllabus and how should I structure my preparation?' },
  { icon: BookOpen,  label: 'CDS Strategy', prompt: 'Give me a detailed 3-month study strategy for the CDS examination.' },
  { icon: Zap,       label: 'AFCAT Guide',  prompt: 'What are the key topics and preparation tips for the AFCAT exam?' },
  { icon: Globe,     label: 'Current Affairs', prompt: 'How should I prepare General Knowledge and Current Affairs for defense exams?' },
  { icon: FileText,  label: 'SSB Interview', prompt: 'Walk me through the SSB interview process and how to prepare for each stage.' },
  { icon: Users,     label: 'Physical Fitness', prompt: 'What are the physical fitness standards and how do I prepare for the physical tests?' },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } }
}
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28 } }
}

export default function WelcomeScreen({ stats, onQuickPrompt }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center px-4 py-12 overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-2xl">

        {/* Logo / heading */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10"
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#141518] border border-white/[0.08] mb-5"
          >
            <BookOpen size={24} className="text-[#22c55e]" />
          </motion.div>

          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Defense GPT
          </h1>
          <p className="text-sm text-[#6b7280] max-w-xs mx-auto leading-relaxed">
            RAG-powered answers for NDA, CDS, AFCAT, Navy, SSB, and CAPF exams.
          </p>

          {/* Stats row */}
          {stats?.total_chunks > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-center gap-6 mt-5"
            >
              {[
                { value: stats.total_chunks.toLocaleString(), label: 'Knowledge chunks' },
                { value: stats.total_pdfs,                   label: 'Study documents' },
                { value: '24/7',                             label: 'Available' },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <p className="text-lg font-bold text-white font-geist-mono">{value}</p>
                  <p className="text-[11px] text-[#4b5563] font-geist-mono">{label}</p>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Quick prompts */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-[#4b5563] font-geist-mono uppercase tracking-widest">Get started</span>
          <div className="flex-1 h-px bg-white/[0.05]" />
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2"
        >
          {QUICK_PROMPTS.map((p) => (
            <motion.button
              key={p.label}
              variants={item}
              whileHover={{ scale: 1.015, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickPrompt(p.prompt)}
              className="spotlight-card flex items-start gap-3 p-4 text-left group hover:border-white/[0.10] transition-all duration-200"
            >
              <div className="mt-0.5 w-8 h-8 rounded-lg bg-[#1c1e22] border border-white/[0.07] flex items-center justify-center shrink-0 group-hover:border-[#22c55e]/25 transition-colors duration-200">
                <p.icon size={15} className="text-[#6b7280] group-hover:text-[#22c55e] transition-colors duration-200" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#9ca3af] group-hover:text-white transition-colors duration-200">{p.label}</p>
                <p className="text-xs text-[#4b5563] mt-0.5 leading-relaxed line-clamp-2">{p.prompt}</p>
              </div>
            </motion.button>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-[11px] text-[#374151] font-geist-mono mt-6"
        >
          Press <span className="text-[#4b5563]">/</span> to focus the input
        </motion.p>
      </div>
    </div>
  )
}
