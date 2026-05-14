import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

const LIMIT = 8

// GET returns current usage; POST increments (if under limit)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      // Unauthenticated — return anonymous info so frontend can fallback to local tracking
      return NextResponse.json({ authenticated: false, usage: 0, limit: LIMIT })
    }

    const client = await clientPromise
    const db = client.db('defensegpt')
    const users = db.collection('users')
    const uid = session.user.id
    const user = await users.findOne({ _id: new ObjectId(uid) })
    const usage = (user && user.usage_count) ? user.usage_count : 0
    return NextResponse.json({ authenticated: true, usage, limit: LIMIT })
  } catch (error) {
    console.error('/api/usage GET error:', error)
    return NextResponse.json({ authenticated: false, usage: 0, limit: LIMIT })
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
    const current = (user && user.usage_count) ? user.usage_count : 0
    if (current >= LIMIT) {
      return NextResponse.json({ error: 'Usage limit exceeded', usage: current, limit: LIMIT }, { status: 403 })
    }

    const updated = await users.findOneAndUpdate(
      { _id: new ObjectId(uid) },
      { $inc: { usage_count: 1 } },
      { returnDocument: 'after', upsert: true }
    )

    const newCount = (updated.value && updated.value.usage_count) ? updated.value.usage_count : current + 1
    return NextResponse.json({ authenticated: true, usage: newCount, limit: LIMIT })
  } catch (error) {
    console.error('/api/usage POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
