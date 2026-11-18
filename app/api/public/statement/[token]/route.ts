import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loadCustomerStatement, loadSupplierStatement, statementRange } from '@/lib/statement';
import { isTokenShaped } from '@/lib/statement-share';
import { clientIp, isLimited, recordAttempt } from '@/lib/login-throttle';

// Link ile paylaşılan hesap ekstresi (oturum gerektirmez).
// Firma ve cari yalnızca tokendan bulunur; istekten kimlik alınmaz.
// Yanıtta iç kimlikler yer almaz, sadece ekstrede görünen alanlar döner.

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const INVALID_PER_IP = 30; // 15 dakikada geçersiz link denemesi

const notFound = () =>
  NextResponse.json({ error: 'Bu link geçersiz veya yenilenmiş.' }, { status: 404, headers: HEADERS });

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const ipKey = `statement-ip:${clientIp(req.headers)}`;
  if (await isLimited(ipKey, INVALID_PER_IP)) {
    return NextResponse.json({ error: 'Çok fazla deneme. Lütfen biraz sonra tekrar deneyin.' }, { status: 429, headers: HEADERS });
  }

  const link = isTokenShaped(params.token)
    ? await prisma.statementShareLink.findUnique({
        where: { token: params.token },
        include: { company: { select: { name: true, logoUrl: true, phone: true, address: true, taxId: true } } },
      })
    : null;
  if (!link || link.revokedAt) {
    await recordAttempt(ipKey);
    return notFound();
  }

  const { searchParams } = new URL(req.url);
  const { from, to } = statementRange(searchParams.get('from'), searchParams.get('to'));
  const company = link.company;

  let body: Record<string, unknown> | null = null;
  if (link.customerId) {
    const d = await loadCustomerStatement(link.companyId, link.customerId, from, to);
    if (d) {
      body = {
        kind: 'customer',
        party: { name: d.customer.name, currency: d.customer.currency },
        invoices: d.invoices.map((i, n) => ({
          id: `f${n}`, invoiceNo: i.invoiceNo, date: i.date, dueDate: i.dueDate, total: i.total, currency: i.currency,
          isReturn: i.isReturn, notes: i.notes, createdAt: i.createdAt,
          items: i.items.map(it => ({
            description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total,
            product: it.product?.code ? { code: it.product.code } : null,
          })),
        })),
        payments: d.payments.map((p, n) => publicPayment(p, n)),
        cekler: d.cekler.map((c, n) => ({
          id: `c${n}`, islem: c.islem, borclu: c.borclu, bankasi: c.bankasi, seriNo: c.seriNo,
          islemTarihi: c.islemTarihi, vadesi: c.vadesi, tutar: c.tutar, currency: c.currency,
          customerAmount: (c as any).customerAmount ?? null, createdAt: c.createdAt,
        })),
      };
    }
  } else if (link.supplierId) {
    const d = await loadSupplierStatement(link.companyId, link.supplierId, from, to, { items: true });
    if (d) {
      body = {
        kind: 'supplier',
        party: { name: d.supplier.name, currency: d.supplier.currency },
        purchases: d.purchases.map((p: any, n: number) => ({
          id: `a${n}`, invoiceNo: p.invoiceNo, date: p.date, total: p.total, currency: p.currency,
          isReturn: p.isReturn, notes: p.notes, createdAt: p.createdAt, items: p.items,
        })),
        payments: d.payments.map((p, n) => publicPayment(p, n)),
      };
    }
  }
  if (!body) return notFound();

  await prisma.statementShareLink
    .update({ where: { id: link.id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() } })
    .catch(() => {});

  return NextResponse.json(
    {
      ...body,
      company: { name: company.name, logoUrl: company.logoUrl, phone: company.phone, address: company.address, taxId: company.taxId },
      from: from.toISOString(),
      to: to.toISOString(),
    },
    { headers: HEADERS },
  );
}

// Kayıt kimlikleri yerine sıra numarası: satır anahtarı için yeterli, iç kimlik dışarı çıkmaz
function publicPayment(p: any, n: number) {
  return { id: `p${n}`, date: p.date, amount: p.amount, currency: p.currency, method: p.method, notes: p.notes, createdAt: p.createdAt };
}
