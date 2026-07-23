import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Pricing structure (INR) - Student Budget Friendly & covers LLM API costs with 80%+ margin
const PRICING = {
  monthly: { amount: 19900, currency: 'INR', label: '₹199/month' }, // Amount in paise (199 INR)
  annual:  { amount: 149900, currency: 'INR', label: '₹1,499/year' }, // Amount in paise (1499 INR)
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json().catch(() => ({}))
    const billing = body.billing === 'annual' ? 'annual' : 'monthly'
    const planConfig = PRICING[billing]

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    // If Razorpay keys are configured, call Razorpay Orders API
    if (keyId && keySecret && !keyId.includes('your_')) {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: planConfig.amount,
          currency: planConfig.currency,
          receipt: `rcpt_${Date.now()}`,
          notes: {
            userId: session?.user?.id || 'guest',
            billing,
          },
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        console.error('Razorpay API order error:', errData)
        return NextResponse.json({ error: 'Failed to create order with gateway' }, { status: 500 })
      }

      const orderData = await response.json()
      return NextResponse.json({
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        keyId,
        isTestMode: false,
      })
    }

    // Sandbox / Test Mode fallback when API keys are not yet added to environment
    const testOrderId = `order_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
    return NextResponse.json({
      orderId: testOrderId,
      amount: planConfig.amount,
      currency: planConfig.currency,
      keyId: keyId || 'rzp_test_defensegpt',
      isTestMode: true,
      label: planConfig.label,
    })

  } catch (error) {
    console.error('POST /api/checkout/create-order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
