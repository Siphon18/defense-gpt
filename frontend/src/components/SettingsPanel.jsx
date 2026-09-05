'use client'
import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sliders, Globe, FileText, Layers, Cpu } from 'lucide-react'

const CONTEXT_MODES = [
  { id: 'hybrid',   icon: Layers,   label: 'Hybrid',   desc: 'PDF + Web' },
  { id: 'pdf_only', icon: FileText, label: 'PDF Only', desc: 'Knowledge base only' },
  { id: 'web_only', icon: Globe,    label: 'Web Only',  desc: 'Live search only' },
]

export default function SettingsPanel({
  open,
  onClose,
  settings,
  availableModels = [],
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
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-20 right-4 z-50 w-80 bg-[#1c1e22] border border-white/[0.09] rounded-xl shadow-2xl overflow-hidden"
            style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Sliders size={14} className="text-[#6b7280]" />
                <span className="text-sm font-semibold text-white">Settings</span>
              </div>
              <button onClick={onClose} className="p-1 rounded text-[#4b5563] hover:text-white hover:bg-white/[0.05] transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">

              {/* Model */}
              <div className="space-y-2">
                <label className="text-[11px] font-geist-mono font-semibold text-[#4b5563] uppercase tracking-widest">
                  Model
                </label>
                <div className="space-y-1">
                  {settings.availableModels?.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => settings.setModel(m.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-all duration-150 ${
                        settings.model === m.id
                          ? 'bg-[#22c55e]/10 border border-[#22c55e]/25 text-white'
                          : 'bg-[#141518] border border-white/[0.05] text-[#6b7280] hover:border-white/[0.10] hover:text-[#9ca3af]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Cpu size={13} className={settings.model === m.id ? 'text-[#22c55e]' : 'text-[#374151]'} />
                        <span className="font-medium">{m.label}</span>
                      </div>
                      {m.badge && (
                        <span className={`text-[10px] font-geist-mono px-1.5 py-0.5 rounded ${
                          settings.model === m.id
                            ? 'bg-[#22c55e]/20 text-[#22c55e]'
                            : 'bg-white/[0.05] text-[#4b5563]'
                        }`}>
                          {m.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context mode */}
              <div className="space-y-2">
                <label className="text-[11px] font-geist-mono font-semibold text-[#4b5563] uppercase tracking-widest">
                  Context Mode
                </label>
                <div className="space-y-1">
                  {CONTEXT_MODES.map(({ id, icon: Icon, label, desc }) => (
                    <button
                      key={id}
                      onClick={() => settings.setContextMode(id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 ${
                        settings.contextMode === id
                          ? 'bg-[#22c55e]/10 border border-[#22c55e]/25'
                          : 'bg-[#141518] border border-white/[0.05] hover:border-white/[0.10]'
                      }`}
                    >
                      <Icon size={14} className={settings.contextMode === id ? 'text-[#22c55e]' : 'text-[#374151]'} />
                      <div>
                        <p className={`text-sm font-medium ${settings.contextMode === id ? 'text-white' : 'text-[#6b7280]'}`}>{label}</p>
                        <p className="text-[11px] text-[#4b5563] font-geist-mono">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Web search toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-white">Live Web Search</p>
                  <p className="text-[11px] text-[#4b5563] font-geist-mono mt-0.5">Augment answers with current web data</p>
                </div>
                <button
                  onClick={() => settings.setUseLiveWebSearch(!settings.useLiveWebSearch)}
                  className={`relative w-10 h-5.5 rounded-full border transition-all duration-200 ${
                    settings.useLiveWebSearch
                      ? 'bg-[#22c55e] border-[#22c55e]'
                      : 'bg-[#141518] border-white/[0.10]'
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.useLiveWebSearch ? 18 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-geist-mono font-semibold text-[#4b5563] uppercase tracking-widest">
                    Temperature
                  </label>
                  <span className="text-[11px] font-geist-mono text-[#22c55e]">{settings.temperature?.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0" max="1" step="0.1"
                  value={settings.temperature || 0.3}
                  onChange={(e) => settings.setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-[#23262b] accent-[#22c55e] cursor-pointer"
                />
                <div className="flex justify-between">
                  <span className="text-[10px] text-[#374151] font-geist-mono">Precise</span>
                  <span className="text-[10px] text-[#374151] font-geist-mono">Creative</span>
                </div>
              </div>

              {/* Top-K */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-geist-mono font-semibold text-[#4b5563] uppercase tracking-widest">
                    Context Depth (Top-K)
                  </label>
                  <span className="text-[11px] font-geist-mono text-[#22c55e]">{settings.topK || 5}</span>
                </div>
                <input
                  type="range"
                  min="1" max="20" step="1"
                  value={settings.topK || 5}
                  onChange={(e) => settings.setTopK(parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-[#23262b] accent-[#22c55e] cursor-pointer"
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
