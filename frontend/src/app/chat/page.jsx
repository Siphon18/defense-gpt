"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [examType, setExamType] = useState('General')
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({ total_chunks: 0, total_pdfs: 0, pdf_names: [] })
  const [models, setModels] = useState([])
  const [defaultModel, setDefaultModel] = useState(null)
  const [useLiveWebSearch, setUseLiveWebSearch] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveStatusTimerRef = useRef(null)
  const [showTour, setShowTour] = useState(false)
  const [tourStep, setTourStep] = useState(0)

  const tourSteps = [
    {
      title: 'Choose Target Exam',
      body: 'Use the sidebar exam chips to switch coaching style for NDA, CDS, AFCAT, and more.',
    },
    {
      title: 'Toggle Live Web Search',
      body: 'Use the Web ON/OFF control in the composer to include current web verification when needed.',
    },
    {
      title: 'Run Tactical Evaluations',
      body: 'Open Tactical Evaluation from the sidebar to generate quizzes and track your weak areas.',
    },
  ]

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    if (typeof window === 'undefined') return
    const done = localStorage.getItem('defense-gpt-tour-v1')
    if (!done) setShowTour(true)
  }, [status])

  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
    }
  }, [])

  const markSaveStatus = useCallback((statusValue) => {
    setSaveStatus(statusValue)
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
    if (statusValue === 'saved') {
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1200)
    }
  }, [])

  const persistChat = useCallback(async (chatData) => {
    markSaveStatus('saving')
    try {
      const saved = await saveChat(chatData)
      markSaveStatus('saved')
      return saved
    } catch {
      markSaveStatus('error')
      return null
    }
  }, [markSaveStatus])

  useEffect(() => {
    getChats().then(loaded => setChats(loaded))
  }, [])

  useEffect(() => {
    fetchStats().then(setStats).catch(() => { })
    fetchModels()
      .then(data => {
        setModels(data.models || [])
        setDefaultModel(data.default || data.models?.[0] || null)
      })
      .catch(() => { })
  }, [])

  const activeChat = chats.find(c => c.id === activeChatId) || null
  const messages = activeChat?.messages || []

  // Keep ref in sync so callbacks always see latest activeChatId
  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

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
          const firstUser = newMsgs.find(m => m.role === 'user')
          if (firstUser) updated.title = firstUser.content.slice(0, 50)
        }
        chatToSave = updated
        return updated
      })
      return next
    })
    if (chatToSave) {
        persistChat(chatToSave) // fire-and-forget async save
    }
  }, [persistChat])

  const handleNewChat = async () => {
    const chat = createNewChat(examType)
    const saved = await persistChat(chat)
    const finalChat = saved || chat
    if (!finalChat.id) finalChat.id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    setChats(prev => [finalChat, ...prev])
    setActiveChatId(finalChat.id)
  }

  const handleSelectChat = (id) => {
    setActiveChatId(id)
    const chat = chats.find(c => c.id === id)
    if (chat?.examType) setExamType(chat.examType)
  }

  const handleDeleteChat = async (id) => {
    removeChat(id) // fire-and-forget
    setChats(prev => {
      const filtered = prev.filter(c => c.id !== id)
      if (activeChatId === id) {
        setActiveChatId(filtered.length > 0 ? filtered[0].id : null)
      }
      return filtered
    })
  }

  const handleQuickPrompt = async (prompt) => {
    const chat = createNewChat(examType)
    chat.messages = [{ role: 'user', content: prompt }]
    chat.title = prompt.slice(0, 50)
    const saved = await persistChat(chat)
    const finalChat = saved || chat
    if (!finalChat.id) finalChat.id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    setChats(prev => [finalChat, ...prev])
    activeChatIdRef.current = finalChat.id
    setActiveChatId(finalChat.id)
  }

  const handleFirstMessage = async (query, image = null) => {
    const chat = createNewChat(examType)
    chat.messages = [{ role: 'user', content: query, image }]
    chat.title = query.slice(0, 50)
    const saved = await persistChat(chat)
    const finalChat = saved || chat
    if (!finalChat.id) finalChat.id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    setChats(prev => [finalChat, ...prev])
    activeChatIdRef.current = finalChat.id
    setActiveChatId(finalChat.id)
  }

  const showWelcome = messages.length === 0

  const settings = {
    examType,
    model: defaultModel,
    temperature: 0.3,
    topK: 5,
    sourceFilter: null,
    useLiveWebSearch,
    setUseLiveWebSearch,
  }

  if (status === 'loading') {
    return (
      <div className="h-screen bg-[#0a0f0a] flex items-center justify-center">
        <div className="text-[#00ff4140] text-sm font-mono">Initializing command center...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#0a0f0a] radar-grid-bg text-gray-100 overflow-hidden relative w-full">
      {/* Scan line effect over the whole chat */}
      <div className="absolute inset-0 scan-line pointer-events-none opacity-20" />
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
        {showWelcome && (
          <WelcomeScreen stats={stats} onQuickPrompt={handleQuickPrompt} />
        )}
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

      {showTour && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="glass-card border border-[#00ff41]/20 rounded-2xl max-w-md w-full p-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#00ff41]/50 font-mono mb-2">
              Onboarding {tourStep + 1}/{tourSteps.length}
            </p>
            <h2 className="text-xl font-bold text-white mb-2">{tourSteps[tourStep].title}</h2>
            <p className="text-sm text-gray-300 leading-relaxed mb-6">{tourSteps[tourStep].body}</p>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') localStorage.setItem('defense-gpt-tour-v1', 'done')
                  setShowTour(false)
                }}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Skip tour
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTourStep(s => Math.max(0, s - 1))}
                  disabled={tourStep === 0}
                  className="px-3 py-2 text-xs rounded-lg border border-[#00ff41]/20 text-gray-300 disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (tourStep < tourSteps.length - 1) {
                      setTourStep(s => s + 1)
                      return
                    }
                    if (typeof window !== 'undefined') localStorage.setItem('defense-gpt-tour-v1', 'done')
                    setShowTour(false)
                  }}
                  className="px-3 py-2 text-xs rounded-lg bg-[#00ff41] text-black font-semibold"
                >
                  {tourStep < tourSteps.length - 1 ? 'Next' : 'Done'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
