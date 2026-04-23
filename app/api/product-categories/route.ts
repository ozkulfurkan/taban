import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const categories = await prisma.productCategory.findMany({
    where: { companyId: user.companyId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Ad zorunludur' }, { status: 400 });

  const existing = await prisma.productCategory.findUnique({
    where: { companyId_name: { companyId: user.companyId, name: name.trim() } },
  });
  if (existing) return NextResponse.json({ error: 'Bu kategori zaten mevcut' }, { status: 409 });

  const category = await prisma.productCategory.create({
    data: { name: name.trim(), companyId: user.companyId },
  });

  return NextResponse.json(category, { status: 201 });
}
