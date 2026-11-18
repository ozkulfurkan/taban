import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';
import { rejectForeignRefs } from '@/lib/tenant';
import { customerBalance } from '@/lib/money';
import { partyInputError } from '@/lib/party-input';
import { idsMatching, findSameName } from '@/lib/search-db';

const LIMIT = 50;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ customers: [], total: 0, page: 1, totalPages: 0 });

  const { searchParams } = req.nextUrl;

  // Lightweight dropdown list: returns all customers as [{ id, name }] without pagination/balance
  if (searchParams.get('minimal') === 'true') {
    const all = await (prisma as any).customer.findMany({
      where: { companyId: user.companyId, status: { not: 1 } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(all);
  }

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const search = searchParams.get('search')?.trim() ?? '';

  const where: any = { companyId: user.companyId, status: { not: 1 } };
  if (search) {
    // Ad ve e-postada Türkçe karakterden bağımsız arama ("isik" → "IŞIK")
    const ids = await idsMatching('Customer', user.companyId, search);
    where.OR = [
      { id: { in: ids } },
      { phone: { contains: search } },
    ];
  }
  const categoryId = searchParams.get('categoryId');
  if (categoryId) where.categoryId = categoryId;

  const [customers, total] = await Promise.all([
    (prisma as any).customer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
      include: { category: { select: { id: true, name: true } } },
    }),
    (prisma as any).customer.count({ where }),
  ]);

  const ids = customers.map((c: any) => c.id);

  // Batch: fatura + ödeme + çek — 3 sorguda (N+1 yok)
  const [allInvoices, allPayments, allCekler] = ids.length > 0
    ? await Promise.all([
        prisma.invoice.findMany({
          where: { customerId: { in: ids } },
          select: { customerId: true, total: true, isReturn: true },
        }),
        prisma.payment.findMany({
          where: { customerId: { in: ids }, type: 'RECEIVED' },
          select: { customerId: true, amount: true, method: true, notes: true },
        }),
        prisma.cek.findMany({
          where: { customerId: { in: ids }, islem: 'Müşteriden Alınan Çek Kaydı' },
          select: { customerId: true, tutar: true, customerAmount: true },
        }),
      ])
    : [[], [], []];

  // Group by customerId
  const invoiceMap = new Map<string, typeof allInvoices>();
  for (const inv of allInvoices) {
    const list = invoiceMap.get(inv.customerId) ?? [];
    list.push(inv);
    invoiceMap.set(inv.customerId, list);
  }
  const paymentMap = new Map<string, typeof allPayments>();
  for (const pmt of allPayments) {
    if (!pmt.customerId) continue;
    const list = paymentMap.get(pmt.customerId) ?? [];
    list.push(pmt);
    paymentMap.set(pmt.customerId, list);
  }
  const cekMap = new Map<string, typeof allCekler>();
  for (const cek of allCekler) {
    if (!cek.customerId) continue;
    const list = cekMap.get(cek.customerId) ?? [];
    list.push(cek);
    cekMap.set(cek.customerId, list);
  }

  const result = customers.map((c: any) => {
    const invoices = invoiceMap.get(c.id) ?? [];
    const payments = paymentMap.get(c.id) ?? [];
    const cekler = cekMap.get(c.id) ?? [];

    const { totalInvoiced, totalPaid, balance } = customerBalance(invoices, payments as any, cekler as any);
    return { ...c, totalInvoiced, totalPaid, balance };
  });

  return NextResponse.json({
    customers: result,
    total,
    page,
    totalPages: Math.ceil(total / LIMIT),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const inputError = partyInputError(body);
  if (inputError) return NextResponse.json({ error: inputError }, { status: 400 });
  body.name = body.name.trim();
  // Aynı adlı kayıt varsa önce kullanıcıya sor (engellemez; onaylanırsa allowDuplicate ile gelir)
  if (!body.allowDuplicate) {
    const existing = await findSameName('Customer', user.companyId, body.name);
    if (existing) {
      return NextResponse.json({
        error: `"${existing.name}" adında bir müşteri zaten var.`,
        code: 'DUPLICATE_NAME',
        existing,
      }, { status: 409 });
    }
  }
  const foreign = await rejectForeignRefs(user.companyId, { customerCategory: body?.categoryId });
  if (foreign) return foreign;
  try {
    const customer = await (prisma as any).customer.create({
      data: {
        companyId: user.companyId,
        name: body.name,
        taxId: body.taxId || null,
        taxOffice: body.taxOffice || null,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        currency: body.currency || 'TRY',
        notes: body.notes || null,
        categoryId: body.categoryId || null,
      },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'CREATE',
      entity: 'Customer',
      entityId: customer.id,
      detail: `Müşteri oluşturuldu — ${customer.name}`,
      ip: getIp(req),
    });
    return NextResponse.json(customer);
  } catch (err: any) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'ERROR',
      entity: 'Customer',
      detail: `Müşteri oluşturulamadı: ${err?.message ?? 'Bilinmeyen hata'}`,
      meta: { input: { name: body.name } },
      ip: getIp(req),
    });
    return NextResponse.json({ error: 'Müşteri oluşturulamadı' }, { status: 500 });
  }
}
