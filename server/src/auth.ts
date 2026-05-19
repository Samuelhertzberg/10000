import { OAuth2Client } from 'google-auth-library'
import type { Context, Next } from 'hono'

const clientId = process.env.GOOGLE_CLIENT_ID
const adminEmail = process.env.ADMIN_EMAIL
const adminAuthBypass = process.env.ADMIN_AUTH_BYPASS === 'true'
const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST

const oauth = new OAuth2Client()

export const requireAdmin = async (c: Context, next: Next) => {
  if (adminAuthBypass) {
    if (!firestoreEmulatorHost) {
      return c.json({ error: 'admin auth bypass requires firestore emulator' }, 500)
    }
    await next()
    return
  }

  if (!clientId || !adminEmail) {
    return c.json({ error: 'server misconfigured' }, 500)
  }

  const header = c.req.header('Authorization') ?? ''
  const m = header.match(/^Bearer (.+)$/)
  if (!m) return c.json({ error: 'unauthorized' }, 401)

  try {
    const ticket = await oauth.verifyIdToken({
      idToken: m[1],
      audience: clientId,
    })
    const payload = ticket.getPayload()
    if (
      !payload ||
      payload.email !== adminEmail ||
      payload.email_verified !== true
    ) {
      return c.json({ error: 'forbidden' }, 403)
    }
  } catch {
    return c.json({ error: 'invalid token' }, 401)
  }

  await next()
}
