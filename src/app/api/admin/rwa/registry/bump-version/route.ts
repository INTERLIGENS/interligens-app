import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/security/adminAuth'
import { bumpRegistryVersion, getRegistryVersion } from '@/lib/rwa-registry/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req)
  if (deny) return deny
  const registryVersion = await bumpRegistryVersion()
  return NextResponse.json({ registryVersion })
}

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req)
  if (deny) return deny
  const registryVersion = await getRegistryVersion()
  return NextResponse.json({ registryVersion })
}
