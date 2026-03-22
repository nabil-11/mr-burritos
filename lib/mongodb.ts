import mongoose from 'mongoose'

const MONGO_URL = process.env.MONGO_URL!

if (!MONGO_URL) throw new Error('MONGO_URL is not defined')

declare global {
  // eslint-disable-next-line no-var
  var mongoose: { conn: mongoose.Connection | null; promise: Promise<mongoose.Connection> | null }
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export async function connectDB() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGO_URL).then((m) => m.connection)
  }

  cached.conn = await cached.promise
  return cached.conn
}
