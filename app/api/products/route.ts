import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const products = await prisma.product.findMany({
    where: { companyId: user.companyId },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const product = await prisma.product.create({
    data: {
      companyId: user.companyId,
      name: body.name,
      code: body.code || null,
      description: body.description || null,
      unit: body.unit || 'çift',
      unitPrice: parseFloat(body.unitPrice) || 0,
      currency: body.currency || 'USD',
      stock: parseFloat(body.stock) || 0,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(product);
}
