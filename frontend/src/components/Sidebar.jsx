'use client'
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'
import Link from 'next/link'
import {
  Plus, Trash2, LogOut, BookOpen, MessageSquare, ChevronRight,
  PanelLeftClose, PanelLeft, X, Menu, BookMarked, CreditCard,
  CheckCircle2, AlertCircle, Loader2
} from 'lucide-react'

const EXAMS = ['General', 'NDA', 'CDS', 'AFCAT', 'Navy', 'CAPF', 'SSB']

// ── Magnetic button hook ──────────────────────────────────────────
function MagneticButton({ children, className, onClick, disabled }) {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 200, damping: 20 })
  const sy = useSpring(y, { stiffness: 200, damping: 20 })

  const handleMouse = (e) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    x.set((e.clientX - cx) * 0.25)
    y.set((e.clientY - cy) * 0.25)
  }

  const reset = () => { x.set(0); y.set(0) }

  return (
    <motion.button
      ref={ref}
      style={{ x: sx, y: sy }}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      onClick={onClick}
      disabled={disabled}
      className={className}
      whileTap={{ scale: 0.97 }}
    >
      {children}
    </motion.button>
  )
}

export default function Sidebar({
  open, onToggle, chats = [], activeChatId, onSelectChat, onNewChat, onDeleteChat,
  examType, setExamType, session, onSignOut, saveStatus = 'idle',
}) {
  const [isMobile, setIsMobile] = useState(false)
  const [hoverDelete, setHoverDelete] = useState(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleSelectChat = (id) => {
    onSelectChat(id)
    if (isMobile) onToggle()
  }

  const saveIndicator = {
    saving: { color: '#f59e0b', label: 'Saving' },
    saved:  { color: '#22c55e', label: 'Saved' },
    error:  { color: '#ef4444', label: 'Error' },
    idle:   { color: '#374151', label: 'Idle' },
  }[saveStatus] || { color: '#374151', label: 'Idle' }

  const sidebarContent = (
    <div className="flex flex-col h-full w-[260px] bg-[#141518] border-r border-white/[0.06]">

      {/* ── Logo row ── */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
            <BookOpen size={14} className="text-[#22c55e]" />
          </div>
          <span className="font-bold text-sm text-white tracking-tight font-geist">
            Defense GPT
          </span>
        </div>
        {isMobile && (
          <button onClick={onToggle} className="p-1.5 rounded-md text-[#6b7280] hover:text-white hover:bg-white/[0.05] transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── New chat button ── */}
      <div className="px-3 pt-3 shrink-0">
        <MagneticButton
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-[#22c55e] text-[#0c0d0f] text-sm font-semibold hover:bg-[#16a34a] transition-colors"
        >
          <Plus size={16} strokeWidth={2.5} />
          New Chat
        </MagneticButton>
      </div>

      {/* ── Exam selector ── */}
      <div className="px-3 pt-5 shrink-0">
        <p className="text-[10px] font-geist-mono font-semibold text-[#4b5563] uppercase tracking-widest mb-2 px-1">
          Exam Focus
        </p>
        <div className="flex flex-wrap gap-1.5">
          {EXAMS.map((ex, i) => (
            <motion.button
              key={ex}
              layout
              onClick={() => setExamType(ex)}
              whileTap={{ scale: 0.94 }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium font-geist-mono transition-all duration-150 ${
                examType === ex
                  ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/25'
                  : 'bg-transparent text-[#6b7280] border border-white/[0.05] hover:border-white/[0.10] hover:text-[#9ca3af]'
              }`}
            >
              {ex}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Chat history ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 pt-5">
        <p className="text-[10px] font-geist-mono font-semibold text-[#4b5563] uppercase tracking-widest mb-2 px-1">
          History
        </p>

        <AnimatePresence initial={false}>
          {chats.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-1 py-6 text-center"
            >
              <MessageSquare size={18} className="mx-auto mb-2 text-[#374151]" />
              <p className="text-xs text-[#4b5563] font-geist">No chats yet</p>
            </motion.div>
          ) : (
            <div className="space-y-0.5">
              {chats.map((chat, i) => (
                <motion.div
                  key={chat.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 28 }}
                  onMouseEnter={() => setHoverDelete(chat.id)}
                  onMouseLeave={() => setHoverDelete(null)}
                  onClick={() => handleSelectChat(chat.id)}
                  className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                    activeChatId === chat.id
                      ? 'bg-white/[0.06] text-white'
                      : 'text-[#6b7280] hover:bg-white/[0.03] hover:text-[#9ca3af]'
                  }`}
                >
                  {/* Active indicator */}
                  <AnimatePresence>
                    {activeChatId === chat.id && (
                      <motion.div
                        layoutId="chat-indicator"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        exit={{ scaleY: 0 }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#22c55e] rounded-full"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                  </AnimatePresence>

                  <span className="flex-1 text-[13px] truncate leading-tight">{chat.title || 'Untitled Chat'}</span>

                  <AnimatePresence>
                    {hoverDelete === chat.id && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id) }}
                        className="p-1 rounded text-[#4b5563] hover:text-[#ef4444] hover:bg-red-500/10 transition-colors shrink-0"
                      >
                        <Trash2 size={13} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom links + user ── */}
      <div className="px-3 pb-4 pt-3 border-t border-white/[0.05] shrink-0 space-y-1">

        {/* Quiz link */}
        <Link href="/quiz" onClick={() => isMobile && onToggle()}>
          <motion.div
            whileHover={{ x: 3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#6b7280] hover:text-[#9ca3af] hover:bg-white/[0.03] cursor-pointer transition-colors text-[13px]"
          >
            <BookMarked size={14} />
            Practice Quiz
            <ChevronRight size={12} className="ml-auto opacity-40" />
          </motion.div>
        </Link>

        {/* Plans link */}
        <Link href="/plans" onClick={() => isMobile && onToggle()}>
          <motion.div
            whileHover={{ x: 3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#6b7280] hover:text-[#9ca3af] hover:bg-white/[0.03] cursor-pointer transition-colors text-[13px]"
          >
            <CreditCard size={14} />
            Plans
            <ChevronRight size={12} className="ml-auto opacity-40" />
          </motion.div>
        </Link>

        {/* Save status + user row */}
        {session?.user?.email ? (
          <div className="flex items-center gap-2 px-3 py-2 mt-1">
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0 animate-status"
              style={{ backgroundColor: saveIndicator.color }}
            />
            <span className="text-[11px] text-[#4b5563] font-geist-mono flex-1 truncate">
              {session.user.email}
            </span>
            <button
              onClick={onSignOut}
              className="p-1 rounded text-[#374151] hover:text-[#ef4444] hover:bg-red-500/10 transition-colors"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <Link href="/login">
            <div className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer">
              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#22c55e]" />
              <span className="flex-1 font-geist-mono text-[11px] text-[#9ca3af]">Guest Mode</span>
              <span className="text-[11px] text-[#22c55e] font-semibold">Sign In →</span>
            </div>
          </Link>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop — always visible */}
      <div className="hidden lg:flex h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile toggle button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            onClick={onToggle}
            className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#141518] border border-white/[0.08] text-[#6b7280] hover:text-white transition-colors shadow-lg"
          >
            <Menu size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && isMobile && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 350, damping: 32 }}
            className="lg:hidden fixed left-0 top-0 h-full z-50 shadow-2xl"
          >
            {sidebarContent}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
