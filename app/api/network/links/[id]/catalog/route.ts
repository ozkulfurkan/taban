export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { linkFor, sellerCatalog } from '@/lib/network';

// Alıcının gördüğü satıcı kataloğu (fiyatsız). Yalnızca onaylı bağlantıda.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const link = await linkFor(user.companyId, params.id, 'buyer');
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (link.status !== 'ACTIVE') return NextResponse.json({ error: 'Bağlantı onaylanmadı' }, { status: 403 });
  return NextResponse.json({ sellerName: link.sellerCompany.name, products: await sellerCatalog(link) });
}
