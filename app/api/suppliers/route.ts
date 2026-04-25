import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const suppliers = await prisma.supplier.findMany({
    where: { companyId: user.companyId },
    include: { _count: { select: { purchases: true } } },
    orderBy: { name: 'asc' },
  });

  const result = await Promise.all(suppliers.map(async (s) => {
    const [purchases, payments] = await Promise.all([
      prisma.purchase.findMany({
        where: { supplierId: s.id },
        select: { total: true },
      }),
      prisma.payment.findMany({
        where: { supplierId: s.id, type: 'PAID' },
        select: { amount: true, method: true, notes: true },
      }),
    ]);

    const totalPurchased = purchases.reduce((s, p) => s + p.total, 0);

    let balanceDelta = 0;
    let totalPaid = 0;
    for (const p of payments) {
      if (p.method === 'Borç Fişi' || (p.method === 'Bakiye Düzeltme' && p.notes?.startsWith('+'))) {
        balanceDelta += p.amount;
      } else {
        balanceDelta -= p.amount;
        totalPaid += p.amount;
      }
    }
    const balance = totalPurchased + balanceDelta;

    return {
      ...s,
      totalPurchased,
      totalPaid,
      balance,
    };
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  try {
    const supplier = await prisma.supplier.create({
      data: {
        companyId: user.companyId,
        name: body.name,
        taxId: body.taxId || null,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        currency: body.currency || 'USD',
        notes: body.notes || null,
      },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'CREATE',
      entity: 'Supplier',
      entityId: supplier.id,
      detail: `Tedarikçi oluşturuldu — ${supplier.name}`,
      ip: getIp(req),
    });
    return NextResponse.json(supplier);
  } catch (err: any) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'ERROR',
      entity: 'Supplier',
      detail: `Tedarikçi oluşturulamadı: ${err?.message ?? 'Bilinmeyen hata'}`,
      meta: { input: { name: body.name } },
      ip: getIp(req),
    });
    return NextResponse.json({ error: 'Tedarikçi oluşturulamadı' }, { status: 500 });
  }
}
