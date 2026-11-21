export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sendDailySummaries } from '@/lib/daily-summary';

// Günlük özet e-postası. Her sabah kur güncellemesiyle birlikte (/api/cron/update-rates, TR 10:00) çalışır;
// bu uç elle tetiklemek içindir. CRON_SECRET olmadan çalışmaz.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const r = await sendDailySummaries();
  return NextResponse.json({ ok: true, ...r });
}
