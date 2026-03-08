/**
 * Chat Store — MongoDB-backed via API routes
 * Falls back to localStorage for unauthenticated users
 */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ── API-backed functions (for authenticated users) ──

export async function getChats() {
  try {
    const res = await fetch('/api/chats')
    if (res.status === 401) {
      // Unauthenticated — fall back to localStorage
      return getChatsLocal()
    }
    if (!res.ok) throw new Error('Failed to fetch chats')
    return await res.json()
  } catch {
    return getChatsLocal()
  }
}

export async function saveChat(chat) {
  try {
    // Strip Base64 images to reduce payload
    const safeChat = {
      ...chat,
      messages: chat.messages.map(m => {
        const copy = { ...m }
        delete copy.image
        return copy
      }),
    }

    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safeChat),
    })

    if (res.status === 401) {
      saveChatLocal(safeChat)
      return
    }

    if (!res.ok) throw new Error('Failed to save chat')
    return await res.json()
  } catch {
    saveChatLocal(chat)
  }
}

export async function deleteChat(id) {
  try {
    const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' })
    if (res.status === 401) {
      deleteChatLocal(id)
      return
    }
    if (!res.ok) throw new Error('Failed to delete chat')
  } catch {
    deleteChatLocal(id)
  }
}

export function createNewChat(examType = 'General') {
  return {
    id: null, // null = new chat, will get MongoDB _id on first save
    title: 'New Chat',
    messages: [],
    examType,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ── LocalStorage fallback (for unauthenticated users) ──

const STORAGE_KEY = 'defense-gpt-chats'

function getChatsLocal() {
  try {
    if (typeof window === 'undefined') return []
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    return JSON.parse(data).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

function saveChatLocal(chat) {
  const chats = getChatsLocal()
  const safeChat = {
    ...chat,
    id: chat.id || generateId(),
    messages: chat.messages.map(m => {
      const copy = { ...m }
      delete copy.image
      return copy
    }),
  }

  const idx = chats.findIndex(c => c.id === safeChat.id)
  if (idx >= 0) chats[idx] = safeChat
  else chats.unshift(safeChat)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  } catch (err) {
    if (err.name === 'QuotaExceededError') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 10)))
    }
  }
}

function deleteChatLocal(id) {
  const chats = getChatsLocal().filter(c => c.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
}
