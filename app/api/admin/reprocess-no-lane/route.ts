import { NextResponse } from 'next/server'
import { requireAdmin, getServiceSupabase } from '../../../../lib/auth'

const EDGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/parse-listing`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET — no_lane id listesi
export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('raw_posts')
    .select('id')
    .eq('processing_status', 'no_lane')
    .is('slh_scanned_at', null)
    .order('id', { ascending: true })
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ids: data.map((r: { id: string }) => r.id) })
}

// POST — tek raw_post_id için Edge Function proxy
export async function POST(request: Request) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const { raw_post_id } = await request.json()
  if (!raw_post_id) return NextResponse.json({ error: 'raw_post_id gerekli' }, { status: 400 })

  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw_post_id }),
  })

  const json = await res.json()
  return NextResponse.json(json, { status: res.ok ? 200 : 500 })
}
