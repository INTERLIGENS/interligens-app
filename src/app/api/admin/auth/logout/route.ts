// @generated:pr1-admin-cookie-auth
import { NextRequest, NextResponse } from 'next/server'
import {
  clearAdminCookie,
  clearAdminSessionCookie,
} from '@/lib/security/adminAuth'

/**
 * GET /api/admin/auth/logout
 * Clears both admin_session and admin_token cookies and redirects to
 * /admin/login. GET is intentional — the logout button in the admin layout
 * is a plain <a href>, so no JS or CSRF token is needed.
 */
export async function GET(req: NextRequest) {
  const loginUrl = new URL('/admin/login', req.url)
  const res = NextResponse.redirect(loginUrl)
  clearAdminSessionCookie(res)
  clearAdminCookie(res)
  return res
}

/**
 * POST /api/admin/auth/logout — legacy path kept for callers that already
 * fire a POST. Same semantics as GET, returns JSON instead of a redirect.
 */
export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  clearAdminSessionCookie(res)
  clearAdminCookie(res)
  return res
}
