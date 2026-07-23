import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Configurable Quota Limits & Reset Window (24 hours)
const FREE_LIMIT = parseInt(process.env.USAGE_LIMIT || '5', 10)
const PRO_LIMIT = parseInt(process.env.PRO_USAGE_LIMIT || '100', 10)
const RESET_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return '127.0.0.1'
}

function getIpHash(ip) {
  return crypto.createHash('sha256').update(`${ip}_defense_guest_salt`).digest('hex')
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    const client = await clientPromise
    const db = client.db('defensegpt')
    const now = Date.now()

    // ── 1. Authenticated Users ──────────────────────────────────────────
    if (session?.user?.id) {
      const users = db.collection('users')
      const uid = session.user.id
      const user = await users.findOne({ _id: new ObjectId(uid) })

      const isPro = Boolean(user?.pro)
      const limit = isPro ? PRO_LIMIT : FREE_LIMIT
      let usage = user?.usage_count || 0
      const resetAt = user?.usage_reset_at ? new Date(user.usage_reset_at).getTime() : 0

      if (now >= resetAt) usage = 0

      return NextResponse.json({
        authenticated: true,
        usage,
        limit,
        isPro,
        resetAt: resetAt || (now + RESET_WINDOW_MS),
      })
    }

    // ── 2. Guest Users (IP-based server-side rate limiter) ─────────────
    const ip = getClientIp(request)
    const ipHash = getIpHash(ip)
    const guestCollection = db.collection('guest_usages')
    const guestRecord = await guestCollection.findOne({ _id: ipHash })

    let usage = guestRecord?.usage_count || 0
    const resetAt = guestRecord?.usage_reset_at ? new Date(guestRecord.usage_reset_at).getTime() : 0

    if (now >= resetAt) usage = 0

    return NextResponse.json({
      authenticated: false,
      usage,
      limit: FREE_LIMIT,
      isPro: false,
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
    const client = await clientPromise
    const db = client.db('defensegpt')
    const now = Date.now()

    // ── 1. Authenticated Users ──────────────────────────────────────────
    if (session?.user?.id) {
      const users = db.collection('users')
      const uid = session.user.id
      const user = await users.findOne({ _id: new ObjectId(uid) })
      const isPro = Boolean(user?.pro)
      const limit = isPro ? PRO_LIMIT : FREE_LIMIT

      let currentUsage = user?.usage_count || 0
      const resetAt = user?.usage_reset_at ? new Date(user.usage_reset_at).getTime() : 0

      if (now >= resetAt) {
        const newResetAt = new Date(now + RESET_WINDOW_MS)
        await users.updateOne(
          { _id: new ObjectId(uid) },
          { $set: { usage_count: 1, usage_reset_at: newResetAt, updatedAt: new Date() } },
          { upsert: true }
        )
        return NextResponse.json({ authenticated: true, usage: 1, limit, isPro, resetAt: newResetAt.getTime() })
      }

      if (currentUsage >= limit) {
        const hoursLeft = Math.ceil((resetAt - now) / (60 * 60 * 1000))
        return NextResponse.json(
          { error: `Usage limit reached (${limit} questions). Resets in ~${hoursLeft}h.`, usage: currentUsage, limit, resetAt },
          { status: 403 }
        )
      }

      const updated = await users.findOneAndUpdate(
        { _id: new ObjectId(uid) },
        { $inc: { usage_count: 1 } },
        { returnDocument: 'after', upsert: true }
      )
      const newCount = updated.value?.usage_count || currentUsage + 1
      return NextResponse.json({ authenticated: true, usage: newCount, limit, isPro, resetAt })
    }

    // ── 2. Guest Users (IP-based server-side enforcement) ───────────────
    const ip = getClientIp(request)
    const ipHash = getIpHash(ip)
    const guestCollection = db.collection('guest_usages')
    const guestRecord = await guestCollection.findOne({ _id: ipHash })

    let currentUsage = guestRecord?.usage_count || 0
    const resetAt = guestRecord?.usage_reset_at ? new Date(guestRecord.usage_reset_at).getTime() : 0

    // Reset window expired
    if (now >= resetAt) {
      const newResetAt = new Date(now + RESET_WINDOW_MS)
      await guestCollection.updateOne(
        { _id: ipHash },
        { $set: { usage_count: 1, usage_reset_at: newResetAt, updatedAt: new Date() } },
        { upsert: true }
      )
      return NextResponse.json({ authenticated: false, usage: 1, limit: FREE_LIMIT, isPro: false, resetAt: newResetAt.getTime() })
    }

    // Check guest limit (5 queries/24h)
    if (currentUsage >= FREE_LIMIT) {
      const hoursLeft = Math.ceil((resetAt - now) / (60 * 60 * 1000))
      return NextResponse.json(
        {
          error: `Guest limit reached (5 questions per 24 hours). Resets in ~${hoursLeft}h. Sign in or upgrade for more questions!`,
          usage: currentUsage,
          limit: FREE_LIMIT,
          resetAt,
        },
        { status: 403 }
      )
    }

    // Increment guest usage
    const updated = await guestCollection.findOneAndUpdate(
      { _id: ipHash },
      { $inc: { usage_count: 1 } },
      { returnDocument: 'after', upsert: true }
    )
    const newCount = updated.value?.usage_count || currentUsage + 1
    return NextResponse.json({ authenticated: false, usage: newCount, limit: FREE_LIMIT, isPro: false, resetAt })

  } catch (error) {
    console.error('/api/usage POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
