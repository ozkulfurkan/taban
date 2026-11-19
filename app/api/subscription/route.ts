export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { subscriptionState, TRIAL_DAYS } from '@/lib/subscription';

// Firmanın abonelik durumu (web ve mobil). RevenueCat'te kullanıcı kimliği firma id'sidir.
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { id: true, subscriptionStatus: true, trialEndsAt: true, proUntil: true, subscriptionSource: true, subscriptionPlan: true },
  });
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    ...subscriptionState(company),
    companyId: company.id,
    trialDays: TRIAL_DAYS,
    // Satın almayı firma sahibi / yöneticisi yapar (abonelik firma adına)
    canPurchase: user.role === 'ADMIN' || user.role === 'COMPANY_OWNER',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
