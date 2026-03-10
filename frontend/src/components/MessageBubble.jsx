"use client"
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Copy, Check, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function SourcesPanel({ sources }) {
  const [open, setOpen] = useState(false)
  if (!sources || sources.length === 0) return null

  // Separate web sources
  const webSources = sources.filter(s => s.source === 'web')
  const docSources = sources.filter(s => s.source !== 'web')

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
          {docSources.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="text-xs glass-card rounded-lg px-3 py-2 border-l-2 border-[#00ff41]/30"
            >
              <span className="text-[#00ff41]/70 font-medium font-mono">{s.source}</span>
              {s.text && (
                <p className="text-gray-600 mt-1 line-clamp-2">{s.text}</p>
              )}
            </motion.div>
          ))}
          {webSources.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: docSources.length * 0.05 }}
              className="text-xs glass-card rounded-lg px-3 py-2 border-l-2 border-blue-400/30 bg-blue-50/10"
            >
              <span className="text-blue-400 font-medium font-mono">Web Findings</span>
              <ul className="mt-1 text-gray-600 list-disc pl-4">
                {webSources.map((w, idx) => {
                  try {
                    const items = JSON.parse(w.preview)
                    return items.map((item, j) => (
                      <li key={j} className="mb-1">
                        <span className="font-bold">{item.title}</span>: {item.snippet}
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-400 underline">[source]</a>
                        )}
                      </li>
                    ))
                  } catch {
                    return <li key={idx}>{w.preview}</li>
                  }
                })}
              </ul>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  )
}

export default function MessageBubble({ message, isStreaming }) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

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
      <div className="max-w-3xl mx-auto px-2 sm:px-4">
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
              <div className="glass-card rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border-[#1a2a1e]/50">
                <p className="text-sm sm:text-[15px] text-gray-200 leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : (
              <motion.div
                className={`glass-card rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border-l-2 border-[#00ff41]/25 ${isStreaming ? 'animate-border-glow' : ''
                  }`}
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
                className="mt-2 flex items-center gap-2"
              >
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-[#00ff41]/70 transition-colors duration-300"
                >
                  {copied ? <Check size={12} className="text-[#00ff41]" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </motion.div>
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
