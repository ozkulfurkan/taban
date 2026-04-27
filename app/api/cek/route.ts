import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseDateInputOrNow, parseDateInput } from '@/lib/time';
import { logAction, getIp } from '@/lib/audit-logger';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const { searchParams } = new URL(req.url);
  const durum = searchParams.get('durum');
  const customerId = searchParams.get('customerId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 50;

  const where: any = { companyId: user.companyId };
  if (durum) where.durum = durum;
  if (customerId) where.customerId = customerId;

  const all = searchParams.get('all') === 'true';

  const SORT_FIELDS: Record<string, boolean> = {
    vadesi: true, borclu: true, tutar: true, bankasi: true,
    seriNo: true, islemTarihi: true, durum: true,
  };
  const sortBy = SORT_FIELDS[searchParams.get('sortBy') || ''] ? searchParams.get('sortBy')! : 'vadesi';
  const sortDir = searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc';

  const [cekler, total, stats] = await Promise.all([
    prisma.cek.findMany({
      where,
      include: { customer: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } },
      orderBy: { [sortBy]: sortDir },
      ...(all ? {} : { skip: (page - 1) * limit, take: limit }),
    }),
    prisma.cek.count({ where }),
    prisma.cek.findMany({ where, select: { tutar: true, vadesi: true } }),
  ]);

  const totalTutar = stats.reduce((s, c) => s + c.tutar, 0);
  let avgVadeMs: number | null = null;
  if (totalTutar > 0) {
    avgVadeMs = stats.reduce((s, c) => s + c.tutar * new Date(c.vadesi).getTime(), 0) / totalTutar;
  }

  return NextResponse.json({ cekler, total, page, pages: Math.ceil(total / limit), totalTutar, avgVadeMs });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const { customerId, supplierId, borclu, islem, aciklama, islemTarihi, vadesi, tutar, currency, seriNo, bankasi, customerAmount, customerCurrency } = body;

  const cek = await (prisma.cek.create as any)({
    data: {
      companyId: user.companyId,
      customerId: customerId || null,
      supplierId: supplierId || null,
      borclu,
      islem: islem || 'Müşteriden Alınan Çek Kaydı',
      aciklama: aciklama || null,
      islemTarihi: parseDateInputOrNow(islemTarihi),
      vadesi: parseDateInput(vadesi) ?? new Date(),
      tutar: parseFloat(tutar),
      currency: currency || 'TRY',
      customerAmount: customerAmount != null ? parseFloat(customerAmount) : null,
      customerCurrency: customerCurrency || null,
      seriNo: seriNo || null,
      bankasi: bankasi || null,
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'Cek',
    entityId: (cek as any).id,
    detail: `Çek kaydedildi — ${borclu} ${tutar} ${currency || 'TRY'}`,
    meta: { tutar, currency, borclu, seriNo },
    ip: getIp(req),
  });
  return NextResponse.json(cek, { status: 201 });
}
