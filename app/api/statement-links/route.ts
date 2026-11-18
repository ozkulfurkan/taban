import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';
import { rejectForeignRefs } from '@/lib/tenant';
import { newShareToken, shareUrl } from '@/lib/statement-share';

// Hesap ekstresi paylaşım linki: cari başına tek aktif link.
//  GET    ?customerId= | ?supplierId=          aktif link (yoksa null)
//  POST   { customerId | supplierId, regenerate? }  aktif linki döner ya da yeniler
//  DELETE ?customerId= | ?supplierId=          linki kapatır

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

type Party = { customerId: string } | { supplierId: string };

async function context(req: NextRequest, src: Record<string, unknown>) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: err('Unauthorized', 401) };
  const user = session.user as any;
  if (!user.companyId) return { error: err('No company') };
  const customerId = typeof src.customerId === 'string' && src.customerId ? src.customerId : null;
  const supplierId = typeof src.supplierId === 'string' && src.supplierId ? src.supplierId : null;
  if (!!customerId === !!supplierId) return { error: err('Müşteri ya da tedarikçi seçin') };
  const foreign = await rejectForeignRefs(user.companyId, { customer: customerId, supplier: supplierId });
  if (foreign) return { error: foreign };
  const party: Party = customerId ? { customerId } : { supplierId: supplierId! };
  const where = { companyId: user.companyId as string, ...party, revokedAt: null };
  return { user, party, where };
}

function present(link: { token: string; createdAt: Date; viewCount: number; lastViewedAt: Date | null } | null) {
  if (!link) return { link: null };
  return {
    link: {
      url: shareUrl(link.token),
      createdAt: link.createdAt,
      viewCount: link.viewCount,
      lastViewedAt: link.lastViewedAt,
    },
  };
}

async function partyName(party: Party) {
  if ('customerId' in party) {
    return (await prisma.customer.findUnique({ where: { id: party.customerId }, select: { name: true } }))?.name ?? '';
  }
  return (await prisma.supplier.findUnique({ where: { id: party.supplierId }, select: { name: true } }))?.name ?? '';
}

export async function GET(req: NextRequest) {
  const ctx = await context(req, Object.fromEntries(new URL(req.url).searchParams));
  if ('error' in ctx) return ctx.error;
  const link = await prisma.statementShareLink.findFirst({ where: ctx.where, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(present(link));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ctx = await context(req, body);
  if ('error' in ctx) return ctx.error;
  const { user, party, where } = ctx;
  const regenerate = body.regenerate === true;

  const { link, created } = await prisma.$transaction(async tx => {
    const active = await tx.statementShareLink.findFirst({ where, orderBy: { createdAt: 'desc' } });
    if (active && !regenerate) return { link: active, created: false };
    await tx.statementShareLink.updateMany({ where, data: { revokedAt: new Date() } });
    const link = await tx.statementShareLink.create({
      data: { companyId: user.companyId, ...party, token: newShareToken(), createdById: user.id ?? null },
    });
    return { link, created: true };
  });

  if (created) {
    const name = await partyName(party);
    await logAction({
      companyId: user.companyId, userId: user.id, userName: user.name,
      action: regenerate ? 'UPDATE' : 'CREATE', entity: 'StatementShareLink', entityId: link.id,
      detail: `Ekstre linki ${regenerate ? 'yenilendi' : 'oluşturuldu'} — ${name}`, meta: party, ip: getIp(req),
    });
  }
  return NextResponse.json(present(link), { status: created ? 201 : 200 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await context(req, Object.fromEntries(new URL(req.url).searchParams));
  if ('error' in ctx) return ctx.error;
  const { user, party, where } = ctx;
  const { count } = await prisma.statementShareLink.updateMany({ where, data: { revokedAt: new Date() } });
  if (count) {
    await logAction({
      companyId: user.companyId, userId: user.id, userName: user.name,
      action: 'DELETE', entity: 'StatementShareLink',
      detail: `Ekstre linki kapatıldı — ${await partyName(party)}`, meta: party, ip: getIp(req),
    });
  }
  return NextResponse.json({ ok: true, closed: count });
}
