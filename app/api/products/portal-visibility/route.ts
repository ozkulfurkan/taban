export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// Toplu portal görünürlüğü (mobil ürün listesi ve detay): seçilen ürünler portalda gösterilir / gizlenir.
// Yalnızca görünürlük değişir; ürüne atanmış müşteri kısıtlamaları korunur.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Ürün değiştirme yetkiniz yok' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? Array.from(new Set<string>(body.ids.filter((x: unknown) => typeof x === 'string' && x))) : [];
  if (!ids.length || ids.length > 500) return NextResponse.json({ error: 'Ürün seçin (en fazla 500)' }, { status: 400 });
  if (typeof body?.visible !== 'boolean') return NextResponse.json({ error: 'visible gerekli' }, { status: 400 });

  const own = await prisma.product.count({ where: { id: { in: ids }, companyId: user.companyId } });
  if (own !== ids.length) return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 });

  const r = await prisma.product.updateMany({ where: { id: { in: ids }, companyId: user.companyId }, data: { portalVisible: body.visible } });
  return NextResponse.json({ updated: r.count, visible: body.visible });
}
