import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
const options = {}

let clientPromise

if (uri) {
  if (process.env.NODE_ENV === 'development') {
    // In dev, use a global variable to preserve the client across hot reloads
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options)
      global._mongoClientPromise = client.connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    const client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
} else {
  // Graceful promise rejection for build time or missing MONGODB_URI
  clientPromise = Promise.reject(new Error('Please configure MONGODB_URI in your environment.'))
  // Suppress unhandled rejection warning during build phase
  clientPromise.catch(() => {})
}

export default clientPromise
