'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, ChevronDown, FileText, Globe, Pin, RotateCcw, ListCollapse, ClipboardList } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Sources Panel ──────────────────────────────────────────────────
function SourcesPanel({ sources }) {
  const [open, setOpen] = useState(false)
  const [pinnedId, setPinnedId] = useState(null)
  if (!sources || sources.length === 0) return null

  const normalized = []
  sources.forEach((s, si) => {
    if (s.source === 'web') {
      try {
        const items = JSON.parse(s.preview || '[]')
        items.forEach((it, ii) => normalized.push({
          id: `web-${si}-${ii}`, title: it.title || 'Web source', text: it.snippet || it.content || '',
          link: it.link || '', trust: it.trust || 'medium', type: 'web',
        }))
      } catch {
        normalized.push({ id: `web-${si}`, title: 'Web source', text: s.preview || '', link: '', trust: 'medium', type: 'web' })
      }
    } else {
      normalized.push({
        id: `doc-${si}`,
        title: `${s.source}${s.page ? ` · p.${s.page}` : ''}`,
        text: s.preview || s.text || '', link: '', type: 'doc',
      })
    }
  })

  const pinned = normalized.find(n => n.id === pinnedId)
  const rest = normalized.filter(n => n.id !== pinnedId)

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.05]">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-[11px] text-[#4b5563] hover:text-[#6b7280] transition-colors font-geist-mono"
      >
        <FileText size={12} />
        <span>{normalized.length} source{normalized.length !== 1 ? 's' : ''}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={12} />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 space-y-1.5 overflow-hidden"
          >
            {pinned && (
              <div className="bg-[#1c1e22] border border-[#f59e0b]/20 rounded-lg px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#f59e0b] font-medium flex items-center gap-1.5">
                    <Pin size={11} className="fill-current" /> {pinned.title}
                  </span>
                  <button onClick={() => setPinnedId(null)} className="text-[10px] text-[#4b5563] hover:text-[#6b7280]">Unpin</button>
                </div>
                {pinned.text && <p className="text-[#6b7280] leading-relaxed line-clamp-3">{pinned.text}</p>}
                {pinned.link && <a href={pinned.link} target="_blank" rel="noopener noreferrer" className="text-[#22c55e] hover:underline mt-1 inline-block text-[10px]">Open source →</a>}
              </div>
            )}
            {rest.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`bg-[#141518] border rounded-lg px-3 py-2.5 text-xs flex gap-2.5 ${
                  item.type === 'web' ? 'border-white/[0.06]' : 'border-white/[0.06]'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {item.type === 'web'
                    ? <Globe size={12} className="text-[#3b82f6]" />
                    : <FileText size={12} className="text-[#22c55e]" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#9ca3af] truncate">{item.title}</p>
                  {item.text && <p className="text-[#4b5563] mt-0.5 line-clamp-2 leading-relaxed">{item.text}</p>}
                  {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[#22c55e]/70 hover:text-[#22c55e] hover:underline mt-0.5 inline-block text-[10px]">Open →</a>}
                </div>
                <button onClick={() => setPinnedId(item.id)} className="p-1 text-[#374151] hover:text-[#f59e0b] transition-colors shrink-0">
                  <Pin size={11} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Message Bubble ─────────────────────────────────────────────────
export default function MessageBubble({ message, isStreaming, messageIndex, allMessages = [], onRegenerate, onSummarize, onCreateQuiz }) {
  const [copied, setCopied] = useState(false)
  const [actionsVisible, setActionsVisible] = useState(false)
  const isUser = message.role === 'user'

  let previousUserPrompt = ''
  for (let i = messageIndex - 1; i >= 0; i--) {
    if (allMessages[i]?.role === 'user') { previousUserPrompt = allMessages[i].content || ''; break }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="py-2"
    >
      {isUser ? (
        /* ── User message ── */
        <div className="flex justify-end">
          <div className="bubble-user max-w-[75%]">
            <p className="leading-relaxed whitespace-pre-wrap text-[#f0f0f0]">{message.content}</p>
            {message.image && (
              <div className="mt-2.5 rounded-lg overflow-hidden border border-white/[0.08] inline-block">
                <img src={message.image} alt="Attached" className="max-w-xs max-h-48 object-contain" />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Assistant message ── */
        <div
          className="bubble-assistant group"
          onMouseEnter={() => setActionsVisible(true)}
          onMouseLeave={() => setActionsVisible(false)}
        >
          <div className="prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || ''}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-[#22c55e] rounded-full ml-0.5 animate-cursor opacity-90" />
            )}
          </div>

          {/* Hover actions */}
          <AnimatePresence>
            {message.content && actionsVisible && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1 mt-3"
              >
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-[#4b5563] hover:text-[#9ca3af] hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-all font-geist-mono"
                >
                  {copied ? <Check size={12} className="text-[#22c55e]" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>

                {onRegenerate && previousUserPrompt && (
                  <button
                    onClick={() => onRegenerate(previousUserPrompt)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-[#4b5563] hover:text-[#9ca3af] hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-all font-geist-mono"
                  >
                    <RotateCcw size={12} /> Retry
                  </button>
                )}

                {onSummarize && (
                  <button
                    onClick={() => onSummarize(message.content)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-[#4b5563] hover:text-[#9ca3af] hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-all font-geist-mono"
                  >
                    <ListCollapse size={12} /> Summarize
                  </button>
                )}

                {onCreateQuiz && (
                  <button
                    onClick={() => onCreateQuiz(message.content)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-[#4b5563] hover:text-[#9ca3af] hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-all font-geist-mono"
                  >
                    <ClipboardList size={12} /> Quiz
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sources */}
          {message.sources && <SourcesPanel sources={message.sources} />}
        </div>
      )}
    </motion.div>
  )
}
