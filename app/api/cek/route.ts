import { NextRequest, NextResponse } from 'next/server';
import { duplicateGuarded } from '@/lib/request-dedup';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseDateInputOrNow, parseDateInput } from '@/lib/time';
import { logAction, getIp } from '@/lib/audit-logger';
import { rejectForeignRefs } from '@/lib/tenant';

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
  // Hızlı vade filtreleri: sadece tahsil bekleyen (portföy / bankada) çekler
  const vade = searchParams.get('vade');
  if (vade === 'overdue' || vade === 'week') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today.getTime() + 8 * 86400000);
    if (!durum) where.durum = { in: ['PORTFOY', 'BANKAYA_VERILDI'] };
    where.vadesi = vade === 'overdue' ? { lt: today } : { gte: today, lt: weekEnd };
  }

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
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        bankAccount: { select: { id: true, name: true, currency: true } },
      },
      orderBy: { [sortBy]: sortDir },
      ...(all ? {} : { skip: (page - 1) * limit, take: limit }),
    }),
    prisma.cek.count({ where }),
    prisma.cek.findMany({ where, select: { tutar: true, vadesi: true, currency: true } }),
  ]);

  const totalTutar = stats.reduce((s, c) => s + c.tutar, 0);
  let avgVadeMs: number | null = null;
  if (totalTutar > 0) {
    avgVadeMs = stats.reduce((s, c) => s + c.tutar * new Date(c.vadesi).getTime(), 0) / totalTutar;
  }

  // Döviz bazında toplam ve ortalama vade (farklı dövizler birbirine eklenmez)
  const byCur = new Map<string, { currency: string; count: number; total: number; w: number }>();
  for (const c of stats) {
    const e = byCur.get(c.currency) ?? { currency: c.currency, count: 0, total: 0, w: 0 };
    e.count += 1; e.total += c.tutar; e.w += c.tutar * new Date(c.vadesi).getTime();
    byCur.set(c.currency, e);
  }
  const totals = Array.from(byCur.values())
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map(e => ({ currency: e.currency, count: e.count, total: Math.round(e.total * 100) / 100, avgVadeMs: e.total > 0 ? e.w / e.total : null }));

  return NextResponse.json({ cekler, total, page, pages: Math.ceil(total / limit), totalTutar, avgVadeMs, totals });
}

async function create(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const { customerId, supplierId, borclu, islem, aciklama, islemTarihi, vadesi, tutar, currency, seriNo, bankasi, customerAmount, customerCurrency } = body;
  const foreign = await rejectForeignRefs(user.companyId, { customer: customerId, supplier: supplierId });
  if (foreign) return foreign;

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

// Mükerrer kayıt koruması: aynı içerikli istek kısa süre içinde ikinci kez işlenmez (çift tıklama, iki sekme)
export const POST = duplicateGuarded('cek', create);
