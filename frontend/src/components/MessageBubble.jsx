"use client"
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Copy, Check, ChevronDown, ChevronUp, FileText, Pin, RotateCcw, ListCollapse, ClipboardList } from 'lucide-react'
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
            type: 'web',
          })
        })
      } catch {
        normalized.push({
          id: `web-${sourceIdx}`,
          title: 'Web source',
          text: s.preview || '',
          link: '',
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

  const pinned = normalized.find(item => item.id === pinnedId) || null

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-[#00ff41]/50 hover:text-[#00ff41]/80 transition-colors duration-300"
      >
        <FileText size={11} />
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {sources.length} intel source{sources.length !== 1 ? 's' : ''}
      </button>
        {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-2 space-y-1.5"
        >
          {pinned && (
            <motion.div
              key={`pinned-${pinned.id}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs glass-card rounded-lg px-3 py-2 border-l-2 border-yellow-400/60 sticky top-2 z-10"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-yellow-300 font-medium font-mono flex items-center gap-1">
                  <Pin size={11} />
                  Pinned: {pinned.title}
                </span>
                <button onClick={() => setPinnedId(null)} className="text-[11px] text-yellow-200/80 hover:text-yellow-100">Unpin</button>
              </div>
              {pinned.text && (
                <p className="text-gray-300 mt-1">{pinned.text}</p>
              )}
              {pinned.link && (
                <a href={pinned.link} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline mt-1 inline-block">Open source</a>
              )}
            </motion.div>
          )}

          {normalized.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`text-xs glass-card rounded-lg px-3 py-2 border-l-2 ${item.type === 'web' ? 'border-blue-400/40 bg-blue-50/5' : 'border-[#00ff41]/30'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`font-medium font-mono ${item.type === 'web' ? 'text-blue-300' : 'text-[#00ff41]/70'}`}>{item.title}</span>
                <button
                  onClick={() => setPinnedId(item.id)}
                  className="text-gray-400 hover:text-yellow-300 transition-colors"
                  title="Pin source"
                >
                  <Pin size={11} />
                </button>
              </div>
              {item.text && (
                <p className="text-gray-300 mt-1 line-clamp-2">{item.text}</p>
              )}
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline mt-1 inline-block">
                  Open source
                </a>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="py-5"
    >
      <div className="max-w-5xl mx-auto px-2 sm:px-4">
        <div className="flex gap-2 sm:gap-3">
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isUser
              ? 'bg-[#1a2a1e] border border-gray-700/50'
              : 'bg-[#00ff41]/10 border border-[#00ff41]/20 shadow-[0_0_10px_rgba(0,255,65,0.1)]'
              }`}
          >
            {isUser ? (
              <span className="text-[10px] sm:text-xs text-gray-400 font-mono font-medium">U</span>
            ) : (
              <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#00ff41] drop-shadow-[0_0_4px_rgba(0,255,65,0.5)]" />
            )}
          </motion.div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.12em] mb-1 sm:mb-1.5 font-mono">
              {isUser ? (
                <span className="text-gray-500">Operator</span>
              ) : (
                <span className="text-[#00ff41]/60">Defense GPT</span>
              )}
            </div>

            {isUser ? (
              <div className="glass-card rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border-[#1a2a1e]/50 max-w-[72ch]">
                <p className="text-sm sm:text-[15px] text-gray-100 leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : (
              <motion.div
                className={`glass-card rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border-l-2 border-[#00ff41]/25 ${isStreaming ? 'animate-border-glow' : ''
                  } max-w-[80ch]`}
                whileHover={{ boxShadow: '0 0 25px rgba(0,255,65,0.08)' }}
              >
                <div className="prose-chat">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content || ''}
                  </ReactMarkdown>
                  {isStreaming && (
                    <span className="inline-block w-2 h-4 sm:h-5 bg-[#00ff41] rounded-sm ml-0.5 animate-pulse shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
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
                className="mt-2 flex items-center gap-2 flex-wrap"
              >
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-[#00ff41]/70 transition-colors duration-300"
                >
                  {copied ? <Check size={12} className="text-[#00ff41]" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => setToolsOpen(v => !v)}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-[#00ff41]/70 transition-colors duration-300"
                >
                  <ChevronDown size={12} className={toolsOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  Tools
                </button>
              </motion.div>
            )}

            {!isUser && message.content && toolsOpen && (
              <div className="mt-2 glass-card rounded-lg px-3 py-2 border border-[#00ff41]/15 flex items-center gap-2 flex-wrap text-xs">
                <button
                  onClick={() => onRegenerate?.(previousUserPrompt)}
                  disabled={!previousUserPrompt}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#00ff41]/20 text-gray-300 hover:text-[#00ff41] disabled:opacity-40"
                >
                  <RotateCcw size={12} />
                  Regenerate
                </button>
                <button
                  onClick={() => onSummarize?.(message.content)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#00ff41]/20 text-gray-300 hover:text-[#00ff41]"
                >
                  <ListCollapse size={12} />
                  Summarize
                </button>
                <button
                  onClick={() => onCreateQuiz?.(message.content)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#00ff41]/20 text-gray-300 hover:text-[#00ff41]"
                >
                  <ClipboardList size={12} />
                  Create quiz
                </button>
              </div>
            )}

            {/* Sources */}
            {!isUser && message.sources && (
              <SourcesPanel sources={message.sources} />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
