import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import clientPromise from '@/lib/mongodb'

export const authOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here'
      ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const client = await clientPromise
          const db = client.db('defensegpt')
          const user = await db.collection('users').findOne({
            email: credentials.email.toLowerCase(),
          })

          if (!user || !user.password) {
            return null
          }

          const isValid = await bcrypt.compare(credentials.password, user.password)
          if (!isValid) {
            return null
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
          }
        } catch (error) {
          console.error('[AUTH] Credentials error:', error)
          return null
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          const client = await clientPromise
          const db = client.db('defensegpt')
          const existingUser = await db.collection('users').findOne({
            email: user.email.toLowerCase(),
          })

          if (!existingUser) {
            await db.collection('users').insertOne({
              name: user.name || profile?.name || 'User',
              email: user.email.toLowerCase(),
              image: user.image || profile?.picture,
              provider: 'google',
              createdAt: new Date(),
            })
            console.log('[AUTH] Created Google user:', user.email)
          } else {
            console.log('[AUTH] Found existing user:', user.email)
          }
        } catch (error) {
          console.error('[AUTH] Google signIn DB error:', error)
          return false
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      try {
        // For credentials login, user.id is already the MongoDB _id
        if (user?.id && account?.provider === 'credentials') {
          token.userId = user.id
        }

        // For Google OAuth, look up the MongoDB user by email
        if (account?.provider === 'google') {
          const client = await clientPromise
          const db = client.db('defensegpt')
          const dbUser = await db.collection('users').findOne({
            email: (user?.email || token?.email)?.toLowerCase(),
          })
          if (dbUser) {
            token.userId = dbUser._id.toString()
            console.log('[AUTH] JWT: Set userId for Google user:', token.userId)
          }
        }
      } catch (error) {
        console.error('[AUTH] JWT callback error:', error)
      }
      return token
    },
    async session({ session, token }) {
      if (token?.userId) {
        session.user.id = token.userId
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
}
