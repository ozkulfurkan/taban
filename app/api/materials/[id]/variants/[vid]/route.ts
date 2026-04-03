import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

async function getVariant(materialId: string, vid: string, companyId: string) {
  return prisma.materialVariant.findFirst({
    where: {
      id: vid,
      materialId,
      material: { companyId },
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; vid: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const variant = await getVariant(params.id, params.vid, user.companyId);
  if (!variant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { colorName, code, stock } = body;

  const updated = await prisma.materialVariant.update({
    where: { id: params.vid },
    data: {
      colorName: colorName?.trim() ?? variant.colorName,
      code: code !== undefined ? (code?.trim() || null) : variant.code,
      stock: stock !== undefined ? parseFloat(stock) || 0 : variant.stock,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; vid: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const variant = await getVariant(params.id, params.vid, user.companyId);
  if (!variant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.materialVariant.delete({ where: { id: params.vid } });
  return NextResponse.json({ ok: true });
}
