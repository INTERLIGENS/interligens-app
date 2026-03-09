// @generated:pr1-admin-cookie-auth
import { NextRequest, NextResponse } from 'next/server'
import { setAdminCookie } from '@/lib/security/adminAuth'

/**
 * POST /api/admin/auth/login
 * Body : { "token": "<ADMIN_TOKEN>" }
 * Pose un cookie httpOnly admin_token si le token est valide.
 * Rate-limiting géré par le middleware Upstash existant.
 */
export async function POST(req: NextRequest) {
  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const { token } = body
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
  }

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    console.error('[admin/auth/login] ADMIN_TOKEN non configuré')
    return NextResponse.json({ error: 'Configuration serveur incorrecte' }, { status: 500 })
  }

  if (token !== expected) {
    console.warn('[admin/auth/login] token invalide', {
      ip: req.headers.get('x-forwarded-for') ?? 'unknown',
    })
    // Délai constant pour éviter timing attack
    await new Promise(r => setTimeout(r, 200))
    return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  setAdminCookie(res)

  console.info('[admin/auth/login] authentification réussie', {
    ip: req.headers.get('x-forwarded-for') ?? 'unknown',
  })

  return res
}
