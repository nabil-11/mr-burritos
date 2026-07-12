import mongoose from 'mongoose'
import dns from 'node:dns'

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

function isSrvDnsError(err: unknown): boolean {
  const e = err as { code?: string; syscall?: string } | undefined
  return !!e && (e.syscall === 'querySrv' || e.syscall === 'queryTxt') &&
    (e.code === 'ECONNREFUSED' || e.code === 'ETIMEOUT' || e.code === 'ESERVFAIL' || e.code === 'ENOTFOUND')
}

// Some networks (mobile hotspots, captive portals) run DNS servers that refuse
// SRV/TXT queries, which breaks `mongodb+srv://` resolution. When that happens
// we resolve the seed list ourselves via public resolvers and connect with a
// plain `mongodb://` URI. Production networks resolve SRV natively and never
// hit this path.
async function resolveSrvViaPublicDns(uri: string): Promise<string> {
  const resolver = new dns.promises.Resolver()
  resolver.setServers(['1.1.1.1', '8.8.8.8'])

  const u = new URL(uri)
  const [srv, txt] = await Promise.all([
    resolver.resolveSrv(`_mongodb._tcp.${u.hostname}`),
    resolver.resolveTxt(u.hostname).catch(() => [] as string[][]),
  ])

  const hosts = srv.map((s) => `${s.name}:${s.port}`).join(',')
  const auth = u.username ? `${u.username}:${u.password}@` : ''
  const db = u.pathname || '/'

  const params = new URLSearchParams(u.search)
  if (!params.has('ssl') && !params.has('tls')) params.set('ssl', 'true')
  for (const row of txt) {
    const opts = new URLSearchParams(row.join(''))
    for (const [k, v] of opts) if (!params.has(k)) params.set(k, v)
  }

  return `mongodb://${auth}${hosts}${db}?${params.toString()}`
}

async function connectWithFallback(): Promise<typeof mongoose> {
  try {
    return await mongoose.connect(MONGO_URL)
  } catch (err) {
    if (MONGO_URL.startsWith('mongodb+srv://') && isSrvDnsError(err)) {
      const direct = await resolveSrvViaPublicDns(MONGO_URL)
      return await mongoose.connect(direct)
    }
    throw err
  }
}

export async function connectDB() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = connectWithFallback().then((m) => m.connection)
  }

  try {
    cached.conn = await cached.promise
  } catch (err) {
    // reset so the next request can retry instead of caching a failed promise
    cached.promise = null
    throw err
  }
  return cached.conn
}
