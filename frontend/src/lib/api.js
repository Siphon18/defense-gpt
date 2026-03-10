const API_BASE = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api` : '/backend'

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`)
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/models`)
  if (!res.ok) throw new Error('Failed to fetch models')
  return res.json()
}

export async function fetchPdfs() {
  const res = await fetch(`${API_BASE}/pdfs`)
  if (!res.ok) throw new Error('Failed to fetch PDFs')
  return res.json()
}

export async function deletePdf(filename) {
  const res = await fetch(`${API_BASE}/pdfs/${encodeURIComponent(filename)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete PDF')
  return res.json()
}

export async function askQuestion(question, examType, model, temperature, topK, sourceFilter, useLiveWebSearch = true) {
  const res = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: question,
      exam_type: examType,
      model,
      temperature,
      top_k: topK,
      source_filter: sourceFilter,
      use_live_web_search: useLiveWebSearch,
    }),
  })
  if (!res.ok) throw new Error('Failed to ask question')
  return res.json()
}

/**
 * Stream a response from the backend using SSE.
 * Returns an AbortController so the caller can cancel mid-stream.
 */
export function askStream(question, examType, model, temperature, topK, sourceFilter, useLiveWebSearch, chatHistory, imageData, { onToken, onSources, onSuggestions, onDone, onError }) {
  const controller = new AbortController()

  ; (async () => {
    const requestBody = JSON.stringify({
      query: question,
      exam_type: examType,
      model,
      temperature,
      top_k: topK,
      source_filter: sourceFilter,
      use_live_web_search: useLiveWebSearch,
      chat_history: chatHistory,
      image_data: imageData,
    })

    const makeRequest = () => fetch(`${API_BASE}/ask/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: requestBody,
    })

    const readSSE = async (res) => {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          try {
            const data = JSON.parse(payload)
            if (data.type === 'token' && data.content) onToken?.(data.content)
            if (data.type === 'sources' && data.sources) onSources?.(data.sources)
            if (data.type === 'suggestions' && data.suggestions) onSuggestions?.(data.suggestions)
            if (data.type === 'error') onError?.(data.content || 'Unknown error')
            if (data.type === 'done') {
              onDone?.()
              return
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }
      onDone?.()
    }

    const isRetryableStatus = (status) => status >= 500 || status === 408 || status === 429
    const retryDelaysMs = [0, 1000, 2500, 5000]
    let lastError = 'Stream request failed'

    for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
      try {
        if (retryDelaysMs[attempt] > 0) {
          await new Promise(r => setTimeout(r, retryDelaysMs[attempt]))
        }

        const res = await makeRequest()
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Stream request failed' }))
          lastError = err.detail || `Stream request failed (${res.status})`
          if (isRetryableStatus(res.status) && attempt < retryDelaysMs.length - 1) {
            continue
          }
          onError?.(lastError)
          return
        }

        await readSSE(res)
        return
      } catch (err) {
        if (err.name === 'AbortError') {
          onDone?.()
          return
        }
        lastError = err.message || 'Stream request failed'
        if (attempt < retryDelaysMs.length - 1) {
          continue
        }
        onError?.(lastError)
        return
      }
    }

    onError?.(lastError)
  })()

  return controller
}
export async function generateQuiz(examType, topic, numQuestions = 5, difficulty = 'Medium') {
  const res = await fetch(`${API_BASE}/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exam_type: examType,
      topic,
      num_questions: numQuestions,
      difficulty,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Quiz generation failed' }))
    throw new Error(err.detail || 'Quiz generation failed')
  }
  return res.json()
}
