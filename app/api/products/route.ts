import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { rejectForeignRefs } from '@/lib/tenant';
import { isRestricted } from '@/lib/access';

// ?list=1: liste ekranları için hafif yanıt (reçete parçaları olmadan)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  // Kısıtlı profil (nakliyeci, usta): yalnız ad/kod/birim; fiyat ve maliyet yok
  if (isRestricted(user)) {
    return NextResponse.json(await prisma.product.findMany({
      where: { companyId: user.companyId }, select: { id: true, name: true, code: true, unit: true, sizes: true }, orderBy: { name: 'asc' },
    }));
  }

  const products = await prisma.product.findMany({
    where: { companyId: user.companyId },
    include: req.nextUrl.searchParams.get('list') === '1' ? {
      _count: { select: { portalCustomers: true } },
      category: { select: { id: true, name: true } },
    } : {
      parts: {
        include: {
          material: {
            select: {
              id: true,
              name: true,
              stock: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { portalCustomers: true } },
      category: { select: { id: true, name: true } },
    },
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
  const foreign = await rejectForeignRefs(user.companyId, { productCategory: body?.categoryId });
  if (foreign) return foreign;
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
      categoryId: body.categoryId || null,
    },
  });
  return NextResponse.json(product);
}
