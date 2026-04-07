export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ ok: false });

  const pc = await prisma.portalCustomer.findUnique({ where: { emailVerifyToken: token } });
  if (!pc) return NextResponse.json({ ok: false });

  await prisma.portalCustomer.update({
    where: { id: pc.id },
    data: { emailVerified: true, emailVerifyToken: null },
  });

  return NextResponse.json({ ok: true });
}
