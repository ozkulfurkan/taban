import { NextRequest, NextResponse } from 'next/server';
import { duplicateGuarded } from '@/lib/request-dedup';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';
import { rejectForeignRefs } from '@/lib/tenant';
import { createSaleInvoice } from '@/lib/sale-invoice';
import { pageParams, pageResult, dateRange } from '@/lib/pagination';
import { idsMatching } from '@/lib/search-db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const customerId = searchParams.get('customerId');
  const q = searchParams.get('q')?.trim();
  const type = searchParams.get('type'); // 'sale' | 'return'
  const date = dateRange(searchParams);

  const where: any = {
    companyId: user.companyId,
    ...(status ? { status: status as any } : {}),
    ...(customerId ? { customerId } : {}),
    ...(type === 'sale' ? { isReturn: false } : type === 'return' ? { isReturn: true } : {}),
    ...(date ? { date } : {}),
    ...(q ? {
      OR: [
        { invoiceNo: { contains: q, mode: 'insensitive' } },
        { customerId: { in: await idsMatching('Customer', user.companyId, q) } },
      ],
    } : {}),
  };
  const include = {
    customer: { select: { id: true, name: true } },
    items: true,
    createdBy: { select: { name: true } },
    soleOrder: { select: { orderNo: true } },
  };
  const orderBy = [{ date: 'desc' as const }, { createdAt: 'desc' as const }];

  // Sayfalı kullanım (?page=): { items, total, page, limit, totalPages }
  if (searchParams.has('page')) {
    const { page, limit, skip, take } = pageParams(searchParams);
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({ where, include, orderBy, skip, take }),
      prisma.invoice.count({ where }),
    ]);
    return NextResponse.json(pageResult(items, total, page, limit));
  }

  // Eski kullanım (dizi): Vercel yanıt sınırını aşmamak için en fazla 1000 kayıt
  const invoices = await prisma.invoice.findMany({ where, include, orderBy, take: 1000 });
  return NextResponse.json(invoices);
}

async function create(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const { items = [], isReturn = false, ...rest } = body;

  if (!rest.customerId) return NextResponse.json({ error: 'Müşteri seçilmedi' }, { status: 400 });
  const foreign = await rejectForeignRefs(user.companyId, {
    customer: rest.customerId,
    product: (items as any[]).map(i => i?.productId),
  });
  if (foreign) return foreign;

  try {
  const r = await createSaleInvoice(user.companyId, user.id ?? null, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const invoice = r.invoice;

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: isReturn ? 'ReturnInvoice' : 'Invoice',
    entityId: invoice.id,
    detail: `${isReturn ? 'İade faturası' : 'Fatura'} oluşturuldu — ${invoice.invoiceNo}`,
    meta: { total: invoice.total, currency: invoice.currency },
    ip: getIp(req),
  });
  return NextResponse.json({ ...invoice, stockWarnings: r.negativeStock });
  } catch (err: any) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'ERROR',
      entity: isReturn ? 'ReturnInvoice' : 'Invoice',
      detail: `${isReturn ? 'İade faturası' : 'Fatura'} oluşturulamadı: ${err?.message ?? 'Bilinmeyen hata'}`,
      ip: getIp(req),
    });
    return NextResponse.json({ error: 'Fatura oluşturulamadı' }, { status: 500 });
  }
}

// Mükerrer kayıt koruması: aynı içerikli istek kısa süre içinde ikinci kez işlenmez (çift tıklama, iki sekme)
export const POST = duplicateGuarded('invoices', create);
