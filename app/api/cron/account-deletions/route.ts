export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { runDueDeletions } from '@/lib/account-deletion';

// Günlük: pasif dönemi (15 gün) dolan firma ve kullanıcı hesaplarını tamamen siler.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runDueDeletions();
  if (result.errors.length) console.error('account-deletions:', result.errors);
  return NextResponse.json(result);
}
