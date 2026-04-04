import admin from 'firebase-admin'
import { connectDB } from './mongodb'
import { DeviceToken } from './models/DeviceToken'

// Singleton init — safe on Vercel (module cached between invocations)
function getApp() {
  if (admin.apps.length) return admin.apps[0]!

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON env var not set — push disabled.')
    return null
  }

  return admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
  })
}

/**
 * Send a push notification to all registered devices.
 * Silently removes tokens that FCM reports as invalid/unregistered.
 */
export async function sendPushToAll(
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  const app = getApp()
  if (!app) return

  await connectDB()
  const docs = await DeviceToken.find({}, 'token').lean()
  if (!docs.length) return

  const tokens = docs.map((d) => d.token as string)

  const response = await admin.messaging(app).sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'orders' },
    },
  })

  // Clean up stale tokens
  const toDelete: string[] = []
  response.responses.forEach((res, idx) => {
    if (!res.success) {
      const code = res.error?.code
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        toDelete.push(tokens[idx])
      }
    }
  })
  if (toDelete.length) {
    await DeviceToken.deleteMany({ token: { $in: toDelete } })
  }
}
