import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import clientPromise from '@/lib/mongodb'

export const authOptions = {
  // No adapter — we use JWT sessions and handle user creation manually
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

        const client = await clientPromise
        const db = client.db()
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
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account, profile }) {
      // For Google OAuth: create or find user in our DB
      if (account?.provider === 'google') {
        try {
          const client = await clientPromise
          const db = client.db()
          const existingUser = await db.collection('users').findOne({
            email: user.email.toLowerCase(),
          })

          if (!existingUser) {
            // Create a new user for Google OAuth
            await db.collection('users').insertOne({
              name: user.name || profile?.name || 'User',
              email: user.email.toLowerCase(),
              image: user.image || profile?.picture,
              provider: 'google',
              createdAt: new Date(),
            })
          }
        } catch (error) {
          console.error('Google sign-in DB error:', error)
          return false
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      // For credentials login — user.id comes from authorize()
      if (user?.id) {
        token.userId = user.id
      }
      // For Google OAuth — look up the user ID from our DB
      if (account?.provider === 'google') {
        try {
          const client = await clientPromise
          const db = client.db()
          const dbUser = await db.collection('users').findOne({
            email: token.email?.toLowerCase(),
          })
          if (dbUser) {
            token.userId = dbUser._id.toString()
          }
        } catch (error) {
          console.error('JWT callback DB error:', error)
        }
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
  debug: process.env.NODE_ENV === 'development',
}
