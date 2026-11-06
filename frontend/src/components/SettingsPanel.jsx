'use client'
import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Globe, FileText, Layers, Sparkles } from 'lucide-react'

const CONTEXT_MODES = [
  { id: 'hybrid',   icon: Layers,   label: 'Hybrid Mode',   desc: 'Combines study material with live web intel (Recommended)' },
  { id: 'pdf_only', icon: FileText, label: 'Study Docs Only', desc: 'Syllabus & official defense material only' },
  { id: 'web_only', icon: Globe,    label: 'Live Web Only',  desc: 'Real-time defense news and notifications' },
]

export default function SettingsPanel({
  open,
  onClose,
  settings,
}) {
  const panelRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-20 right-4 sm:right-8 z-50 w-84 bg-[#141518] border border-white/[0.09] rounded-xl shadow-2xl overflow-hidden"
            style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#1c1e22]/50">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-[#22c55e]" />
                <span className="text-sm font-semibold text-white">Knowledge Context</span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded text-[#4b5563] hover:text-white hover:bg-white/[0.05] transition-colors"
                aria-label="Close settings"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Context mode */}
              <div className="space-y-2">
                <label className="text-[11px] font-geist-mono font-semibold text-[#4b5563] uppercase tracking-widest">
                  Context Source
                </label>
                <div className="space-y-1.5">
                  {CONTEXT_MODES.map(({ id, icon: Icon, label, desc }) => {
                    const isSelected = settings.contextMode === id
                    return (
                      <button
                        key={id}
                        onClick={() => settings.setContextMode(id)}
                        className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-all duration-150 ${
                          isSelected
                            ? 'bg-[#22c55e]/10 border border-[#22c55e]/25'
                            : 'bg-[#1c1e22] border border-white/[0.05] hover:border-white/[0.10]'
                        }`}
                      >
                        <div className={`mt-0.5 p-1 rounded-md ${isSelected ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'text-[#6b7280]'}`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-[#9ca3af]'}`}>{label}</p>
                          <p className="text-[11px] text-[#4b5563] leading-snug mt-0.5">{desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Web search toggle */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#1c1e22] border border-white/[0.05]">
                <div>
                  <p className="text-xs font-medium text-white">Live Web Search</p>
                  <p className="text-[11px] text-[#4b5563] leading-snug mt-0.5">Augment answers with live DuckDuckGo signals</p>
                </div>
                <button
                  onClick={() => settings.setUseLiveWebSearch(!settings.useLiveWebSearch)}
                  className={`relative w-9 h-5 rounded-full border transition-all duration-200 shrink-0 ${
                    settings.useLiveWebSearch
                      ? 'bg-[#22c55e] border-[#22c55e]'
                      : 'bg-[#141518] border-white/[0.10]'
                  }`}
                  aria-label="Toggle live web search"
                >
                  <motion.div
                    animate={{ x: settings.useLiveWebSearch ? 16 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>

              {/* Auto model routing indicator note */}
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <Sparkles size={12} className="text-[#22c55e] shrink-0" />
                <p className="text-[10px] text-[#6b7280] font-geist leading-relaxed">
                  <strong className="text-[#9ca3af] font-medium">Smart Auto-Routing:</strong> Models and temperature adapt dynamically to query complexity.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
