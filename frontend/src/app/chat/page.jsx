'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Menu, Plus, Check } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import ChatArea from '@/components/ChatArea'
import WelcomeScreen from '@/components/WelcomeScreen'
import { getChats, saveChat, deleteChat as removeChat, createNewChat } from '@/lib/chatStore'
import { fetchStats } from '@/lib/api'

export default function ChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const activeChatIdRef = useRef(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [examType, setExamType] = useState('General')
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({ total_chunks: 0, total_pdfs: 0, pdf_names: [] })
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveStatusTimerRef = useRef(null)

  useEffect(() => () => { if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current) }, [])

  const markSaveStatus = useCallback((v) => {
    setSaveStatus(v)
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
    if (v === 'saved') saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1200)
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
    getChats().then(loadedChats => {
      setChats(loadedChats)
      if (loadedChats?.length > 0 && !activeChatIdRef.current) {
        setActiveChatId(loadedChats[0].id)
        if (loadedChats[0].examType) setExamType(loadedChats[0].examType)
      }
    })
    fetchStats().then(setStats).catch(() => {})
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

  const handleSetExamType = (newExam) => {
    setExamType(newExam)
    const currentId = activeChatIdRef.current
    if (currentId) {
      setChats(prev => {
        const updatedChats = prev.map(c => c.id === currentId ? { ...c, examType: newExam, updatedAt: Date.now() } : c)
        const chatToSave = updatedChats.find(c => c.id === currentId)
        if (chatToSave) persistChat(chatToSave)
        return updatedChats
      })
    }
  }

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
        setExamType={handleSetExamType}
        session={session}
        onSignOut={() => signOut({ callbackUrl: '/' })}
        saveStatus={saveStatus}
        showToggle={false}
      />

      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0c0d0f]">
        {/* Sleek Top Chat Header */}
        <header className="h-12 border-b border-white/[0.06] bg-[#0c0d0f]/80 backdrop-blur-md px-3 sm:px-5 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Sidebar Hamburger Toggle */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="lg:hidden p-1.5 rounded-lg text-[#6b7280] hover:text-white hover:bg-white/[0.05] transition-colors"
              aria-label="Toggle navigation drawer"
            >
              <Menu size={18} />
            </button>

            {/* Active Exam Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] text-xs font-semibold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span>{examType} Focus</span>
            </div>

            {/* Truncated Active Chat Title on larger screens */}
            {!showWelcome && activeChat?.title && (
              <span className="hidden xl:inline text-xs text-[#4b5563] truncate max-w-[200px] border-l border-white/[0.06] pl-2.5">
                {activeChat.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Save Status Indicator */}
            {saveStatus === 'saving' && (
              <span className="text-[11px] font-geist-mono text-[#6b7280] flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.02]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="hidden sm:inline">Saving</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-[11px] font-geist-mono text-[#22c55e] flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#22c55e]/5">
                <Check size={11} />
                <span className="hidden sm:inline">Saved</span>
              </span>
            )}

            {/* Quick New Chat Button */}
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#9ca3af] hover:text-white border border-white/[0.06] transition-all"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </header>

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
    </div>
  )
}
