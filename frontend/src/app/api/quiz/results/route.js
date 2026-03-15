import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'

// POST /api/quiz/results — Save a quiz result
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const result = await request.json()
        if (!result || typeof result !== 'object') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }
        const totalQuestions = Number(result.totalQuestions)
        const score = Number(result.score)
        const percentage = Number(result.percentage)
        if (!Number.isInteger(totalQuestions) || totalQuestions < 1 || totalQuestions > 100) {
            return NextResponse.json({ error: 'Invalid totalQuestions' }, { status: 400 })
        }
        if (!Number.isInteger(score) || score < 0 || score > totalQuestions) {
            return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
        }
        if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
            return NextResponse.json({ error: 'Invalid percentage' }, { status: 400 })
        }
        if (!Array.isArray(result.answers) || result.answers.length !== totalQuestions) {
            return NextResponse.json({ error: 'Invalid answers' }, { status: 400 })
        }
        const client = await clientPromise
        const db = client.db('defensegpt')

        const doc = {
            userId: session.user.id,
            examType: result.examType,
            topic: result.topic,
            difficulty: result.difficulty,
            totalQuestions,
            score,
            percentage,
            answers: result.answers,
            createdAt: new Date(),
        }

        await db.collection('quiz_results').insertOne(doc)

        return NextResponse.json({ success: true }, { status: 201 })
    } catch (error) {
        console.error('POST /api/quiz/results error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// GET /api/quiz/results — Fetch quiz history for the authenticated user
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const client = await clientPromise
        const db = client.db('defensegpt')
        const results = await db
            .collection('quiz_results')
            .find({ userId: session.user.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray()

        const formatted = results.map(r => ({
            ...r,
            id: r._id.toString(),
            _id: undefined,
        }))

        return NextResponse.json(formatted)
    } catch (error) {
        console.error('GET /api/quiz/results error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
