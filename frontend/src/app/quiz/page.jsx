'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, ChevronRight, Clock, CheckCircle2, RotateCcw,
  AlertTriangle, Loader2, Trophy, ArrowRight, Lock, BookOpen
} from 'lucide-react'
import { generateQuiz } from '@/lib/api'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'

const EXAMS = ['NDA', 'CDS', 'AFCAT', 'Navy', 'CAPF']
const TOPICS = [
  'General Science',
  'Mathematics',
  'Indian History',
  'Geography',
  'Current Affairs',
  'English Vocabulary',
  'Polity & Constitution'
]

export default function QuizPage() {
  const [step, setStep] = useState('selector') // selector, loading, active, results
  const [config, setConfig] = useState({
    examType: 'NDA',
    topic: 'General Science',
    numQuestions: 5,
    difficulty: 'Medium'
  })
  const [quiz, setQuiz] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [usage, setUsage] = useState(0)
  const [limit, setLimit] = useState(8)
  const [locked, setLocked] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)

  // Fetch usage on mount
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch('/api/usage')
        const data = await res.json()
        if (data && data.authenticated === true) {
          setUsage(data.usage || 0)
          setLimit(data.limit || 8)
          if ((data.usage || 0) >= (data.limit || 8)) setLocked(true)
        } else {
          const local = parseInt(localStorage.getItem('defensegpt_usage_local') || '0', 10)
          setUsage(local)
          if (local >= (data.limit || 8)) setLocked(true)
        }
      } catch (e) {
        console.error('Failed to fetch usage', e)
      }
    }
    fetchUsage()
  }, [])

  // Timer countdown per question
  useEffect(() => {
    if (step !== 'active') return
    setTimeLeft(60)
  }, [step, currentIdx])

  useEffect(() => {
    if (step !== 'active') return
    if (timeLeft <= 0) {
      handleNext()
      return
    }
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, timeLeft])

  const handleStartMission = async () => {
    if (locked) return
    setLoading(true)
    setError('')
    setStep('loading')
    try {
      const data = await generateQuiz(config.examType, config.topic, config.numQuestions, config.difficulty)
      setQuiz(data)
      setAnswers(new Array(data.questions.length).fill(null))
      setCurrentIdx(0)
      setStep('active')
    } catch (err) {
      setError(err.message)
      setStep('selector')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectOption = (option) => {
    const newAnswers = [...answers]
    newAnswers[currentIdx] = option
    setAnswers(newAnswers)
  }

  const handleNext = () => {
    if (!quiz) return
    if (currentIdx < quiz.questions.length - 1) {
      setCurrentIdx(currentIdx + 1)
    } else {
      setStep('results')
      const score = answers.reduce((s, ans, idx) => {
        return ans === quiz.questions[idx].correct_answer ? s + 1 : s
      }, 0)
      fetch('/api/quiz/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examType: config.examType,
          topic: config.topic,
          difficulty: config.difficulty,
          totalQuestions: quiz.questions.length,
          score,
          percentage: Math.round((score / quiz.questions.length) * 100),
          answers: answers,
        }),
      }).catch(() => { })
    }
  }

  const calculateScore = () => {
    if (!quiz) return 0
    return answers.reduce((score, ans, idx) => {
      return ans === quiz.questions[idx].correct_answer ? score + 1 : score
    }, 0)
  }

  const computeWeakAreas = () => {
    if (!quiz) return []
    const buckets = {
      Mathematics: ['math', 'algebra', 'trigonometry', 'geometry', 'equation', 'probability'],
      History: ['history', 'battle', 'freedom', 'movement', 'empire'],
      Geography: ['geography', 'river', 'mountain', 'climate', 'map'],
      Science: ['science', 'physics', 'chemistry', 'biology', 'atom'],
      CurrentAffairs: ['current', 'affair', 'defense', 'minister', 'operation', 'summit'],
      English: ['english', 'grammar', 'vocabulary', 'synonym', 'antonym'],
      Polity: ['constitution', 'parliament', 'article', 'polity', 'amendment'],
    }

    const missed = quiz.questions.filter((q, idx) => answers[idx] !== q.correct_answer)
    const counts = {}

    missed.forEach((q) => {
      const text = (q.text || '').toLowerCase()
      let matched = false
      Object.entries(buckets).forEach(([name, keywords]) => {
        if (keywords.some(k => text.includes(k))) {
          counts[name] = (counts[name] || 0) + 1
          matched = true
        }
      })
      if (!matched) counts.Mixed = (counts.Mixed || 0) + 1
    })

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }))
  }

  const weakAreas = computeWeakAreas()

  return (
    <div className="flex h-[100dvh] bg-[#0c0d0f] text-[#f0f0f0] overflow-hidden font-geist relative">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        chats={[]}
        onNewChat={() => window.location.href = '/chat'}
      />

      <main className="flex-1 relative flex flex-col items-center overflow-y-auto p-4 md:p-8 custom-scrollbar">
        {/* Subtle grid background */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <AnimatePresence mode="wait">
          {step === 'selector' && (
            <motion.div
              key="selector"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl z-10 py-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] rounded-full text-xs font-semibold">
                  <Target size={14} /> Practice Quiz
                </div>
                {locked && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-[#ef4444] font-geist-mono mt-1">
                    <Lock size={13} /> Access locked — upgrade to continue
                  </div>
                )}
                <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  Tactical Evaluation
                </h1>
                <p className="text-[#6b7280] text-sm">
                  Select your exam and topic to generate an interactive quiz
                </p>
              </div>

              <div
                className="bg-[#141518] border border-white/[0.08] p-6 md:p-8 rounded-2xl shadow-2xl relative space-y-6"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px rgba(0,0,0,0.4)' }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9ca3af]">Target Exam</label>
                    <select
                      value={config.examType}
                      onChange={(e) => setConfig({ ...config, examType: e.target.value })}
                      className="input-base w-full px-3 py-2.5 text-xs"
                    >
                      {EXAMS.map(e => <option key={e} value={e} className="bg-[#141518] text-white">{e}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9ca3af]">Focus Area</label>
                    <select
                      value={config.topic}
                      onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                      className="input-base w-full px-3 py-2.5 text-xs"
                    >
                      {TOPICS.map(t => <option key={t} value={t} className="bg-[#141518] text-white">{t}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9ca3af]">Difficulty</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Easy', 'Medium', 'Hard'].map(d => (
                        <button
                          key={d}
                          onClick={() => setConfig({ ...config, difficulty: d })}
                          className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                            config.difficulty === d
                              ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]'
                              : 'bg-[#1c1e22] border-white/[0.06] text-[#6b7280] hover:text-[#9ca3af]'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9ca3af]">Questions</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[5, 10, 15].map(n => (
                        <button
                          key={n}
                          onClick={() => setConfig({ ...config, numQuestions: n })}
                          className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                            config.numQuestions === n
                              ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]'
                              : 'bg-[#1c1e22] border-white/[0.06] text-[#6b7280] hover:text-[#9ca3af]'
                          }`}
                        >
                          {n} Questions
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg text-[#fca5a5] text-xs">
                    <AlertTriangle size={15} className="shrink-0 text-[#ef4444]" />
                    <span>{error}</span>
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartMission}
                  disabled={loading || locked}
                  className="w-full py-3 bg-[#22c55e] text-[#0c0d0f] font-semibold text-sm rounded-lg hover:bg-[#16a34a] transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  Start Quiz <ArrowRight size={15} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="z-10 py-32 text-center space-y-4"
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
                <Loader2 className="animate-spin text-[#22c55e]" size={22} />
              </div>
              <p className="text-base font-semibold text-white">Generating Quiz Questions...</p>
              <p className="text-xs text-[#6b7280] font-geist-mono">Analyzing {config.examType} {config.topic} syllabus</p>
            </motion.div>
          )}

          {step === 'active' && quiz && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl z-10 py-6 space-y-4"
            >
              {/* Header bar */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-xs text-[#6b7280] font-geist-mono">
                  <span>Question {currentIdx + 1} of {quiz.questions.length}</span>
                  <span>·</span>
                  <span className="text-[#9ca3af]">{config.topic}</span>
                </div>

                {/* Timer badge */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-geist-mono border ${
                  timeLeft <= 10
                    ? 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#fca5a5] animate-pulse'
                    : 'bg-[#141518] border-white/[0.08] text-[#9ca3af]'
                }`}>
                  <Clock size={13} />
                  <span>{timeLeft}s</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 bg-[#1c1e22] rounded-full overflow-hidden">
                <motion.div
                  className={`h-full transition-all duration-300 ${timeLeft <= 10 ? 'bg-[#ef4444]' : 'bg-[#22c55e]'}`}
                  style={{ width: `${((currentIdx + 1) / quiz.questions.length) * 100}%` }}
                />
              </div>

              {/* Question card */}
              <div
                className="bg-[#141518] border border-white/[0.08] p-6 md:p-8 rounded-2xl space-y-6 shadow-2xl"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
              >
                <h3 className="text-lg md:text-xl font-semibold text-white leading-relaxed">
                  {quiz.questions[currentIdx].question}
                </h3>

                {/* Options */}
                <div className="space-y-2.5">
                  {quiz.questions[currentIdx].options.map((opt, i) => {
                    const isSelected = answers[currentIdx] === opt
                    return (
                      <motion.button
                        key={i}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleSelectOption(opt)}
                        className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all duration-150 flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#22c55e]/10 border-[#22c55e]/40 text-white font-medium'
                            : 'bg-[#1c1e22] border-white/[0.05] text-[#9ca3af] hover:border-white/[0.12] hover:text-white'
                        }`}
                      >
                        <span>{opt}</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-3 ${
                          isSelected ? 'border-[#22c55e] bg-[#22c55e]' : 'border-white/[0.15]'
                        }`}>
                          {isSelected && <CheckCircle2 size={12} className="text-[#0c0d0f]" />}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>

                <div className="pt-2 flex justify-end">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleNext}
                    disabled={!answers[currentIdx]}
                    className="px-5 py-2.5 bg-[#22c55e] text-[#0c0d0f] font-semibold text-xs rounded-lg hover:bg-[#16a34a] transition-all flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
                  >
                    {currentIdx < quiz.questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                    <ChevronRight size={14} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'results' && quiz && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-2xl z-10 py-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
                  <Trophy size={24} className="text-[#22c55e]" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Quiz Results</h2>
                <p className="text-xs text-[#6b7280] font-geist-mono">{config.examType} · {config.topic}</p>
              </div>

              {/* Score card */}
              <div
                className="bg-[#141518] border border-white/[0.08] p-6 md:p-8 rounded-2xl text-center space-y-4"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
              >
                <div>
                  <span className="text-5xl font-black text-white font-geist-mono">
                    {calculateScore()}/{quiz.questions.length}
                  </span>
                  <p className="text-xs text-[#6b7280] font-geist-mono mt-1">
                    {Math.round((calculateScore() / quiz.questions.length) * 100)}% Accuracy
                  </p>
                </div>

                {weakAreas.length > 0 && (
                  <div className="pt-4 border-t border-white/[0.06] text-left">
                    <p className="text-xs font-medium text-[#9ca3af] mb-2">Areas for Improvement:</p>
                    <div className="flex flex-wrap gap-2">
                      {weakAreas.map(wa => (
                        <span key={wa.name} className="text-xs px-2.5 py-1 rounded-md bg-[#1c1e22] border border-white/[0.06] text-[#9ca3af]">
                          {wa.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => { setStep('selector'); setAnswers([]) }}
                    className="px-4 py-2 rounded-lg bg-[#1c1e22] border border-white/[0.08] text-xs font-medium text-[#9ca3af] hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw size={13} /> Try Again
                  </button>
                  <Link href="/chat">
                    <span className="px-4 py-2 rounded-lg bg-[#22c55e] text-[#0c0d0f] text-xs font-semibold hover:bg-[#16a34a] transition-colors inline-flex items-center gap-1.5 cursor-pointer">
                      Return to Chat <ArrowRight size={13} />
                    </span>
                  </Link>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider font-geist-mono px-1">Detailed Breakdown</h4>
                {quiz.questions.map((q, idx) => {
                  const isCorrect = answers[idx] === q.correct_answer
                  return (
                    <div key={idx} className="bg-[#141518] border border-white/[0.06] p-4 rounded-xl space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-white">{idx + 1}. {q.question}</p>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                          isCorrect ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-[#ef4444]/15 text-[#ef4444]'
                        }`}>
                          {isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>
                      <p className="text-[#6b7280]">
                        Your answer: <span className={isCorrect ? 'text-[#22c55e]' : 'text-[#ef4444]'}>{answers[idx] || 'Time out'}</span>
                      </p>
                      {!isCorrect && (
                        <p className="text-[#22c55e]">Correct answer: {q.correct_answer}</p>
                      )}
                      {q.explanation && (
                        <p className="text-[#6b7280] italic pt-1 border-t border-white/[0.04]">{q.explanation}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
