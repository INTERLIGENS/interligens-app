import { NextRequest, NextResponse } from 'next/server'
import { checkAddressLabel } from '@/lib/labels/scanEnrich'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')
  if (!address) return NextResponse.json({ found: false })

  const result = await checkAddressLabel(address)
  return NextResponse.json(result)
}
