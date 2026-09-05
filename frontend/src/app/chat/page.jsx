'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from '@/components/Sidebar'
import ChatArea from '@/components/ChatArea'
import WelcomeScreen from '@/components/WelcomeScreen'
import { getChats, saveChat, deleteChat as removeChat, createNewChat } from '@/lib/chatStore'
import { fetchStats, fetchModels } from '@/lib/api'

export default function ChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const activeChatIdRef = useRef(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [examType, setExamType] = useState('General')
  const [model, setModel] = useState(null)
  const [availableModels, setAvailableModels] = useState([])
  const [temperature, setTemperature] = useState(0.3)
  const [topK, setTopK] = useState(5)
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({ total_chunks: 0, total_pdfs: 0, pdf_names: [] })
  const [useLiveWebSearch, setUseLiveWebSearch] = useState(true)
  const [contextMode, setContextMode] = useState('hybrid')
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveStatusTimerRef = useRef(null)
  const [showTour, setShowTour] = useState(false)
  const [tourStep, setTourStep] = useState(0)

  const tourSteps = [
    { title: 'Pick your exam', body: 'Use the sidebar exam chips to focus coaching for NDA, CDS, AFCAT, and more.' },
    { title: 'Toggle web search', body: 'The settings gear in the input bar lets you switch between PDF, web, or hybrid context.' },
    { title: 'Run practice quizzes', body: 'Open Practice Quiz from the sidebar to generate MCQ sets and track weak areas.' },
  ]

  useEffect(() => {
    const done = localStorage.getItem('defense-gpt-tour-v1')
    if (!done) setShowTour(true)
  }, [])
  useEffect(() => () => { if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current) }, [])

  const markSaveStatus = useCallback((v) => {
    setSaveStatus(v)
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
    if (v === 'saved') saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1200)
  }, [])

  const persistChat = useCallback(async (chatData) => {
    markSaveStatus('saving')
    try { const saved = await saveChat(chatData); markSaveStatus('saved'); return saved }
    catch { markSaveStatus('error'); return null }
  }, [markSaveStatus])

  useEffect(() => { getChats().then(setChats) }, [])
  useEffect(() => {
  fetchStats().then(setStats).catch(() => {})

  fetchModels()
    .then(data => {
      const models = data.models || []
      setAvailableModels(models)
      setModel(data.default || models[0] || null)
    })
    .catch(() => {})
}, [])

  const activeChat = chats.find(c => c.id === activeChatId) || null
  const messages = activeChat?.messages || []

  useEffect(() => { activeChatIdRef.current = activeChatId }, [activeChatId])

  const updateMessages = useCallback((updater) => {
    const currentId = activeChatIdRef.current
    if (!currentId) return
    let chatToSave = null
    setChats(prev => {
      const next = prev.map(c => {
        if (c.id !== currentId) return c
        const newMsgs = typeof updater === 'function' ? updater(c.messages) : updater
        const updated = { ...c, messages: newMsgs, updatedAt: Date.now() }
        if (c.title === 'New Chat' && newMsgs.length > 0) {
          const first = newMsgs.find(m => m.role === 'user')
          if (first) updated.title = first.content.slice(0, 50)
        }
        chatToSave = updated
        return updated
      })
      return next
    })
    if (chatToSave) persistChat(chatToSave)
  }, [persistChat])

  const handleNewChat = async () => {
    const chat = createNewChat(examType)
    const saved = await persistChat(chat)
    const final = saved || chat
    if (!final.id) final.id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    setChats(prev => [final, ...prev])
    setActiveChatId(final.id)
  }

  const handleSelectChat = (id) => {
    setActiveChatId(id)
    const chat = chats.find(c => c.id === id)
    if (chat?.examType) setExamType(chat.examType)
  }

  const handleDeleteChat = async (id) => {
    removeChat(id)
    setChats(prev => {
      const filtered = prev.filter(c => c.id !== id)
      if (activeChatId === id) setActiveChatId(filtered[0]?.id || null)
      return filtered
    })
  }

  const handleQuickPrompt = async (prompt) => {
    const chat = createNewChat(examType)
    chat.messages = [{ role: 'user', content: prompt }]
    chat.title = prompt.slice(0, 50)
    const saved = await persistChat(chat)
    const final = saved || chat
    if (!final.id) final.id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    setChats(prev => [final, ...prev])
    activeChatIdRef.current = final.id
    setActiveChatId(final.id)
  }

  const handleFirstMessage = async (query, image = null) => {
    const chat = createNewChat(examType)
    chat.messages = [{ role: 'user', content: query, image }]
    chat.title = query.slice(0, 50)
    const saved = await persistChat(chat)
    const final = saved || chat
    if (!final.id) final.id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    setChats(prev => [final, ...prev])
    activeChatIdRef.current = final.id
    setActiveChatId(final.id)
  }

  const showWelcome = messages.length === 0

  const settings = {
  examType,
  model,
  setModel,
  availableModels,
  temperature,
  setTemperature,
  topK,
  setTopK,
  sourceFilter: null,
  useLiveWebSearch,
  setUseLiveWebSearch,
  contextMode,
  setContextMode,
}

  if (status === 'loading') {
    return (
      <div className="h-screen bg-[#0c0d0f] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="loading-dots"><span /><span /><span /></div>
          <span className="text-sm text-[#4b5563] font-geist-mono">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#0c0d0f] text-[#f0f0f0] overflow-hidden w-full">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        examType={examType}
        setExamType={setExamType}
        session={session}
        onSignOut={() => signOut({ callbackUrl: '/' })}
        saveStatus={saveStatus}
      />

      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {showWelcome && <WelcomeScreen stats={stats} onQuickPrompt={handleQuickPrompt} />}
        <ChatArea
          messages={messages}
          setMessages={updateMessages}
          settings={settings}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          hidden={showWelcome}
          onFirstMessage={handleFirstMessage}
        />
      </main>

      {/* Onboarding tour */}
      <AnimatePresence>
        {showTour && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="bg-[#141518] border border-white/[0.09] rounded-2xl max-w-sm w-full p-6"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                {tourSteps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${i <= tourStep ? 'bg-[#22c55e]' : 'bg-white/[0.07]'}`}
                  />
                ))}
              </div>
              <p className="text-[11px] font-geist-mono text-[#4b5563] uppercase tracking-widest mb-1">
                {tourStep + 1} of {tourSteps.length}
              </p>
              <h2 className="text-lg font-semibold text-white mb-2">{tourSteps[tourStep].title}</h2>
              <p className="text-sm text-[#6b7280] leading-relaxed mb-6">{tourSteps[tourStep].body}</p>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => { localStorage.setItem('defense-gpt-tour-v1', 'done'); setShowTour(false) }}
                  className="text-xs text-[#4b5563] hover:text-[#6b7280] transition-colors"
                >
                  Skip
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTourStep(s => Math.max(0, s - 1))}
                    disabled={tourStep === 0}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#1c1e22] border border-white/[0.07] text-[#6b7280] disabled:opacity-40 hover:text-white transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (tourStep < tourSteps.length - 1) { setTourStep(s => s + 1); return }
                      localStorage.setItem('defense-gpt-tour-v1', 'done')
                      setShowTour(false)
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#22c55e] text-[#0c0d0f] font-semibold hover:bg-[#16a34a] transition-colors"
                  >
                    {tourStep < tourSteps.length - 1 ? 'Next' : 'Done'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
