import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json().catch(() => ({}))
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, billing, isTestMode } = body

    if (!razorpay_order_id || !razorpay_payment_id) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET

    // 1. Verify Razorpay HMAC-SHA256 signature if in production mode
    if (!isTestMode && keySecret) {
      const hmac = crypto.createHmac('sha256', keySecret)
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`)
      const generatedSignature = hmac.digest('hex')

      if (generatedSignature !== razorpay_signature) {
        console.error('Invalid Razorpay payment signature:', { razorpay_order_id, razorpay_payment_id })
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
      }
    }

    // 2. Upgrade user in MongoDB (if authenticated)
    if (session?.user?.id) {
      try {
        const client = await clientPromise
        const db = client.db('defensegpt')
        const users = db.collection('users')
        const uid = session.user.id

        // Calculate subscription expiry (30 days for monthly, 365 for annual)
        const days = billing === 'annual' ? 365 : 30
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + days)

        await users.updateOne(
          { _id: new ObjectId(uid) },
          {
            $set: {
              pro: true,
              plan: 'commander',
              billingCycle: billing || 'monthly',
              subscriptionStatus: 'active',
              lastPaymentId: razorpay_payment_id,
              lastOrderId: razorpay_order_id,
              proExpiresAt: expiresAt,
              usage_count: 0, // Reset usage counter on upgrade
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        )
      } catch (dbErr) {
        console.error('MongoDB update error on payment success:', dbErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified. Commander Tier activated!',
      pro: true,
    })

  } catch (error) {
    console.error('POST /api/checkout/verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
