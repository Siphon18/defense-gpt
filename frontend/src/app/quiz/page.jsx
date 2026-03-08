'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Target,
    ChevronRight,
    Zap,
    Clock,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    ShieldAlert,
    Loader2,
    Trophy,
    History,
    Shield,
    Radar
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

    const handleStartMission = async () => {
        setLoading(true)
        setError('')
        setStep('loading')
        try {
            const data = await generateQuiz(config.examType, config.topic, config.numQuestions, config.difficulty)
            setQuiz(data)
            setAnswers(new Array(data.questions.length).fill(null))
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
        if (currentIdx < quiz.questions.length - 1) {
            setCurrentIdx(currentIdx + 1)
        } else {
            setStep('results')
            // Save quiz results to MongoDB (fire-and-forget)
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
            }).catch(() => { }) // silently fail if not authenticated
        }
    }

    const calculateScore = () => {
        if (!quiz) return 0
        return answers.reduce((score, ans, idx) => {
            return ans === quiz.questions[idx].correct_answer ? score + 1 : score
        }, 0)
    }

    return (
        <div className="flex h-screen bg-[#050806] text-slate-100 overflow-hidden font-sans relative">
            <div className="absolute inset-0 scan-line pointer-events-none opacity-30 z-50 overflow-hidden h-full w-full" />

            <Sidebar
                open={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
                chats={[]}
                onNewChat={() => window.location.href = '/chat'}
            />

            <main className="flex-1 relative flex flex-col items-center overflow-y-auto p-4 md:p-8 custom-scrollbar">
                {/* Radar/Grid Background */}
                <div className="absolute inset-0 radar-grid-bg opacity-40 pointer-events-none" />

                <AnimatePresence mode="wait">
                    {step === 'selector' && (
                        <motion.div
                            key="selector"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="w-full max-w-2xl z-10 py-10 space-y-8"
                        >
                            <div className="text-center space-y-4">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00ff41]/10 border border-[#00ff41]/20 text-[#00ff41] rounded-full text-xs font-bold tracking-widest uppercase mb-2 animate-glow-pulse">
                                    <Target className="w-4 h-4" /> Mission Briefing
                                </div>
                                <h1 className="text-4xl md:text-5xl font-black text-[#00ff41] tracking-tighter uppercase italic animate-text-glow">
                                    Tactical Evaluation
                                </h1>
                                <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Sector: Training Grounds // Status: Standby</p>
                            </div>

                            <div className="glass border-[#00ff41]/20 p-5 md:p-8 rounded-2xl shadow-2xl relative group overflow-hidden">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 relative z-10">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-[#00ff41]/40 uppercase tracking-[0.2em] ml-1">Target Exam</label>
                                        <select
                                            value={config.examType}
                                            onChange={(e) => setConfig({ ...config, examType: e.target.value })}
                                            className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00ff41]/50 transition-all appearance-none cursor-pointer"
                                        >
                                            {EXAMS.map(e => <option key={e} value={e} className="bg-[#0a140c] text-white">{e}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-[#00ff41]/40 uppercase tracking-[0.2em] ml-1">Focus Area</label>
                                        <select
                                            value={config.topic}
                                            onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                                            className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00ff41]/50 transition-all appearance-none cursor-pointer"
                                        >
                                            {TOPICS.map(t => <option key={t} value={t} className="bg-[#0a140c] text-white">{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-[#00ff41]/40 uppercase tracking-[0.2em] ml-1">Difficulty</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['Easy', 'Medium', 'Hard'].map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => setConfig({ ...config, difficulty: d })}
                                                    className={`py-2 text-[10px] font-black rounded-lg border transition-all tracking-tighter uppercase ${config.difficulty === d
                                                        ? 'bg-[#00ff41]/20 border-[#00ff41] text-[#00ff41]'
                                                        : 'bg-[#050806] border-[#00ff41]/10 text-slate-500 hover:border-[#00ff41]/30'
                                                        }`}
                                                >
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-[#00ff41]/40 uppercase tracking-[0.2em] ml-1">Ammo (Questions)</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[5, 10, 15].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setConfig({ ...config, numQuestions: n })}
                                                    className={`py-2 text-[10px] font-black rounded-lg border transition-all tracking-tighter uppercase ${config.numQuestions === n
                                                        ? 'bg-[#00ff41]/20 border-[#00ff41] text-[#00ff41]'
                                                        : 'bg-[#050806] border-[#00ff41]/10 text-slate-500 hover:border-[#00ff41]/30'
                                                        }`}
                                                >
                                                    {n} Rounds
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mt-6 flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs animate-pulse">
                                        <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                                        <span className="font-mono uppercase tracking-tight">{error}</span>
                                    </div>
                                )}

                                <button
                                    onClick={handleStartMission}
                                    disabled={loading}
                                    className="w-full mt-8 py-4 bg-[#00ff41] text-black font-black uppercase tracking-[0.25em] rounded-xl hover:shadow-[0_0_30px_rgba(0,255,65,0.4)] transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Initialize Alpha <ChevronRight className="w-6 h-6 stroke-[3]" /></>}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'loading' && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="z-10 text-center space-y-6 py-20"
                        >
                            <div className="relative w-32 h-32 mx-auto">
                                <motion.div
                                    className="absolute inset-0 rounded-full border-2 border-dashed border-[#00ff41]/30"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                />
                                <motion.div
                                    className="absolute inset-2 rounded-full border-t-2 border-[#00ff41]"
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Radar className="w-12 h-12 text-[#00ff41] animate-pulse" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black tracking-[0.3em] text-[#00ff41] uppercase animate-pulse italic">Uploading Intel...</h2>
                                <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Syllabus analysis in progress. Do not disconnect.</p>
                            </div>
                        </motion.div>
                    )}

                    {step === 'active' && quiz && (
                        <motion.div
                            key="active"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full max-w-3xl z-10 flex flex-col gap-6 py-10"
                        >
                            <div className="flex items-center justify-between px-2">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-[#00ff41]/60 tracking-[0.2em] uppercase">Phase: Evaluation</span>
                                    <h3 className="text-white font-black text-lg uppercase tracking-tight italic">{quiz.title}</h3>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-slate-500 tracking-widest block uppercase">Objective {currentIdx + 1} of {quiz.questions.length}</span>
                                    <div className="w-32 h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1 border border-white/5">
                                        <motion.div
                                            className="h-full bg-[#00ff41] shadow-[0_0_10px_#00ff41]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${((currentIdx + 1) / quiz.questions.length) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="glass border-[#00ff41]/10 p-6 md:p-10 rounded-2xl md:rounded-3xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00ff41]/5 rounded-bl-full pointer-events-none" />

                                <div className="space-y-6 md:space-y-8 relative z-10">
                                    <h2 className="text-lg md:text-2xl font-bold text-white leading-tight">
                                        <span className="text-[#00ff41] font-black mr-2 md:mr-4 text-2xl md:text-3xl italic">#{currentIdx + 1}</span> {quiz.questions[currentIdx].text}
                                    </h2>

                                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                                        {quiz.questions[currentIdx].options.map((option, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSelectOption(option)}
                                                className={`group relative flex items-center gap-4 md:gap-6 p-4 md:p-5 rounded-xl border transition-all duration-300 text-left ${answers[currentIdx] === option
                                                    ? 'bg-[#00ff41]/20 border-[#00ff41] text-[#00ff41] shadow-[0_0_20px_rgba(0,255,65,0.1)]'
                                                    : 'bg-[#050806]/60 border-[#00ff41]/5 text-slate-400 hover:border-[#00ff41]/30 hover:text-white'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg border font-mono text-xs md:text-sm transition-all ${answers[currentIdx] === option ? 'bg-[#00ff41] border-[#00ff41] text-black font-black' : 'bg-[#0a140c] border-[#00ff41]/20'
                                                    }`}>
                                                    {String.fromCharCode(64 + (idx + 1))}
                                                </div>
                                                <span className="flex-1 font-medium tracking-tight text-sm md:text-base">{option}</span>
                                                {answers[currentIdx] === option && (
                                                    <div className="w-2 h-2 rounded-full bg-[#00ff41] animate-ping" />
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="pt-6 md:pt-8 border-t border-[#00ff41]/5 flex flex-col md:flex-row gap-6 md:gap-4 justify-between items-center">
                                        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-center md:justify-start">
                                            <div className="flex items-center gap-2 text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                                                <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#00ff41]/40" /> T-Minus: 60s
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                                                <Target className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#00ff41]/40" /> Target: {config.difficulty}
                                            </div>
                                        </div>
                                        <button
                                            disabled={!answers[currentIdx]}
                                            onClick={handleNext}
                                            className="w-full md:w-auto px-10 py-4 md:py-3.5 bg-[#00ff41] text-black font-black uppercase text-xs tracking-[0.2em] rounded-lg hover:shadow-[0_0_20px_rgba(0,255,65,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95"
                                        >
                                            {currentIdx === quiz.questions.length - 1 ? 'Terminate Session' : 'Confirm Engagement'} <ChevronRight className="w-5 h-5 stroke-[3]" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 'results' && (
                        <motion.div
                            key="results"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-4xl z-10 flex flex-col items-center py-10"
                        >
                            <div className="flex flex-col items-center text-center mb-12 gap-5 relative">
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-[#00ff41]/5 blur-[80px] rounded-full pointer-events-none" />
                                <div className="w-20 h-20 bg-[#00ff41]/10 rounded-2xl flex items-center justify-center border border-[#00ff41]/20 shadow-[0_0_30px_rgba(0,255,65,0.1)] group">
                                    <Trophy className="w-10 h-10 text-[#00ff41] group-hover:scale-110 transition-transform" />
                                </div>
                                <div>
                                    <h1 className="text-4xl font-black italic tracking-tight text-[#00ff41] uppercase animate-text-glow">Debriefing Summary</h1>
                                    <p className="text-slate-500 font-mono text-xs uppercase tracking-[0.3em] mt-2">Mission Result // Status: Evaluated</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full mb-10">
                                <div className="glass p-6 md:p-8 rounded-2xl border-[#00ff41]/10 text-center space-y-2 md:space-y-3 relative overflow-hidden hover:border-[#00ff41]/30 transition-all">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ff41]/40 to-transparent" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Efficiency Rating</p>
                                    <p className="text-4xl md:text-5xl font-black text-white">{calculateScore()} / {quiz.questions.length}</p>
                                    <div className="text-[10px] text-[#00ff41] font-black tracking-widest animate-pulse">
                                        {Math.round((calculateScore() / quiz.questions.length) * 100)}% SUCCESS RATE
                                    </div>
                                </div>
                                <div className="glass p-6 md:p-8 rounded-2xl border-[#00ff41]/10 text-center space-y-2 md:space-y-3 relative overflow-hidden hover:border-[#00ff41]/30 transition-all">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assignment Rank</p>
                                    <p className="text-3xl md:text-4xl font-black text-white italic tracking-tighter">
                                        {calculateScore() === quiz.questions.length ? 'ACE CO' : calculateScore() > quiz.questions.length / 2 ? 'LT. COMMANDER' : 'RECRUIT'}
                                    </p>
                                    <div className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Performance Merited</div>
                                </div>
                                <div className="glass p-6 md:p-8 rounded-2xl border-[#00ff41]/10 text-center space-y-2 md:space-y-3 relative overflow-hidden hover:border-[#00ff41]/30 transition-all">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Combat Zone</p>
                                    <p className="text-xl md:text-2xl font-black text-white uppercase truncate italic">{config.topic}</p>
                                    <div className="text-[10px] text-slate-500 font-bold tracking-widest">{config.examType} DIVISION</div>
                                </div>
                            </div>

                            {/* Review Section - Improved Scroll and Layout */}
                            <div className="w-full bg-[#0a140c]/40 border border-[#00ff41]/10 rounded-3xl overflow-hidden mb-10">
                                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4 md:space-y-6">
                                    {quiz.questions.map((q, idx) => (
                                        <div key={idx} className={`p-5 md:p-8 rounded-2xl border transition-all relative overflow-hidden ${answers[idx] === q.correct_answer
                                            ? 'bg-[#00ff41]/5 border-[#00ff41]/20 shadow-[inset_0_0_20px_rgba(0,255,65,0.02)]'
                                            : 'bg-red-500/5 border-red-500/10 shadow-[inset_0_0_20px_rgba(239,68,68,0.02)]'
                                            }`}>
                                            <div className="flex flex-col md:flex-row justify-between items-start gap-4 md:gap-6 mb-6">
                                                <h3 className="font-bold text-white text-base md:text-lg leading-snug flex-1">
                                                    <span className="text-[#00ff41]/40 mr-2 md:mr-3 font-mono">0{idx + 1}</span> {q.text}
                                                </h3>
                                                {answers[idx] === q.correct_answer ? (
                                                    <div className="bg-[#00ff41]/20 text-[#00ff41] px-3 py-1.5 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-[#00ff41]/30 whitespace-nowrap">
                                                        <CheckCircle2 className="w-3 h-3" /> Neutralized
                                                    </div>
                                                ) : (
                                                    <div className="bg-red-500/20 text-red-500 px-3 py-1.5 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-red-500/30 whitespace-nowrap">
                                                        <AlertCircle className="w-3 h-3" /> Target Missed
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 mb-6">
                                                <div className="space-y-1 md:space-y-2">
                                                    <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Cadet's Intel</p>
                                                    <p className={`text-base md:text-lg font-bold ${answers[idx] === q.correct_answer ? 'text-[#00ff41]' : 'text-red-400'}`}>
                                                        {answers[idx] || 'N/A'}
                                                    </p>
                                                </div>
                                                <div className="space-y-1 md:space-y-2">
                                                    <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Ground Truth</p>
                                                    <p className="text-base md:text-lg font-bold text-[#00ff41]">{q.correct_answer}</p>
                                                </div>
                                            </div>

                                            <div className="p-4 md:p-5 bg-black/40 rounded-xl border border-[#00ff41]/10 text-xs md:text-sm text-slate-400 leading-relaxed italic border-l-4 border-l-[#00ff41]">
                                                <span className="text-[#00ff41] font-black not-italic text-[10px] md:text-xs uppercase tracking-widest mr-3">Instructor Brief:</span>
                                                {q.explanation}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons - Fixed sizing to prevent cut-off */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pb-10">
                                <Link href="/chat" className="w-full">
                                    <button className="w-full py-5 glass border-[#00ff41]/20 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-[#00ff41]/10 transition-all flex items-center justify-center gap-3 group">
                                        <History className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" /> Return to Command Terminal
                                    </button>
                                </Link>
                                <button
                                    onClick={() => {
                                        setStep('selector')
                                        setCurrentIdx(0)
                                    }}
                                    className="w-full py-5 bg-[#00ff41] text-black font-black uppercase tracking-widest text-xs rounded-xl hover:shadow-[0_0_40px_rgba(0,255,65,0.4)] transition-all flex items-center justify-center gap-3 active:scale-95"
                                >
                                    <RotateCcw className="w-5 h-5" /> RE-ENGAGE EVALUATION
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.4);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 255, 65, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 255, 65, 0.5);
        }
      `}</style>
        </div>
    )
}
