'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, ArrowDown, Sparkles, Mic, Paperclip, X, Image as ImageIcon, Lock, Settings2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import MessageBubble from './MessageBubble'
import SettingsPanel from './SettingsPanel'
import { askStream } from '@/lib/api'

export default function ChatArea({
  messages, setMessages, settings, isLoading, setIsLoading,
  hidden, onFirstMessage,
}) {
  const [input, setInput] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const abortRef = useRef(null)
  const sentRef = useRef(false)
  const tokenQueueRef = useRef([])
  const drainTimerRef = useRef(null)
  const streamDoneRef = useRef(false)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)
  const fileInputRef = useRef(null)
  const [image, setImage] = useState(null)
  const [loadingStageIndex, setLoadingStageIndex] = useState(0)
  const [toasts, setToasts] = useState([])
  const [usage, setUsage] = useState(0)
  const [usageLimit, setUsageLimit] = useState(8)
  const [locked, setLocked] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [agentStep, setAgentStep] = useState('')
  const requestStartedAtRef = useRef(0)

  const loadingStages = [
    'Searching knowledge base...',
    'Retrieving context...',
    'Fetching web signals...',
    'Generating response...',
    'Finalizing...',
  ]
  const modeOrder = ['hybrid', 'pdf_only', 'web_only']

  const pushToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  // Image upload
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { pushToast('File too large. Maximum 5MB.', 'error'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setImage(ev.target.result)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setInput(t)
    }
    r.onerror = () => setIsListening(false)
    r.onend = () => setIsListening(false)
    recognitionRef.current = r
  }, [])

  // Fetch usage
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch('/api/usage')
        const data = await res.json()
        setUsage(data.usage || 0)
        setUsageLimit(data.limit || 5)
        if ((data.usage || 0) >= (data.limit || 5)) setLocked(true)
      } catch {}
    }
    fetchUsage()
  }, [])

  const tryIncrementUsage = async () => {
    try {
      const res = await fetch('/api/usage', { method: 'POST' })
      if (res.status === 200) {
        const data = await res.json()
        setUsage(data.usage || 0)
        setUsageLimit(data.limit || 5)
        if ((data.usage || 0) >= (data.limit || 5)) setLocked(true)
        return true
      }
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}))
        if (data.usage) setUsage(data.usage)
        if (data.limit) setUsageLimit(data.limit)
        setShowLimitModal(true)
        setLocked(true)
        return false
      }
      return false
    } catch { return false }
  }

  const toggleListening = () => {
    if (!recognitionRef.current) { pushToast('Voice input not supported in this browser.', 'error'); return }
    if (isListening) { recognitionRef.current.stop(); setIsListening(false) }
    else { setInput(''); recognitionRef.current.start(); setIsListening(true) }
  }

  // Token drain
  const TYPING_MS = 20
  const appendToken = useCallback((text) => {
    setMessages(prev => {
      const msgs = [...prev]
      const last = msgs[msgs.length - 1]
      if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, content: last.content + text }
      return msgs
    })
  }, [setMessages])

  const startDraining = useCallback(() => {
    if (drainTimerRef.current) return
    drainTimerRef.current = setInterval(() => {
      if (tokenQueueRef.current.length > 0) {
        appendToken(tokenQueueRef.current.shift())
      } else if (streamDoneRef.current) {
        clearInterval(drainTimerRef.current)
        drainTimerRef.current = null
        setIsLoading(false)
      }
    }, TYPING_MS)
  }, [appendToken, setIsLoading])

  useEffect(() => () => { if (drainTimerRef.current) clearInterval(drainTimerRef.current) }, [])

  // Loading stage
  useEffect(() => {
    if (!isLoading) { setLoadingStageIndex(0); return }
    const startedAt = Date.now()
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      setLoadingStageIndex(Math.min(Math.floor(elapsed / 2), loadingStages.length - 1))
    }, 250)
    return () => clearInterval(timer)
  }, [isLoading])

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [])
  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100)
  }

  // Auto-send for first message
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'user' && !isLoading && !sentRef.current) {
      sentRef.current = true
      handleSend(messages[0].content, messages[0].image)
    }
    if (messages.length === 0) sentRef.current = false
  }, [messages, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  const handleSend = async (text, overrideImage = null) => {
    const query = text || input.trim()
    const activeImage = overrideImage || image
    if (!query && !activeImage) return
    if (isLoading) return
    if (locked) { setShowLimitModal(true); return }

    const allowed = await tryIncrementUsage()
    if (!allowed) return

    setInput('')
    setAgentStep('')
    if (!overrideImage) removeImage()

    if (messages.length === 0 && !text && onFirstMessage) {
      onFirstMessage(query, activeImage)
      return
    }

    if (!text) setMessages(prev => [...prev, { role: 'user', content: query, image: activeImage }])

    setIsLoading(true)
    requestStartedAtRef.current = Date.now()
    setSuggestions([])
    streamDoneRef.current = false
    tokenQueueRef.current = []
    if (drainTimerRef.current) { clearInterval(drainTimerRef.current); drainTimerRef.current = null }

    setMessages(prev => [...prev, { role: 'assistant', content: '', sources: null }])

    const chatHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }))

    const controller = askStream(
      query, settings.examType, settings.model, settings.temperature,
      settings.topK, settings.sourceFilter, settings.useLiveWebSearch,
      settings.contextMode, chatHistory, activeImage,
      {
        onToken: (token) => { tokenQueueRef.current.push(token); startDraining() },
        onAgentStep: (step) => setAgentStep(step),
        onSources: (sources) => {
          setMessages(prev => {
            const msgs = [...prev]
            const last = msgs[msgs.length - 1]
            if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, sources }
            return msgs
          })
        },
        onSuggestions: (s) => setSuggestions(s),
        onDone: () => {
          streamDoneRef.current = true
          if (tokenQueueRef.current.length === 0) {
            if (drainTimerRef.current) { clearInterval(drainTimerRef.current); drainTimerRef.current = null }
            setIsLoading(false)
          }
        },
        onError: (err) => {
          streamDoneRef.current = true
          if (drainTimerRef.current) { clearInterval(drainTimerRef.current); drainTimerRef.current = null }
          setMessages(prev => {
            const msgs = [...prev]
            const last = msgs[msgs.length - 1]
            if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, content: `Error: ${err}` }
            return msgs
          })
          setIsLoading(false)
        },
      }
    )
    abortRef.current = controller
  }

  const handleStop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    streamDoneRef.current = true
    if (drainTimerRef.current) { clearInterval(drainTimerRef.current); drainTimerRef.current = null }
    const remaining = tokenQueueRef.current.splice(0).join('')
    if (remaining) appendToken(remaining)
    setIsLoading(false)
  }

  const handleRegenerate = (p) => { if (!p || isLoading) return; setMessages(prev => [...prev, { role: 'user', content: p }]); handleSend(p) }
  const handleSummarize = (c) => { if (!c || isLoading) return; const p = `Summarize your previous answer in 5 crisp bullet points with key terms bolded.\n\nAnswer:\n${c.slice(0, 3000)}`; setMessages(prev => [...prev, { role: 'user', content: 'Summarize that in 5 key bullets.' }]); handleSend(p) }
  const handleCreateQuizFromAnswer = (c) => { if (!c || isLoading) return; if (locked) { setShowLimitModal(true); return }; const p = `Create a 5-question MCQ quiz from your previous answer.\n\nAnswer:\n${c.slice(0, 3000)}`; setMessages(prev => [...prev, { role: 'user', content: 'Create a 5-question quiz from that answer.' }]); handleSend(p) }

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSend(); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  useEffect(() => {
    const onKey = (e) => {
      const inEditable = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (e.key === '/' && !inEditable && !e.ctrlKey) { e.preventDefault(); textareaRef.current?.focus() }
      if (e.key === 'Escape' && isLoading) { e.preventDefault(); handleStop() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLoading])

  /* ─── Input bar ─── */
  const inputBarElement = (
    <div
      className="bg-[#0c0d0f]/95 backdrop-blur-md border-t border-white/[0.05] px-3 sm:px-6 pt-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.875rem)' }}
    >
      <div className="max-w-3xl mx-auto w-full relative">

        {/* Settings panel (anchored above input) */}
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} />

        {/* Image preview */}
        <AnimatePresence>
          {image && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="mb-2 inline-flex items-center gap-2 bg-[#1c1e22] border border-white/[0.08] rounded-lg pl-2.5 pr-1.5 py-1.5"
            >
              <ImageIcon size={13} className="text-[#6b7280]" />
              <span className="text-xs text-[#6b7280]">Image attached</span>
              <img src={image} alt="preview" className="w-6 h-6 object-cover rounded ml-1" />
              <button onClick={removeImage} className="p-1 rounded text-[#4b5563] hover:text-[#ef4444] hover:bg-red-500/10 transition-colors">
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main input bar */}
        <motion.div
          layout
          className="flex items-end gap-2 bg-[#141518] border border-white/[0.08] rounded-xl px-3 py-2.5 focus-within:border-white/[0.15] transition-all duration-200"
        >
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />

          {/* Left icons */}
          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { if (locked) { setShowLimitModal(true); return }; fileInputRef.current?.click() }}
              className="p-1.5 rounded-md text-[#4b5563] hover:text-[#6b7280] hover:bg-white/[0.04] transition-colors"
              title="Attach image"
            >
              <Paperclip size={15} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { if (locked) { setShowLimitModal(true); return }; toggleListening() }}
              className={`p-1.5 rounded-md transition-all ${isListening ? 'text-[#ef4444] bg-red-500/10' : 'text-[#4b5563] hover:text-[#6b7280] hover:bg-white/[0.04]'}`}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              <Mic size={15} className={isListening ? 'animate-status' : ''} />
            </motion.button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={locked ? 'Usage limit reached. Upgrade to continue.' : 'Ask anything about NDA, CDS, AFCAT…'}
            disabled={locked}
            rows={1}
            className="flex-1 bg-transparent text-sm text-[#f0f0f0] placeholder-[#374151] resize-none outline-none max-h-40 leading-relaxed font-geist"
          />

          {/* Right icons */}
          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setSettingsOpen(v => !v)}
              className={`p-1.5 rounded-md transition-colors ${settingsOpen ? 'text-[#22c55e] bg-[#22c55e]/10' : 'text-[#4b5563] hover:text-[#6b7280] hover:bg-white/[0.04]'}`}
              title="Settings"
            >
              <Settings2 size={15} />
            </motion.button>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.button
                  key="stop"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleStop}
                  className="p-1.5 rounded-md bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/15 transition-colors border border-[#ef4444]/20"
                  title="Stop"
                >
                  <Square size={14} />
                </motion.button>
              ) : (
                <motion.button
                  key="send"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { if (locked) { setShowLimitModal(true); return }; handleSend() }}
                  disabled={(!input.trim() && !image) || locked}
                  className="p-1.5 rounded-md bg-[#22c55e] text-[#0c0d0f] hover:bg-[#16a34a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Send (Enter)"
                >
                  <Send size={14} strokeWidth={2.5} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Usage + hint row */}
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[11px] text-[#374151] font-geist-mono">
            {usage}/{usageLimit} messages used
            {locked && <span className="text-[#ef4444] ml-2">· Limit reached</span>}
          </span>
          <span className="text-[11px] text-[#374151] font-geist-mono hidden sm:block">Enter to send · Shift+Enter for newline</span>
        </div>
      </div>
    </div>
  )

  if (hidden) return inputBarElement

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-2">
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              messageIndex={i}
              allMessages={messages}
              isStreaming={isLoading && i === messages.length - 1 && msg.role === 'assistant'}
              onRegenerate={handleRegenerate}
              onSummarize={handleSummarize}
              onCreateQuiz={handleCreateQuizFromAnswer}
            />
          ))}
        </div>

        {/* Loading indicator */}
        {isLoading && messages[messages.length - 1]?.content === '' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto px-4 sm:px-6 pb-4"
          >
            <div className="pl-0 flex items-start gap-3">
              <div className="mt-1 shrink-0 w-6 h-6 rounded-md bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-status" />
              </div>
              <div className="bg-[#141518] border border-white/[0.06] rounded-xl px-4 py-3 min-w-[140px]">
                <div className="loading-dots mb-2">
                  <span /><span /><span />
                </div>
                <motion.p
                  key={agentStep || loadingStageIndex}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[11px] text-[#22c55e] font-geist-mono font-medium"
                >
                  {agentStep || loadingStages[loadingStageIndex]}
                </motion.p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Suggestions */}
        <AnimatePresence>
          {!isLoading && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="max-w-3xl mx-auto px-4 sm:px-6 pb-4"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={11} className="text-[#4b5563]" />
                <span className="text-[10px] text-[#4b5563] font-geist-mono uppercase tracking-widest">Suggested follow-ups</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.07, type: 'spring', stiffness: 400, damping: 25 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setSuggestions([]); setInput(''); setMessages(prev => [...prev, { role: 'user', content: s }]); handleSend(s) }}
                    className="text-xs text-[#6b7280] bg-[#141518] border border-white/[0.07] rounded-lg px-3 py-1.5 hover:text-[#9ca3af] hover:border-white/[0.12] transition-all"
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2"
          >
            <button
              onClick={scrollToBottom}
              className="p-2 rounded-full bg-[#1c1e22] border border-white/[0.10] text-[#6b7280] hover:text-white shadow-lg transition-colors hover:bg-[#23262b]"
            >
              <ArrowDown size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      {inputBarElement}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={`toast pointer-events-auto ${t.type === 'error' ? 'toast-error' : 'toast-success'}`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Limit modal */}
      <AnimatePresence>
        {showLimitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setShowLimitModal(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#141518] border border-white/[0.09] rounded-2xl p-6 w-full max-w-md shadow-2xl"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center shrink-0">
                  <Lock size={18} className="text-[#ef4444]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Usage limit reached</h3>
                  <p className="text-sm text-[#6b7280] leading-relaxed">
                    You've used all {usageLimit} free messages. Upgrade to continue with unlimited queries, live web search, and more.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2.5 justify-end">
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-[#6b7280] hover:text-white hover:bg-white/[0.05] border border-white/[0.07] transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => window.location.href = '/plans'}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#22c55e] text-[#0c0d0f] hover:bg-[#16a34a] transition-colors"
                >
                  View Plans
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
