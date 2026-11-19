export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { hasFullAccess } from '@/lib/access';
import { ensureCompanyCode, regenerateCompanyCode } from '@/lib/network';

// Firma kodu: başka SoleCost firmaları bu kodla firmanızı tedarikçi olarak ekler
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ code: await ensureCompanyCode(user.companyId) });
}

// Yenile: yalnızca yeni istekler etkilenir, kurulmuş bağlantılar kalır
export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasFullAccess(user)) return NextResponse.json({ error: 'Firma kodunu yalnızca firma yöneticisi yenileyebilir' }, { status: 403 });
  return NextResponse.json({ code: await regenerateCompanyCode(user.companyId) });
}
