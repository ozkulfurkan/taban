export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isLimited, recordAttempt } from '@/lib/login-throttle';
import { normalizeCode } from '@/lib/network';
import { rejectForeignRefs } from '@/lib/tenant';
import { logAction, getIp } from '@/lib/audit-logger';

const CODE_TRIES = 10; // firma başına 15 dakikada hatalı kod denemesi

async function staff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  return user?.companyId && user.type !== 'portal' ? user : null;
}

// Firmanın bağlantıları: alıcı olarak (tedarikçilerim) ve satıcı olarak (müşteri firmalar, bekleyen istekler)
export async function GET(req: NextRequest) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supplierId = req.nextUrl.searchParams.get('supplierId');

  const [asBuyer, asSeller] = await Promise.all([
    prisma.companyLink.findMany({
      where: { buyerCompanyId: user.companyId, ...(supplierId ? { buyerSupplierId: supplierId } : {}) },
      select: {
        id: true, status: true, createdAt: true, respondedAt: true, buyerSupplierId: true,
        sellerCompany: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    supplierId ? Promise.resolve([]) : prisma.companyLink.findMany({
      where: { sellerCompanyId: user.companyId, status: { in: ['PENDING', 'ACTIVE'] } },
      select: {
        id: true, status: true, createdAt: true, respondedAt: true, sellerCustomerId: true,
        buyerCompany: { select: { name: true, taxId: true, phone: true, address: true } },
        sellerCustomer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return NextResponse.json({ asBuyer, asSeller });
}

// Firma koduyla bağlantı isteği: satıcı onaylayınca sipariş verilebilir
export async function POST(req: NextRequest) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const throttleKey = `link-code:${user.companyId}`;
  if (await isLimited(throttleKey, CODE_TRIES)) {
    return NextResponse.json({ error: 'Çok fazla hatalı kod denendi. Biraz sonra tekrar deneyin.' }, { status: 429 });
  }
  const code = normalizeCode(body?.code);
  const seller = code
    ? await prisma.company.findUnique({ where: { code }, select: { id: true, name: true, taxId: true, phone: true, address: true } })
    : null;
  if (!seller) {
    await recordAttempt(throttleKey);
    return NextResponse.json({ error: 'Bu koda ait SoleCost firması bulunamadı' }, { status: 404 });
  }
  if (seller.id === user.companyId) return NextResponse.json({ error: 'Kendi firmanızı tedarikçi olarak ekleyemezsiniz' }, { status: 400 });

  const supplierId: string | null = typeof body?.supplierId === 'string' ? body.supplierId : null;
  if (supplierId) {
    const foreign = await rejectForeignRefs(user.companyId, { supplier: supplierId });
    if (foreign) return foreign;
  }

  const existing = await prisma.companyLink.findUnique({
    where: { buyerCompanyId_sellerCompanyId: { buyerCompanyId: user.companyId, sellerCompanyId: seller.id } },
  });
  if (existing?.status === 'ACTIVE' || existing?.status === 'PENDING') {
    return NextResponse.json({ link: { id: existing.id, status: existing.status, supplierId: existing.buyerSupplierId, sellerName: seller.name } });
  }

  // Tedarikçi kaydı: verilen kayıt, yoksa aynı vergi no / ad ile mevcut kayıt, yoksa yeni kayıt
  let targetSupplierId = supplierId ?? existing?.buyerSupplierId ?? null;
  if (!targetSupplierId) {
    const match = await prisma.supplier.findFirst({
      where: {
        companyId: user.companyId,
        OR: [...(seller.taxId ? [{ taxId: seller.taxId }] : []), { name: { equals: seller.name, mode: 'insensitive' as const } }],
      },
      select: { id: true },
    });
    targetSupplierId = match?.id ?? (await prisma.supplier.create({
      data: { companyId: user.companyId, name: seller.name, taxId: seller.taxId, phone: seller.phone, address: seller.address, currency: 'TRY' },
      select: { id: true },
    })).id;
  }

  const data = {
    buyerSupplierId: targetSupplierId, status: 'PENDING' as const, requestedById: user.id,
    approvedById: null, respondedAt: null, createdAt: new Date(),
  };
  const link = existing
    ? await prisma.companyLink.update({ where: { id: existing.id }, data })
    : await prisma.companyLink.create({ data: { ...data, buyerCompanyId: user.companyId, sellerCompanyId: seller.id } });

  await logAction({
    companyId: user.companyId, userId: user.id, userName: user.name, action: 'CREATE', entity: 'CompanyLink',
    entityId: link.id, detail: `Firma bağlantı isteği gönderildi — ${seller.name}`, ip: getIp(req),
  });
  return NextResponse.json(
    { link: { id: link.id, status: link.status, supplierId: targetSupplierId, sellerName: seller.name } },
    { status: 201 },
  );
}
