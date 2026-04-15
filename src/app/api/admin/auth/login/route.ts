// @generated:pr1-admin-cookie-auth
import { NextRequest, NextResponse } from 'next/server'
import {
  setAdminCookie,
  setAdminSessionCookie,
} from '@/lib/security/adminAuth'
import { timingSafeEqual } from 'crypto'

// SEC-006 — timing-safe compare for the admin login password / token.
function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, Buffer.alloc(ba.length))
    return false
  }
  return timingSafeEqual(ba, bb)
}

/**
 * POST /api/admin/auth/login
 * Body : { "password": "<ADMIN_BASIC_PASS>" }  (legacy also accepts `token`)
 *
 * Verifies the Basic Auth password against ADMIN_BASIC_PASS and, on match,
 * sets two cookies:
 *   - admin_session — HMAC-signed (required by middleware on /admin/* pages)
 *   - admin_token   — raw ADMIN_TOKEN (consumed by requireAdminApi for
 *                     internal fetches from admin UI pages)
 *
 * Legacy curl callers that POST `{token: ADMIN_TOKEN}` are still supported
 * for backward compat so existing scripts keep working.
 */
export async function POST(req: NextRequest) {
  let body: { password?: string; token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : null
  const legacyToken = typeof body.token === 'string' ? body.token : null
  if (!password && !legacyToken) {
    return NextResponse.json({ error: 'Password manquant' }, { status: 400 })
  }

  const expectedPass = process.env.ADMIN_BASIC_PASS
  const expectedToken = process.env.ADMIN_TOKEN
  if (!expectedToken) {
    console.error('[admin/auth/login] ADMIN_TOKEN non configuré')
    return NextResponse.json(
      { error: 'Configuration serveur incorrecte' },
      { status: 500 },
    )
  }

  let matched = false
  if (password && expectedPass) {
    matched = constantTimeEqual(password, expectedPass)
  }
  if (!matched && legacyToken) {
    matched = constantTimeEqual(legacyToken, expectedToken)
  }

  if (!matched) {
    console.warn('[admin/auth/login] password invalide', {
      ip: req.headers.get('x-forwarded-for') ?? 'unknown',
    })
    await new Promise(r => setTimeout(r, 200))
    return NextResponse.json({ error: 'Password invalide' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  setAdminSessionCookie(res)
  setAdminCookie(res)

  console.info('[admin/auth/login] authentification réussie', {
    ip: req.headers.get('x-forwarded-for') ?? 'unknown',
  })

  return res
}
