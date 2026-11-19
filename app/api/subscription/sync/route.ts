export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { revenueCatConfigured, syncCompanyFromRevenueCat } from '@/lib/revenuecat';

// Satın alma / geri yükleme sonrası: webhook'u beklemeden firmanın aboneliğini RevenueCat'ten hemen eşitler
export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!revenueCatConfigured()) return NextResponse.json({ error: 'Abonelik altyapısı henüz yapılandırılmadı' }, { status: 503 });
  try {
    const state = await syncCompanyFromRevenueCat(user.companyId);
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('subscription sync', e);
    return NextResponse.json({ error: 'Abonelik bilgisi alınamadı, biraz sonra tekrar deneyin' }, { status: 502 });
  }
}
