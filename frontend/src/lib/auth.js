import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { MongoDBAdapter } from '@auth/mongodb-adapter'
import bcrypt from 'bcryptjs'
import clientPromise from '@/lib/mongodb'

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here'
      ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          allowDangerousEmailAccountLinking: true,
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
    async signIn({ user, account }) {
      // Always allow sign-in
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id
      }
      // For OAuth, get the user ID from the adapter-created user
      if (account && account.provider !== 'credentials') {
        const client = await clientPromise
        const db = client.db()
        const dbUser = await db.collection('users').findOne({ email: token.email })
        if (dbUser) {
          token.userId = dbUser._id.toString()
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

