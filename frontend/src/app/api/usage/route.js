import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

// Configurable Quota Limits & Reset Window (24 hours)
const FREE_LIMIT = parseInt(process.env.USAGE_LIMIT || '5', 10)
const PRO_LIMIT = parseInt(process.env.PRO_USAGE_LIMIT || '100', 10) // 100 queries per 24h for Pro
const RESET_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ authenticated: false, usage: 0, limit: FREE_LIMIT, isPro: false })
    }

    const client = await clientPromise
    const db = client.db('defensegpt')
    const users = db.collection('users')
    const uid = session.user.id
    const user = await users.findOne({ _id: new ObjectId(uid) })

    const isPro = Boolean(user?.pro)
    const limit = isPro ? PRO_LIMIT : FREE_LIMIT
    const now = Date.now()

    let usage = user?.usage_count || 0
    const resetAt = user?.usage_reset_at ? new Date(user.usage_reset_at).getTime() : 0

    // Auto-reset counter if 24-hour window has expired
    if (now >= resetAt) {
      usage = 0
    }

    return NextResponse.json({
      authenticated: true,
      usage,
      limit,
      isPro,
      resetAt: resetAt || (now + RESET_WINDOW_MS),
    })
  } catch (error) {
    console.error('/api/usage GET error:', error)
    return NextResponse.json({ authenticated: false, usage: 0, limit: FREE_LIMIT, isPro: false })
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const client = await clientPromise
    const db = client.db('defensegpt')
    const users = db.collection('users')
    const uid = session.user.id

    const user = await users.findOne({ _id: new ObjectId(uid) })
    const isPro = Boolean(user?.pro)
    const limit = isPro ? PRO_LIMIT : FREE_LIMIT
    const now = Date.now()

    let currentUsage = user?.usage_count || 0
    const resetAt = user?.usage_reset_at ? new Date(user.usage_reset_at).getTime() : 0

    // Check if current 24h rate-limit window has expired
    if (now >= resetAt) {
      // Window expired: Reset counter to 1 for this new request
      const newResetAt = new Date(now + RESET_WINDOW_MS)
      await users.updateOne(
        { _id: new ObjectId(uid) },
        {
          $set: {
            usage_count: 1,
            usage_reset_at: newResetAt,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      )
      return NextResponse.json({ authenticated: true, usage: 1, limit, isPro, resetAt: newResetAt.getTime() })
    }

    // Still within active window — check quota
    if (currentUsage >= limit) {
      const hoursLeft = Math.ceil((resetAt - now) / (60 * 60 * 1000))
      return NextResponse.json(
        {
          error: `Usage limit reached for this 24-hour period (${limit} questions). Resets in ~${hoursLeft}h.`,
          usage: currentUsage,
          limit,
          resetAt,
        },
        { status: 403 }
      )
    }

    // Increment usage within active window
    const updated = await users.findOneAndUpdate(
      { _id: new ObjectId(uid) },
      { $inc: { usage_count: 1 } },
      { returnDocument: 'after', upsert: true }
    )

    const newCount = updated.value?.usage_count || currentUsage + 1
    return NextResponse.json({ authenticated: true, usage: newCount, limit, isPro, resetAt })

  } catch (error) {
    console.error('/api/usage POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
