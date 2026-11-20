export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { hasFullAccess } from '@/lib/access';
import { linkFor } from '@/lib/network';
import { statementRange } from '@/lib/statement';
import { publicStatementBody, statementCompany } from '@/lib/statement-public';

// Firma ağı: bağlı firmanın, sizin için tuttuğu hesap ekstresi (karşı tarafın defteri).
//  Alıcı  → satıcının "müşteri" kaydındaki ekstre (satıcı.sellerCustomerId)
//  Satıcı → alıcının "tedarikçi" kaydındaki ekstre (alıcı.buyerSupplierId)
// Yalnızca onaylı (ACTIVE) bağlantıda; görüntüleyenin ilgili cari sayfasına izni olmalı.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const link = await linkFor(user.companyId, params.id);
  if (!link) return NextResponse.json({ error: 'Bağlantı bulunamadı' }, { status: 404 });
  if (link.status !== 'ACTIVE') return NextResponse.json({ error: 'Bağlantı onaylı değil' }, { status: 403 });

  const asBuyer = link.buyerCompanyId === user.companyId;
  const page = asBuyer ? 'suppliers' : 'customers';
  if (!hasFullAccess(user) && !(user.allowedPages ?? []).includes(page)) {
    return NextResponse.json({ error: 'Bu ekstreyi görme yetkiniz yok' }, { status: 403 });
  }

  const ownerCompanyId = asBuyer ? link.sellerCompanyId : link.buyerCompanyId;
  const partyId = asBuyer ? link.sellerCustomerId : link.buyerSupplierId;
  const counterpart = asBuyer ? link.sellerCompany.name : link.buyerCompany.name;
  if (!partyId) {
    return NextResponse.json(
      { error: `${counterpart} firmasında sizinle eşleşen cari kaydı yok.`, code: 'NO_PARTY' },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(req.url);
  const { from, to } = statementRange(searchParams.get('from'), searchParams.get('to'));
  const [body, company] = await Promise.all([
    publicStatementBody(ownerCompanyId, asBuyer ? { customerId: partyId } : { supplierId: partyId }, from, to),
    statementCompany(ownerCompanyId),
  ]);
  if (!body || !company) return NextResponse.json({ error: 'Ekstre bulunamadı', code: 'NO_PARTY' }, { status: 404 });

  return NextResponse.json(
    { ...body, company, from: from.toISOString(), to: to.toISOString(), side: asBuyer ? 'buyer' : 'seller' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
