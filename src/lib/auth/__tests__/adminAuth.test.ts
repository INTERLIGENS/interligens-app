// @generated:pr1-admin-cookie-auth
// @pr1:test-header-fix
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  getAdminTokenFromReq,
  isAdminApi,
  requireAdminApi,
  setAdminCookie,
  clearAdminCookie,
} from '@/lib/security/adminAuth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(opts: {
  adminHeader?: string
  cookies?: Record<string, string>
  path?: string
}): NextRequest {
  const url = `http://localhost:3100${opts.path ?? '/api/admin/test'}`
  const headers = new Headers()
  if (opts.adminHeader) headers.set('x-admin-token', opts.adminHeader)
  if (opts.cookies) {
    headers.set(
      'cookie',
      Object.entries(opts.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    )
  }
  return new NextRequest(url, { headers })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getAdminTokenFromReq', () => {
  it('retourne null si aucun header ni cookie', () => {
    expect(getAdminTokenFromReq(makeReq({}))).toBeNull()
  })

  it('extrait depuis Authorization Bearer', () => {
    const req = makeReq({ adminHeader: 'my-secret' })
    expect(getAdminTokenFromReq(req)).toBe('my-secret')
  })

  it('extrait depuis le cookie admin_token', () => {
    const req = makeReq({ cookies: { admin_token: 'cookie-secret' } })
    expect(getAdminTokenFromReq(req)).toBe('cookie-secret')
  })

  it('prioritise le header sur le cookie', () => {
    const req = makeReq({
      adminHeader: 'header-secret',
      cookies: { admin_token: 'cookie-secret' },
    })
    expect(getAdminTokenFromReq(req)).toBe('header-secret')
  })
})

describe('isAdminApi', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_TOKEN', 'test-admin-token')
  })

  it('retourne false si token manquant', () => {
    expect(isAdminApi(makeReq({}))).toBe(false)
  })

  it('retourne false si token incorrect', () => {
    const req = makeReq({ adminHeader: 'wrong-token' })
    expect(isAdminApi(req)).toBe(false)
  })

  it('retourne true avec le bon header', () => {
    const req = makeReq({ adminHeader: 'test-admin-token' })
    expect(isAdminApi(req)).toBe(true)
  })

  it('retourne true avec le bon cookie', () => {
    const req = makeReq({ cookies: { admin_token: 'test-admin-token' } })
    expect(isAdminApi(req)).toBe(true)
  })

  it('retourne false si ADMIN_TOKEN env manquant', () => {
    vi.stubEnv('ADMIN_TOKEN', '')
    const req = makeReq({ adminHeader: 'test-admin-token' })
    expect(isAdminApi(req)).toBe(false)
  })
})

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_TOKEN', 'test-admin-token')
  })

  it('retourne null si authentifié (header)', () => {
    const req = makeReq({ adminHeader: 'test-admin-token' })
    expect(requireAdminApi(req)).toBeNull()
  })

  it('retourne null si authentifié (cookie)', () => {
    const req = makeReq({ cookies: { admin_token: 'test-admin-token' } })
    expect(requireAdminApi(req)).toBeNull()
  })

  it('retourne 401 si non authentifié', () => {
    const req = makeReq({})
    const res = requireAdminApi(req)
    expect(res).not.toBeNull()
    expect(res?.status).toBe(401)
  })
})

describe('setAdminCookie / clearAdminCookie', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_TOKEN', 'test-admin-token')
  })

  it('setAdminCookie pose le cookie admin_token httpOnly', () => {
    const res = NextResponse.json({ ok: true })
    setAdminCookie(res)
    const cookie = res.cookies.get('admin_token')
    expect(cookie?.value).toBe('test-admin-token')
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('strict')
  })

  it('clearAdminCookie pose maxAge=0', () => {
    const res = NextResponse.json({ ok: true })
    clearAdminCookie(res)
    const cookie = res.cookies.get('admin_token')
    expect(cookie?.maxAge).toBe(0)
  })

  it('setAdminCookie throw si ADMIN_TOKEN manquant', () => {
    vi.stubEnv('ADMIN_TOKEN', '')
    const res = NextResponse.json({ ok: true })
    expect(() => setAdminCookie(res)).toThrow()
  })
})
