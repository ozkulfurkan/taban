import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const category = await prisma.productCategory.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: { _count: { select: { products: true } } },
  });
  if (!category) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  if (category._count.products > 0) {
    return NextResponse.json({ error: 'Bu kategoride ürün bulunuyor, önce ürünleri taşıyın' }, { status: 409 });
  }

  await prisma.productCategory.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Ad zorunludur' }, { status: 400 });

  const category = await prisma.productCategory.update({
    where: { id: params.id },
    data: { name: name.trim() },
  });
  return NextResponse.json(category);
}
