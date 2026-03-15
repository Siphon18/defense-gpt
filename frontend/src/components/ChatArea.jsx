"use client"
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, ArrowDown, Sparkles, Mic, Paperclip, X, Image as ImageIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import MessageBubble from './MessageBubble'
import { askStream } from '@/lib/api'

export default function ChatArea({
  messages, setMessages, settings, isLoading, setIsLoading,
  hidden, onFirstMessage,
}) {
  const [input, setInput] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [suggestions, setSuggestions] = useState([])
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
  const [loadingElapsedSec, setLoadingElapsedSec] = useState(0)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [toasts, setToasts] = useState([])
  const [lastLatencyMs, setLastLatencyMs] = useState(null)
  const requestStartedAtRef = useRef(0)

  const loadingStages = [
    'Scanning mission brief...',
    'Retrieving study intel...',
    'Validating web signals...',
    'Drafting tactical response...',
    'Finalizing answer...'
  ]
  const modeOrder = ['hybrid', 'pdf_only', 'web_only']
  const modeLabel = settings.contextMode === 'pdf_only' ? 'PDF' : settings.contextMode === 'web_only' ? 'WEB' : 'HYBRID'
  const showWebSearchAnimation = Boolean(
    isLoading &&
    settings.useLiveWebSearch &&
    (settings.contextMode === 'hybrid' || settings.contextMode === 'web_only')
  )

  const pushToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  // Handle image upload logic
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      pushToast('Intel file too large. Maximum size is 5MB.', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setImage(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true

        recognition.onresult = (event) => {
          let currentTranscript = ''
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript
          }
          setInput(currentTranscript)
        }

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = recognition
      }
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) {
      pushToast('Voice recognition is not supported in this browser.', 'error')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setInput('') // clear previous text before fresh dictation
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  // Drain buffered tokens at typing speed
  const TYPING_MS = 20 // ms between flushes

  const appendToken = useCallback((text) => {
    setMessages(prev => {
      const msgs = [...prev]
      const last = msgs[msgs.length - 1]
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + text }
      }
      return msgs
    })
  }, [setMessages])

  const startDraining = useCallback(() => {
    if (drainTimerRef.current) return
    drainTimerRef.current = setInterval(() => {
      const queue = tokenQueueRef.current
      if (queue.length > 0) {
        const token = queue.shift()
        appendToken(token)
      } else if (streamDoneRef.current) {
        clearInterval(drainTimerRef.current)
        drainTimerRef.current = null
        setIsLoading(false)
      }
    }, TYPING_MS)
  }, [appendToken, setIsLoading])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (drainTimerRef.current) clearInterval(drainTimerRef.current)
    }
  }, [])

  // Improve perceived performance with live progress messaging while loading
  useEffect(() => {
    if (!isLoading) {
      setLoadingStageIndex(0)
      setLoadingElapsedSec(0)
      return
    }

    const startedAt = Date.now()
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      setLoadingElapsedSec(elapsed)
      setLoadingStageIndex(Math.min(Math.floor(elapsed / 2), loadingStages.length - 1))
    }, 250)

    return () => clearInterval(timer)
  }, [isLoading])

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Track scroll position for "scroll to bottom" button
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100)
  }

  // Auto-send when a single user message appears (from quick prompt / first message)
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'user' && !isLoading && !sentRef.current) {
      sentRef.current = true
      // Pass both the content and any attached image from the initial payload
      handleSend(messages[0].content, messages[0].image)
    }
    if (messages.length === 0) {
      sentRef.current = false
    }
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

    setInput('')

    // Clear image from UI if it was manually sent
    if (!overrideImage) {
      removeImage()
    }

    // If no messages yet, delegate to parent to create chat first
    if (messages.length === 0 && !text && onFirstMessage) {
      onFirstMessage(query, activeImage)
      return
    }

    // Add user message if not auto-sent
    if (!text) {
      setMessages(prev => [...prev, { role: 'user', content: query, image: activeImage }])
    }

    setIsLoading(true)
    requestStartedAtRef.current = Date.now()
    setSuggestions([])
    streamDoneRef.current = false
    tokenQueueRef.current = []
    if (drainTimerRef.current) {
      clearInterval(drainTimerRef.current)
      drainTimerRef.current = null
    }

    // Add assistant placeholder
    setMessages(prev => [...prev, { role: 'assistant', content: '', sources: null }])

    const chatHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }))

    // Ask stream, passing image
    const controller = askStream(
      query,
      settings.examType,
      settings.model,
      settings.temperature,
      settings.topK,
      settings.sourceFilter,
      settings.useLiveWebSearch,
      settings.contextMode,
      chatHistory,
      activeImage,
      {
        onToken: (token) => {
          tokenQueueRef.current.push(token)
          startDraining()
        },
        onSources: (sources) => {
          setMessages(prev => {
            const msgs = [...prev]
            const last = msgs[msgs.length - 1]
            if (last?.role === 'assistant') {
              msgs[msgs.length - 1] = { ...last, sources }
            }
            return msgs
          })
        },
        onSuggestions: (s) => setSuggestions(s),
        onDone: () => {
          if (requestStartedAtRef.current) {
            setLastLatencyMs(Date.now() - requestStartedAtRef.current)
          }
          streamDoneRef.current = true
          if (tokenQueueRef.current.length === 0) {
            if (drainTimerRef.current) {
              clearInterval(drainTimerRef.current)
              drainTimerRef.current = null
            }
            setIsLoading(false)
          }
        },
        onError: (err) => {
          if (requestStartedAtRef.current) {
            setLastLatencyMs(Date.now() - requestStartedAtRef.current)
          }
          streamDoneRef.current = true
          if (drainTimerRef.current) {
            clearInterval(drainTimerRef.current)
            drainTimerRef.current = null
          }
          const remaining = tokenQueueRef.current.splice(0).join('')
          setMessages(prev => {
            const msgs = [...prev]
            const last = msgs[msgs.length - 1]
            if (last?.role === 'assistant') {
              msgs[msgs.length - 1] = { ...last, content: `Error: ${err}` }
            }
            return msgs
          })
          setIsLoading(false)
        },
      }
    )

    abortRef.current = controller
  }

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    streamDoneRef.current = true
    if (drainTimerRef.current) {
      clearInterval(drainTimerRef.current)
      drainTimerRef.current = null
    }
    const remaining = tokenQueueRef.current.splice(0).join('')
    if (remaining) {
      appendToken(remaining)
    }
    if (requestStartedAtRef.current) {
      setLastLatencyMs(Date.now() - requestStartedAtRef.current)
    }
    setIsLoading(false)
  }

  const handleRegenerate = (previousPrompt) => {
    if (!previousPrompt || isLoading) return
    setMessages(prev => [...prev, { role: 'user', content: previousPrompt }])
    handleSend(previousPrompt)
  }

  const handleSummarize = (assistantContent) => {
    if (!assistantContent || isLoading) return
    const prompt = `Summarize your previous answer in 5 crisp bullet points with key terms bolded.\n\nAnswer:\n${assistantContent.slice(0, 3000)}`
    setMessages(prev => [...prev, { role: 'user', content: 'Summarize that answer in 5 key bullets.' }])
    handleSend(prompt)
  }

  const handleCreateQuizFromAnswer = (assistantContent) => {
    if (!assistantContent || isLoading) return
    const prompt = `Create a 5-question MCQ quiz from your previous answer. Include 4 options per question, the correct option, and a short explanation.\n\nAnswer:\n${assistantContent.slice(0, 3000)}`
    setMessages(prev => [...prev, { role: 'user', content: 'Create a 5-question quiz from that answer.' }])
    handleSend(prompt)
  }

  const cycleContextMode = () => {
    const current = modeOrder.indexOf(settings.contextMode || 'hybrid')
    const next = modeOrder[(current + 1) % modeOrder.length]
    settings.setContextMode?.(next)
  }

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    const onWindowKeyDown = (e) => {
      const target = e.target
      const inEditable = target instanceof HTMLElement && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShowShortcuts(v => !v)
        return
      }

      if (e.key === '/' && !inEditable && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        textareaRef.current?.focus()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSend()
        return
      }

      if (e.key === 'Escape' && isLoading) {
        e.preventDefault()
        handleStop()
      }
    }

    window.addEventListener('keydown', onWindowKeyDown)
    return () => window.removeEventListener('keydown', onWindowKeyDown)
  }, [handleSend, handleStop, isLoading])

  /* ─── Input Bar Component ─── */
  const inputBarElement = (
    <div
      className="border-t border-[#00ff41]/10 bg-[#0a0f0a]/90 backdrop-blur-md px-2 sm:px-4 pt-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
    >
      <div className="max-w-3xl mx-auto w-full">

        {/* Image Preview Chip */}
        <AnimatePresence>
          {image && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mb-3 inline-flex items-center gap-2 glass-card pr-2 pl-3 py-1.5 rounded-lg border border-[#00ff41]/30 mx-2 sm:mx-0"
            >
              <ImageIcon size={14} className="text-[#00ff41]/70" />
              <span className="text-xs text-[#00ff41]/70 font-mono">Image attached</span>
              <img src={image} alt="Upload preview" className="w-8 h-8 object-cover rounded ml-2" />
              <button
                onClick={removeImage}
                className="p-1 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-md transition-colors ml-1"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass-input flex items-end gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-4 py-2 sm:py-2.5 mx-1 sm:mx-0">
          {/* Hidden File Input */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Attachment button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-[#00ff41]/30 hover:text-[#00ff41]/70 hover:bg-[#00ff41]/5 transition-all duration-300 shrink-0"
            title="Attach image recon"
          >
            <Paperclip size={16} />
          </motion.button>

          {/* Voice button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleListening}
            className={`p-1.5 rounded-lg transition-all duration-300 shrink-0 ${isListening
              ? 'text-red-400 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse border border-red-500/30'
              : 'text-[#00ff41]/30 hover:text-[#00ff41]/70 hover:bg-[#00ff41]/5 border border-transparent'
              }`}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            <Mic size={16} />
          </motion.button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter mission briefing..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none outline-none max-h-40 leading-relaxed font-mono"
          />

          {isLoading ? (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleStop}
              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all duration-300 shrink-0"
            >
              <Square size={14} />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="p-2 rounded-lg text-[#00ff41]/50 hover:text-[#00ff41] hover:bg-[#00ff41]/10 border border-[#00ff41]/10 hover:border-[#00ff41]/30 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:border-[#00ff41]/10 transition-all duration-300 shrink-0 hover:shadow-[0_0_12px_rgba(0,255,65,0.15)]"
            >
              <Send size={16} />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )

  if (hidden) {
    return inputBarElement
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="sticky top-0 z-20 border-b border-[#00ff41]/10 bg-[#0a0f0a]/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-[#00ff41]/60">
            Model: <span className="text-[#00ff41]/90">{settings.model || 'auto'}</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-[#00ff41]/60">
            Exam: <span className="text-[#00ff41]/90">{settings.examType || 'General'}</span>
          </div>
          <button
            onClick={() => settings.setUseLiveWebSearch?.(!settings.useLiveWebSearch)}
            className={`text-[10px] uppercase tracking-[0.18em] font-mono px-2 py-1 rounded-md border ${settings.useLiveWebSearch
              ? 'text-[#00ff41] border-[#00ff41]/35 bg-[#00ff41]/10'
              : 'text-gray-400 border-[#00ff41]/10'
              }`}
            title="Toggle live web search"
          >
            Web {settings.useLiveWebSearch ? 'On' : 'Off'}
          </button>
          <button
            onClick={cycleContextMode}
            className="text-[10px] uppercase tracking-[0.18em] font-mono px-2 py-1 rounded-md border text-[#00ff41]/90 border-[#00ff41]/25 hover:border-[#00ff41]/45"
            title="Cycle context mode"
          >
            Mode {modeLabel}
          </button>
          <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-[#00ff41]/60">
            Last latency: <span className="text-[#00ff41]/90">{lastLatencyMs != null ? `${(lastLatencyMs / 1000).toFixed(1)}s` : '--'}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="divide-y divide-[#00ff41]/5">
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

        {/* Radar Typing Indicator */}
        {isLoading && messages[messages.length - 1]?.content === '' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto px-4 py-5"
          >
            <div className="ml-11 glass-card border border-[#00ff41]/15 rounded-xl px-4 py-3 max-w-md">
              {showWebSearchAnimation && (
                <div className="mb-3 pb-3 border-b border-[#00ff41]/10">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-[#00ff41]/60 font-mono uppercase tracking-[0.18em]">
                      Searching Trusted Sources
                    </span>
                    <span className="text-[10px] text-[#00ff41]/45 font-mono uppercase tracking-wider">
                      LIVE
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {[
                      { code: 'G', label: 'Grounding' },
                      { code: 'F', label: 'Fallback' },
                      { code: 'V', label: 'Verify' },
                    ].map((node, idx) => (
                      <motion.div
                        key={node.code}
                        className="h-6 px-2 rounded-full border border-[#00ff41]/25 bg-[#00ff41]/5 text-[10px] text-[#00ff41]/70 font-mono flex items-center gap-1"
                        initial={{ opacity: 0.35, scale: 0.96 }}
                        animate={{ opacity: [0.35, 1, 0.35], scale: [0.96, 1.03, 0.96] }}
                        transition={{ duration: 1.3, delay: idx * 0.2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <span className="inline-block w-3.5 h-3.5 rounded-full bg-[#00ff41]/15 border border-[#00ff41]/30 text-center leading-[12px] text-[9px]">
                          {node.code}
                        </span>
                        {node.label}
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-2 h-1 w-full bg-[#00ff41]/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-transparent via-[#00ff41]/70 to-transparent"
                      initial={{ x: '-40%' }}
                      animate={{ x: '140%' }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <span className="typing-radar-dot" />
                  <span className="typing-radar-dot" />
                  <span className="typing-radar-dot" />
                </div>
                <span className="text-[10px] text-[#00ff41]/40 font-mono uppercase tracking-wider">
                  Processing intel...
                </span>
              </div>

              <div className="mt-2 text-[11px] text-gray-400 font-mono">
                {loadingStages[loadingStageIndex]}
              </div>

              <div className="mt-2 h-1.5 w-full bg-[#00ff41]/10 rounded-full overflow-hidden">
                <motion.div
                  key={loadingStageIndex}
                  initial={{ width: '12%' }}
                  animate={{ width: `${Math.min(22 + loadingStageIndex * 18, 95)}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="h-full bg-[#00ff41]/55"
                />
              </div>

              <div className="mt-2 text-[10px] text-[#00ff41]/35 font-mono uppercase tracking-wider">
                Elapsed: {loadingElapsedSec}s
              </div>
            </div>
          </motion.div>
        )}

        {/* Follow-up suggestion chips */}
        <AnimatePresence>
          {!isLoading && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="max-w-3xl mx-auto px-4 pb-4 pt-2"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={12} className="text-[#00ff41]/40" />
                <span className="text-[10px] text-[#00ff41]/30 font-mono uppercase tracking-wider">
                  Suggested follow-ups
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1, duration: 0.2 }}
                    onClick={() => {
                      setSuggestions([])
                      setInput('')
                      setMessages(prev => [...prev, { role: 'user', content: s }])
                      handleSend(s)
                    }}
                    className="text-[13px] text-gray-400 glass-card rounded-full px-4 py-2 hover:text-[#00ff41]/80 hover:border-[#00ff41]/30 cursor-pointer transition-all duration-300 hover:shadow-[0_0_12px_rgba(0,255,65,0.08)]"
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
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2"
          >
            <button
              onClick={scrollToBottom}
              className="p-2 rounded-full glass border border-[#00ff41]/20 hover:border-[#00ff41]/40 transition-all duration-300 shadow-lg hover:shadow-[0_0_15px_rgba(0,255,65,0.15)]"
            >
              <ArrowDown size={14} className="text-[#00ff41]/60" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      {inputBarElement}

      <div className="fixed top-20 right-4 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className={`px-3 py-2 rounded-lg text-xs font-mono border ${t.type === 'error'
                ? 'bg-red-500/15 border-red-500/30 text-red-300'
                : 'bg-[#00ff41]/10 border-[#00ff41]/30 text-[#b6ffc9]'
                }`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card border border-[#00ff41]/25 rounded-2xl p-5 w-full max-w-sm"
            >
              <h3 className="text-sm font-bold text-white mb-3">Keyboard Shortcuts</h3>
              <div className="space-y-2 text-xs text-gray-300">
                <p><span className="text-[#00ff41] font-mono">/</span> Focus prompt input</p>
                <p><span className="text-[#00ff41] font-mono">Ctrl/Cmd + Enter</span> Send prompt</p>
                <p><span className="text-[#00ff41] font-mono">Esc</span> Stop streaming</p>
                <p><span className="text-[#00ff41] font-mono">?</span> Toggle this panel</p>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="mt-4 px-3 py-2 text-xs rounded-lg bg-[#00ff41] text-black font-semibold"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
