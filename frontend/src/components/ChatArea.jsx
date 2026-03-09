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

  // Handle image upload logic
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert("Intel file too large. Maximum size is 5MB.")
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
      alert("Voice recognition is not supported in this browser. Please use Chrome or Edge.")
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
    setIsLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /* ─── Input Bar Component ─── */
  const inputBarElement = (
    <div className="border-t border-[#00ff41]/10 bg-[#0a0f0a]/90 backdrop-blur-md px-2 sm:px-4 py-3">
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
        <p className="text-[10px] text-gray-700 text-center mt-1.5 font-mono tracking-wide">
          Defense GPT • AI-Powered Exam Intelligence
        </p>
      </div>
    </div>
  )

  if (hidden) {
    return inputBarElement
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="divide-y divide-[#00ff41]/5">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} isStreaming={isLoading && i === messages.length - 1 && msg.role === 'assistant'} />
          ))}
        </div>

        {/* Radar Typing Indicator */}
        {isLoading && messages[messages.length - 1]?.content === '' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto px-4 py-5"
          >
            <div className="flex items-center gap-3 ml-11">
              <div className="flex gap-2">
                <span className="typing-radar-dot" />
                <span className="typing-radar-dot" />
                <span className="typing-radar-dot" />
              </div>
              <span className="text-[10px] text-[#00ff41]/40 font-mono uppercase tracking-wider">
                Processing intel...
              </span>
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
    </div>
  )
}
