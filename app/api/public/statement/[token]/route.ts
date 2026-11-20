import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { statementRange } from '@/lib/statement';
import { publicStatementBody } from '@/lib/statement-public';
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

  const body = link.customerId
    ? await publicStatementBody(link.companyId, { customerId: link.customerId }, from, to)
    : link.supplierId
      ? await publicStatementBody(link.companyId, { supplierId: link.supplierId }, from, to)
      : null;
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
