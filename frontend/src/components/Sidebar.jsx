"use client"
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Shield,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Trash2,
  MessageSquare,
  LogOut,
  Radar,
  Crosshair,
  Target,
  Menu,
  X
} from 'lucide-react'

const EXAMS = ['General', 'NDA', 'CDS', 'AFCAT', 'Indian Navy', 'CAPF', 'SSB']

export default function Sidebar({
  open, onToggle, chats = [], activeChatId, onSelectChat, onNewChat, onDeleteChat,
  examType, setExamType, session, onSignOut,
}) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close sidebar on mobile when a chat is selected
  const handleSelectChat = (id) => {
    onSelectChat(id)
    if (isMobile) onToggle()
  }

  const sidebarVariants = {
    open: {
      width: isMobile ? '100vw' : 280,
      x: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: "circOut" }
    },
    closed: {
      width: 0,
      x: -300,
      opacity: 0,
      transition: { duration: 0.3, ease: "circIn" }
    }
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={onToggle}
            className="fixed top-1/2 left-0 -translate-y-1/2 z-50 p-2 py-4 rounded-r-xl rounded-l-none glass border border-l-0 border-[#00ff41]/30 hover:border-[#00ff41]/70 shadow-[5px_0_20px_rgba(0,255,65,0.15)] group bg-[#070e09]/90 backdrop-blur-md flex items-center justify-center"
          >
            {isMobile ? <Menu size={20} className="text-[#00ff41]" /> : <PanelLeft size={20} className="text-[#00ff41]/60 group-hover:text-[#00ff41]" />}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {open && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55]"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside
            variants={sidebarVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className={`fixed lg:static h-screen glass border-r border-[#00ff41]/10 flex flex-col overflow-hidden z-[60] ${isMobile ? 'max-w-[300px]' : ''}`}
          >
            {/* Scan line effect */}
            <div className="absolute inset-0 scan-line pointer-events-none opacity-20" />

            <div className={`flex flex-col h-full relative z-10 ${isMobile ? 'w-[300px]' : 'w-[280px]'}`}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-5 border-b border-[#00ff41]/10">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  >
                    <Shield size={22} className="text-[#00ff41] drop-shadow-[0_0_8px_rgba(0,255,65,0.5)]" />
                  </motion.div>
                  <span className="font-black text-sm text-[#00ff41] tracking-widest uppercase italic animate-text-glow">
                    Defense GPT
                  </span>
                </div>
                <button
                  onClick={onToggle}
                  className="p-2 rounded-lg hover:bg-[#00ff41]/10 transition-all duration-300 text-[#00ff41]/50 hover:text-[#00ff41]"
                >
                  {isMobile ? <X size={20} /> : <PanelLeftClose size={18} />}
                </button>
              </div>

              {/* New Mission / Quiz */}
              <div className="px-4 pt-4 space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onNewChat}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl btn-tactical border border-[#00ff41]/20 text-xs font-black uppercase tracking-widest text-[#00ff41]/80 hover:text-[#00ff41] bg-[#00ff41]/5"
                >
                  <Plus size={16} strokeWidth={3} />
                  <span>New Mission</span>
                </motion.button>

                <Link href="/quiz" onClick={() => isMobile && onToggle()}>
                  <motion.button
                    whileHover={{ scale: 1.02, x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full mt-2 flex items-center gap-3 px-4 py-3 rounded-xl border border-[#00ff41]/20 bg-[#00ff41]/5 text-xs font-black uppercase tracking-widest text-[#00ff41] group hover:border-[#00ff41]/50 transition-all shadow-[0_0_15px_rgba(0,255,65,0.05)]"
                  >
                    <Target size={16} strokeWidth={3} className="group-hover:rotate-45 transition-transform" />
                    <span>Tactical Evaluation</span>
                  </motion.button>
                </Link>
              </div>

              {/* Exam Focus */}
              <div className="px-4 pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Crosshair size={12} className="text-[#00ff41]/40" />
                  <label className="text-[10px] font-black text-[#00ff41]/30 uppercase tracking-[0.2em]">
                    Target Exam
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMS.map(ex => (
                    <motion.button
                      key={ex}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setExamType(ex)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${examType === ex
                        ? 'bg-[#00ff41]/20 text-[#00ff41] border border-[#00ff41]/40 shadow-[0_0_10px_rgba(0,255,65,0.1)]'
                        : 'bg-[#0a140c]/40 text-slate-500 border border-[#00ff41]/5 hover:border-[#00ff41]/20 hover:text-[#00ff41]/70'
                        }`}
                    >
                      {ex}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Chat History */}
              <div className="flex-1 overflow-y-auto px-4 pt-6 min-h-0 custom-scrollbar">
                <div className="flex items-center gap-2 mb-3">
                  <Radar size={12} className="text-[#00ff41]/40" />
                  <label className="text-[10px] font-black text-[#00ff41]/30 uppercase tracking-[0.2em]">
                    Mission Log
                  </label>
                </div>
                <div className="space-y-1 pb-4">
                  {chats.map(chat => (
                    <motion.div
                      key={chat.id}
                      whileHover={{ x: 4 }}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-300 border ${activeChatId === chat.id
                        ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/20 shadow-[inset_0_0_15px_rgba(0,255,65,0.05)]'
                        : 'text-slate-500 hover:bg-[#00ff41]/5 hover:text-white border-transparent'
                        }`}
                      onClick={() => handleSelectChat(chat.id)}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full transition-all ${activeChatId === chat.id ? 'bg-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,1)] scale-125' : 'bg-slate-800'
                        }`} />
                      <MessageSquare size={14} className="shrink-0 opacity-40 group-hover:opacity-100" />
                      <span className="flex-1 text-sm font-medium truncate tracking-tight">{chat.title || 'New Mission'}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all duration-200"
                      >
                        <Trash2 size={13} />
                      </button>
                    </motion.div>
                  ))}
                  {chats.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-2 opacity-20">
                      <Radar size={24} className="animate-pulse" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Idle Spectrum</p>
                    </div>
                  )}
                </div>
              </div>

              {/* User / Sign Out */}
              <div className="px-4 pb-4 border-t border-[#00ff41]/10 pt-4 bg-[#050806]/40">
                {session?.user && (
                  <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-[#00ff41]/5 rounded-xl border border-[#00ff41]/10">
                    <div className="w-8 h-8 rounded-lg bg-[#00ff41]/10 border border-[#00ff41]/20 flex items-center justify-center text-xs text-[#00ff41] font-black italic shadow-[0_0_10px_rgba(0,255,65,0.1)]">
                      {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-[#00ff41] leading-none uppercase truncate mb-0.5">Operative</p>
                      <p className="text-[10px] text-slate-500 truncate font-mono">
                        {session.user.email && session.user.email.length > 20 ? session.user.email.substring(0, 17) + '...' : session.user.email || 'AUTHENTICATED'}
                      </p>
                    </div>
                  </div>
                )}
                <motion.button
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 hover:text-red-500 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 transition-all duration-300"
                >
                  <LogOut size={14} />
                  Terminate Connection
                </motion.button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
