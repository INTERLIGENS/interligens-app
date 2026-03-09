// @generated:pr1-admin-cookie-auth
import { NextRequest, NextResponse } from 'next/server'
import { clearAdminCookie } from '@/lib/security/adminAuth'

/**
 * POST /api/admin/auth/logout
 * Supprime le cookie admin_token.
 * Pas besoin d'être authentifié pour logout (safe by design).
 */
export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  clearAdminCookie(res)
  return res
}
