export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { MAX_LOGO_BYTES, decodeImage, toDataUrl } from '@/lib/product-image';

// Firma logosu (mobil Ayarlar): yalnızca firma sahibi / yönetici. Logo data URL olarak Company.logoUrl'de
// tutulur; katalog, ekstre ve teklif çıktıları aynen kullanır.

async function owner() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!['ADMIN', 'COMPANY_OWNER'].includes(user.role)) return { error: NextResponse.json({ error: 'Logoyu yalnızca firma sahibi değiştirebilir' }, { status: 403 }) };
  return { companyId: user.companyId as string };
}

export async function PUT(req: NextRequest) {
  const o = await owner();
  if ('error' in o) return o.error;
  const body = await req.json().catch(() => ({}));
  const img = decodeImage(body?.data, MAX_LOGO_BYTES);
  if ('error' in img) return NextResponse.json({ error: img.error }, { status: 400 });
  const logoUrl = toDataUrl(img.mime, img.bytes);
  await prisma.company.update({ where: { id: o.companyId }, data: { logoUrl } });
  return NextResponse.json({ logoUrl });
}

export async function DELETE() {
  const o = await owner();
  if ('error' in o) return o.error;
  await prisma.company.update({ where: { id: o.companyId }, data: { logoUrl: null } });
  return NextResponse.json({ logoUrl: null });
}
