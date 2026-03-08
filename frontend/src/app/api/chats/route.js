import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

// GET /api/chats — Fetch all chats for the authenticated user
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const client = await clientPromise
        const db = client.db('defensegpt')
        const chats = await db
            .collection('chats')
            .find({ userId: session.user.id })
            .sort({ updatedAt: -1 })
            .toArray()

        // Convert _id to string id for frontend compatibility
        const formatted = chats.map(c => ({
            ...c,
            id: c._id.toString(),
            _id: undefined,
        }))

        return NextResponse.json(formatted)
    } catch (error) {
        console.error('GET /api/chats error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/chats — Create or update a chat
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const chat = await request.json()
        const client = await clientPromise
        const db = client.db('defensegpt')
        const collection = db.collection('chats')

        const chatDoc = {
            ...chat,
            userId: session.user.id,
            updatedAt: Date.now(),
        }

        if (chat.id) {
            // Update existing chat
            const { id, ...updateData } = chatDoc
            await collection.updateOne(
                { _id: new ObjectId(id), userId: session.user.id },
                { $set: updateData },
                { upsert: false }
            )
            return NextResponse.json({ id, ...updateData })
        } else {
            // Create new chat
            chatDoc.createdAt = Date.now()
            const result = await collection.insertOne(chatDoc)
            return NextResponse.json(
                { id: result.insertedId.toString(), ...chatDoc },
                { status: 201 }
            )
        }
    } catch (error) {
        console.error('POST /api/chats error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
