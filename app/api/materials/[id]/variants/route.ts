import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  // Verify material belongs to company
  const material = await prisma.material.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const variants = await prisma.materialVariant.findMany({
    where: { materialId: params.id },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(variants);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const material = await prisma.material.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { colorName, code, stock } = body;
  if (!colorName?.trim()) return NextResponse.json({ error: 'colorName required' }, { status: 400 });

  const variant = await prisma.materialVariant.create({
    data: {
      materialId: params.id,
      colorName: colorName.trim(),
      code: code?.trim() || null,
      stock: parseFloat(stock) || 0,
    },
  });
  return NextResponse.json(variant, { status: 201 });
}
