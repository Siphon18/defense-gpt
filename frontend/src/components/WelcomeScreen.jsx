"use client"
import { Shield, Sparkles, BookOpen, Target, GraduationCap, Swords, Users, Radar, Crosshair } from 'lucide-react'
import { motion } from 'framer-motion'

const QUICK_PROMPTS = [
  { icon: Target, label: 'NDA Syllabus', prompt: 'What is the complete NDA exam syllabus and how should I prepare for it?', color: '#00ff41' },
  { icon: BookOpen, label: 'CDS Strategy', prompt: 'Give me a detailed study strategy for CDS examination preparation.', color: '#4ade80' },
  { icon: Sparkles, label: 'AFCAT Guide', prompt: 'What are the key topics and preparation tips for AFCAT exam?', color: '#86efac' },
  { icon: GraduationCap, label: 'GK & Current Affairs', prompt: 'How should I prepare General Knowledge and Current Affairs for defense exams?', color: '#00ff41' },
  { icon: Swords, label: 'SSB Interview', prompt: 'What is the SSB interview process and how should I prepare for each stage?', color: '#4ade80' },
  { icon: Users, label: 'Physical Fitness', prompt: 'What are the physical fitness requirements and preparation tips for defense exams?', color: '#86efac' },
]

function RadarRing({ size, delay }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 0.15 }}
      transition={{ delay, duration: 0.8 }}
      className="absolute rounded-full border border-[#00ff41]/20"
      style={{ width: size, height: size }}
    />
  )
}

function ProgressRing({ value, max, size = 60, label }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const progress = max > 0 ? (value / max) * circumference : 0

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(0,255,65,0.08)" strokeWidth="3"
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#00ff41" strokeWidth="3"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
            strokeLinecap="round"
            className="drop-shadow-[0_0_4px_rgba(0,255,65,0.5)]"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-[#00ff41] font-mono">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{label}</span>
    </div>
  )
}

export default function WelcomeScreen({ stats, onQuickPrompt }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center px-4 py-6 sm:py-12 overflow-y-auto relative">
      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${15 + i * 14}%`,
            animationDuration: `${8 + i * 3}s`,
            animationDelay: `${i * 1.5}s`,
          }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl text-center relative z-10 mt-auto mb-auto pt-6 pb-2"
      >
        {/* Radar rings behind shield */}
        <div className="relative flex items-center justify-center mb-5">
          <RadarRing size={120} delay={0} />
          <RadarRing size={90} delay={0.1} />
          <RadarRing size={60} delay={0.2} />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          >
            <Shield size={32} className="text-[#00ff41] drop-shadow-[0_0_12px_rgba(0,255,65,0.5)]" />
          </motion.div>
        </div>

        <h1 className="text-2xl font-bold text-gray-100 mb-1 tracking-tight">
          Defense <span className="text-[#00ff41] animate-text-glow">GPT</span>
        </h1>
        <p className="text-xs text-gray-500 mb-2 font-mono uppercase tracking-[0.2em]">
          AI-Powered Defense Exam Intelligence
        </p>

        {/* Stats Progress Rings */}
        {stats.total_chunks > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4 sm:gap-8 mb-8 py-4"
          >
            <ProgressRing value={stats.total_chunks} max={25000} size={64} label="Intel Chunks" />
            <ProgressRing value={stats.total_pdfs} max={10} size={64} label="Study Docs" />
            <ProgressRing value="24/7" max={1} size={64} label="Operational" />
          </motion.div>
        )}

        {/* Mission Cards */}
        <div className="flex items-center gap-1.5 justify-center mb-3">
          <Crosshair size={12} className="text-[#00ff41]/40" />
          <span className="text-[10px] font-semibold text-[#00ff41]/40 uppercase tracking-[0.15em] font-mono">
            Quick Mission Briefs
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          {QUICK_PROMPTS.map((item, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickPrompt(item.prompt)}
              className="glass-card flex items-start gap-3 p-4 rounded-xl text-left group cursor-pointer"
            >
              <div className="p-1.5 rounded-lg bg-[#00ff41]/5 border border-[#00ff41]/10 group-hover:border-[#00ff41]/30 transition-all duration-300 group-hover:shadow-[0_0_10px_rgba(0,255,65,0.1)]">
                <item.icon size={16} className="text-[#00ff41]/60 group-hover:text-[#00ff41] transition-colors duration-300" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-300 group-hover:text-[#00ff41]/90 transition-colors duration-300">
                  {item.label}
                </div>
                <div className="text-[11px] text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">
                  {item.prompt}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
