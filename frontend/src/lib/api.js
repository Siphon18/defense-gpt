const API_BASE = '/backend'

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

export async function askQuestion(question, examType, model, temperature, topK, sourceFilter) {
  const res = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: question, exam_type: examType, model, temperature, top_k: topK, source_filter: sourceFilter }),
  })
  if (!res.ok) throw new Error('Failed to ask question')
  return res.json()
}

/**
 * Stream a response from the backend using SSE.
 * Returns an AbortController so the caller can cancel mid-stream.
 */
export function askStream(question, examType, model, temperature, topK, sourceFilter, chatHistory, imageData, { onToken, onSources, onSuggestions, onDone, onError }) {
  const controller = new AbortController()

    ; (async () => {
      try {
        const res = await fetch(`${API_BASE}/ask/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            query: question,
            exam_type: examType,
            model,
            temperature,
            top_k: topK,
            source_filter: sourceFilter,
            chat_history: chatHistory,
            image_data: imageData,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Stream request failed' }))
          onError?.(err.detail || 'Stream request failed')
          return
        }

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
      } catch (err) {
        if (err.name === 'AbortError') {
          onDone?.()
        } else {
          onError?.(err.message)
        }
      }
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
