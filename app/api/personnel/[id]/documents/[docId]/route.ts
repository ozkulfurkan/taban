import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

type Params = { params: { id: string; docId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const doc = await (prisma.personnelDocument as any).findFirst({
    where: { id: params.docId, employeeId: params.id, companyId: user.companyId },
  });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new NextResponse(doc.data, {
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.name)}"`,
      'Content-Length': String(doc.size),
    },
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const doc = await (prisma.personnelDocument as any).findFirst({
    where: { id: params.docId, employeeId: params.id, companyId: user.companyId },
  });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await (prisma.personnelDocument as any).delete({ where: { id: params.docId } });
  return NextResponse.json({ ok: true });
}
