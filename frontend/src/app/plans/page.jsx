import React from 'react'
import Link from 'next/link'
import { Lock, CreditCard, Radar } from 'lucide-react'

export default function PlansPage() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#050806] text-white p-4">
      <div className="glass-card border border-[#00ff41]/20 rounded-2xl p-8 max-w-2xl w-full text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="w-14 h-14 bg-[#00ff41]/5 rounded-lg flex items-center justify-center border border-[#00ff41]/20">
            <CreditCard className="text-[#00ff41]" size={28} />
          </div>
        </div>
        <h1 className="text-3xl font-black text-[#00ff41] mb-2">Subscription Plans</h1>
        <p className="text-slate-400 mb-6">Premium access to extended recon, quizzes, and priority processing.</p>

        <div className="py-6">
          <h3 className="text-lg font-bold">Coming soon — stay tuned</h3>
          <p className="text-slate-500 mt-2">We are preparing secure payment integration. Subscribe for extended access once available.</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/chat" className="px-4 py-2 rounded-lg bg-[#00ff41] text-black font-bold">Return to Chat</Link>
        </div>
      </div>
    </div>
  )
}
