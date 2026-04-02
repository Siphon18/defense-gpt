"use client"
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Copy, Check, ChevronDown, ChevronUp, FileText, Pin, RotateCcw, ListCollapse, ClipboardList, AlertTriangle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function SourcesPanel({ sources }) {
  const [open, setOpen] = useState(false)
  const [pinnedId, setPinnedId] = useState(null)
  if (!sources || sources.length === 0) return null

  const normalized = []
  sources.forEach((s, sourceIdx) => {
    if (s.source === 'web') {
      try {
        const items = JSON.parse(s.preview || '[]')
        items.forEach((item, itemIdx) => {
          normalized.push({
            id: `web-${sourceIdx}-${itemIdx}`,
            title: item.title || 'Web source',
            text: item.snippet || item.content || '',
            link: item.link || '',
            trust: item.trust || 'medium',
            type: 'web',
          })
        })
      } catch {
        normalized.push({
          id: `web-${sourceIdx}`,
          title: 'Web source',
          text: s.preview || '',
          link: '',
          trust: 'medium',
          type: 'web',
        })
      }
      return
    }

    normalized.push({
      id: `doc-${sourceIdx}`,
      title: `${s.source}${s.page ? ` (p.${s.page})` : ''}`,
      text: s.preview || s.text || '',
      link: '',
      type: 'doc',
    })
  })

  // Exclude pinned source from main list to avoid duplicates visually
  const pinned = normalized.find(item => item.id === pinnedId) || null
  const unpinnedSources = normalized.filter(item => item.id !== pinnedId)

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-[#00ffff]/60 hover:text-[#00ffff] transition-colors duration-300 font-mono tracking-widest uppercase"
      >
        <FileText size={12} className={open ? "text-[#00ff41]" : ""} />
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {sources.length} Intel Record{sources.length !== 1 ? 's' : ''}
      </button>
        <AnimatePresence>
        {open && (
        <motion.div
           initial={{ opacity: 0, height: 0 }}
           animate={{ opacity: 1, height: 'auto' }}
           exit={{ opacity: 0, height: 0 }}
           className="mt-3 space-y-2 overflow-hidden"
        >
          {pinned && (
            <motion.div
              key={`pinned-${pinned.id}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs glass-card rounded-lg px-3 py-2 border-l-2 border-[#ffb700] sticky top-2 z-10 shadow-[0_4px_20px_rgba(255,183,0,0.1)] bg-[#ffb700]/5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#ffb700] font-bold font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Pin size={12} className="fill-current rotate-45" />
                  Priority Intel: {pinned.title}
                </span>
                <button onClick={() => setPinnedId(null)} className="text-[10px] uppercase font-bold text-[#ffb700]/70 hover:text-[#ffb700] transition-colors bg-[#ffb700]/10 px-2 py-0.5 rounded">Unpin</button>
              </div>
              {pinned.text && (
                <p className="text-gray-300 mt-2 font-serif leading-relaxed italic border-l border-[#ffb700]/20 pl-2">{pinned.text}</p>
              )}
              {pinned.link && (
                <a href={pinned.link} target="_blank" rel="noopener noreferrer" className="text-[#00ffff] hover:text-white transition-colors underline mt-2 inline-block font-mono">Access original &gt;</a>
              )}
            </motion.div>
          )}

          {unpinnedSources.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`text-xs glass-card rounded-lg px-3 py-2 border-l-2 hover:bg-white/5 transition-colors ${item.type === 'web' ? 'border-[#00ffff]/50' : 'border-[#00ff41]/50'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`font-bold font-mono tracking-wide ${item.type === 'web' ? 'text-[#00ffff]' : 'text-[#00ff41]'}`}>{item.title}</span>
                <div className="flex items-center gap-2">
                  {item.type === 'web' && (
                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${item.trust === 'high' ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/30' : 'bg-[#ffb700]/10 text-[#ffb700] border-[#ffb700]/30'}`}>
                      {item.trust}
                    </span>
                  )}
                  <button
                    onClick={() => setPinnedId(item.id)}
                    className="text-gray-500 hover:text-[#ffb700] transition-colors"
                    title="Pin intel payload"
                  >
                    <Pin size={12} />
                  </button>
                </div>
              </div>
              {item.text && (
                <p className="text-gray-400 mt-1.5 line-clamp-2 font-mono text-[11px] leading-relaxed opacity-80">{item.text}</p>
              )}
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[#00ffff]/70 hover:text-[#00ffff] transition-colors underline mt-1.5 inline-block font-mono text-[10px] uppercase">
                  Verify source &gt;
                </a>
              )}
            </motion.div>
          ))}
        </motion.div>
        )}
        </AnimatePresence>
    </div>
  )
}

export default function MessageBubble({
  message,
  isStreaming,
  messageIndex,
  allMessages = [],
  onRegenerate,
  onSummarize,
  onCreateQuiz,
}) {
  const [copied, setCopied] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  
  const isUser = message.role === 'user'
  
  // Create a pseudo-random serial number based on index to look tactical
  const messageSerial = `OP-${String(messageIndex * 137).padStart(4, '0')}`
  const threatLevel = message.content && message.content.toLowerCase().includes('wrong') ? 'ELEVATED' : 'NOMINAL'

  let previousUserPrompt = ''
  for (let i = messageIndex - 1; i >= 0; i -= 1) {
    if (allMessages[i]?.role === 'user') {
      previousUserPrompt = allMessages[i].content || ''
      break
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="py-6"
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-4">
        <div className={`flex gap-3 sm:gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 mt-1 ${
              isUser
              ? 'bg-[#00ffff]/10 border border-[#00ffff]/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]'
              : 'bg-[#00ff41]/15 border border-[#00ff41]/40 shadow-[0_0_20px_rgba(0,255,65,0.2)]'
            }`}
          >
            {isUser ? (
              <span className="text-[10px] sm:text-[11px] text-[#00ffff] font-black uppercase tracking-tighter">CMD</span>
            ) : (
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-[#00ff41] drop-shadow-[0_0_8px_rgba(0,255,65,0.8)]" />
            )}
          </motion.div>

          {/* Content */}
          <div className={`flex-1 min-w-0 ${isUser ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
            
            <div className={`flex items-center gap-3 mb-1.5 font-mono ${isUser ? 'justify-end' : 'justify-start'}`}>
               <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] ${
                  isUser ? 'text-[#00ffff]/70' : 'text-[#00ff41]/70'
               }`}>
                {isUser ? 'COMMAND UPLINK' : 'SYSTEM RESPONSE'}
               </span>
               {!isUser && (
                 <span className="hidden sm:inline-block text-[8px] px-1 py-0.5 bg-[#00ff41]/10 text-[#00ff41]/50 border border-[#00ff41]/20 rounded tracking-widest uppercase">
                   {messageSerial}
                 </span>
               )}
            </div>

            {isUser ? (
              <div className="glass-card rounded-2xl rounded-tr-sm px-4 py-3 sm:py-4 border-[#00ffff]/20 max-w-[85%] sm:max-w-[70%] bg-[#050B0D]/80">
                <p className="text-sm sm:text-[15px] text-[#e0ffff] leading-relaxed whitespace-pre-wrap font-mono relative z-10">{message.content}</p>
                {message.image && (
                    <div className="mt-3 relative rounded-lg overflow-hidden border border-[#00ffff]/30 inline-block">
                        <img src={message.image} alt="User intel attachment" className="max-w-xs max-h-48 object-contain" />
                        <div className="absolute bottom-1 right-1 bg-black/60 px-2 py-0.5 rounded text-[8px] font-mono text-[#00ffff] border border-[#00ffff]/30 backdrop-blur-sm uppercase">Intel.img</div>
                    </div>
                )}
              </div>
            ) : (
              <motion.div
                className={`glass-card rounded-2xl rounded-tl-sm px-4 sm:px-6 py-4 sm:py-5 border-l-4 ${
                    threatLevel === 'ELEVATED' ? 'border-[#ffb700]/70' : 'border-[#00ff41]/50'
                } max-w-full sm:max-w-[85%] relative overflow-hidden bg-[#0A120C]/80`}
              >
                  {/* Decorative corner accents */}
                 <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[#00ff41]/20 rounded-tr-2xl pointer-events-none opacity-50" />
                 <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-[#00ff41]/20 rounded-br-2xl pointer-events-none opacity-50" />
                 
                {/* Tactical Header for Assistant */}
                <div className="flex items-center gap-4 mb-4 pb-2 border-b border-[#00ff41]/10">
                    <div className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.25em] text-[#00ff41]/80 uppercase">
                        <Shield className="w-3 h-3 text-[#00ff41]" />
                        Intelligence Brief
                    </div>
                    {threatLevel === 'ELEVATED' && (
                        <div className="flex items-center gap-1 text-[9px] font-black tracking-widest text-[#ffb700] bg-[#ffb700]/10 px-2 py-0.5 rounded-sm border border-[#ffb700]/30 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            CRITICAL
                        </div>
                    )}
                </div>

                <div className="prose-chat w-full">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content || ''}
                  </ReactMarkdown>
                  {isStreaming && (
                    <span className="inline-block w-2 h-4 sm:h-5 bg-[#00ff41] rounded-sm ml-1 animate-pulse shadow-[0_0_12px_rgba(0,255,65,0.8)]" />
                  )}
                </div>
              </motion.div>
            )}

            {/* Actions */}
            {!isUser && message.content && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-3 flex items-center gap-3 flex-wrap ml-2"
              >
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-[#00ff41]/40 hover:text-[#00ff41] transition-colors duration-300"
                >
                  {copied ? <Check size={12} className="text-[#00ff41]" /> : <Copy size={12} />}
                  {copied ? 'ACKNOWLEDGED' : 'COPY INTEL'}
                </button>
                <button
                  onClick={() => setToolsOpen(v => !v)}
                  className={`flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors duration-300 ${toolsOpen ? 'text-[#00ffff]' : 'text-[#00ffff]/40 hover:text-[#00ffff]'}`}
                >
                  <ChevronDown size={12} className={toolsOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  COMMAND OPTIONS
                </button>
              </motion.div>
            )}

            {!isUser && message.content && toolsOpen && (
              <motion.div 
                 initial={{ opacity: 0, height: 0 }}
                 animate={{ opacity: 1, height: 'auto' }}
                 className="mt-3 glass-card rounded-xl px-3 py-2.5 border border-[#00ffff]/20 flex items-center gap-2.5 flex-wrap ml-2 bg-[#050D11]/90 shadow-[0_0_15px_rgba(0,255,255,0.05)]"
              >
                <button
                  onClick={() => onRegenerate?.(previousUserPrompt)}
                  disabled={!previousUserPrompt}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#00ffff]/20 text-[#00ffff]/70 hover:text-[#00ffff] hover:bg-[#00ffff]/10 hover:border-[#00ffff]/40 disabled:opacity-40 text-[9px] font-black tracking-widest uppercase transition-all"
                >
                  <RotateCcw size={12} />
                  Re-evaluate
                </button>
                <button
                  onClick={() => onSummarize?.(message.content)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#00ffff]/20 text-[#00ffff]/70 hover:text-[#00ffff] hover:bg-[#00ffff]/10 hover:border-[#00ffff]/40 text-[9px] font-black tracking-widest uppercase transition-all"
                >
                  <ListCollapse size={12} />
                  TL;DR Brief
                </button>
                <button
                  onClick={() => onCreateQuiz?.(message.content)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#00ffff]/20 text-[#00ffff]/70 hover:text-[#00ffff] hover:bg-[#00ffff]/10 hover:border-[#00ffff]/40 text-[9px] font-black tracking-widest uppercase transition-all"
                >
                  <ClipboardList size={12} />
                  Drill Test
                </button>
              </motion.div>
            )}

            {/* Sources */}
            {!isUser && message.sources && (
              <div className="ml-2 w-full max-w-[85%]">
                 <SourcesPanel sources={message.sources} />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
