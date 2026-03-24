import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const cek = await prisma.cek.updateMany({
    where: { id: params.id, companyId: user.companyId },
    data: body,
  });

  return NextResponse.json(cek);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  await prisma.cek.deleteMany({ where: { id: params.id, companyId: user.companyId } });
  return NextResponse.json({ ok: true });
}
