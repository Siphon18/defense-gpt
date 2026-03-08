import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

// DELETE /api/chats/[id] — Delete a specific chat
export async function DELETE(request, { params }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const client = await clientPromise
        const db = client.db('defensegpt')

        const result = await db.collection('chats').deleteOne({
            _id: new ObjectId(id),
            userId: session.user.id,
        })

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('DELETE /api/chats/[id] error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
