"use client"
import { Component } from 'react'
import { ShieldAlert, RefreshCw, Terminal, Target } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050806] flex items-center justify-center px-4 relative overflow-hidden font-sans">
          {/* Tactical Background Elements */}
          <div className="absolute inset-0 radar-grid-bg opacity-30 pointer-events-none" />
          <div className="absolute inset-0 scan-line opacity-20 pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-lg z-10 glass border-red-500/20 p-10 rounded-3xl space-y-8 relative"
          >
            {/* Warning Glyph */}
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 bg-red-500/10 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-black/50 border border-red-500/30 rounded-2xl w-full h-full flex items-center justify-center">
                <ShieldAlert size={48} className="text-red-500 animate-pulse" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full text-[10px] font-black tracking-widest uppercase">
                Critical Failure // Sector Null
              </div>
              <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">
                System Breach Detected
              </h1>
              <p className="text-slate-500 font-mono text-xs uppercase leading-relaxed tracking-wider">
                Intelligence link severed. An unexpected exception has compromised the current mission parameters.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-black/60 border border-red-500/10 rounded-xl p-4 text-left overflow-hidden">
                <div className="flex items-center gap-2 text-red-500/50 mb-2">
                  <Terminal size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Stack Trace</span>
                </div>
                <pre className="text-[10px] text-red-400 font-mono opacity-60 line-wrap whitespace-pre-wrap">
                  {this.state.error.toString().substring(0, 150)}...
                </pre>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
                className="flex-1 inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-red-500 text-black text-xs font-black uppercase tracking-[0.2em] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] transition-all active:scale-[0.98]"
              >
                <RefreshCw size={16} className="animate-spin-slow" />
                Re-Initialize
              </button>

              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl glass border-white/10 text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-white/5 transition-all"
              >
                <Target size={16} />
                Abort Mission
              </button>
            </div>
          </motion.div>

          <style jsx global>{`
            @keyframes spin-slow {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            .animate-spin-slow {
              animation: spin-slow 3s linear infinite;
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }
}
