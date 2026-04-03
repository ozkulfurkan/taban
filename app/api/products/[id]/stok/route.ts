import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// POST: ürün stokunu güncelle (delta: pozitif = ekle, negatif = çıkar)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const product = await prisma.product.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { delta } = await req.json();
  const d = parseFloat(delta) || 0;
  if (d === 0) return NextResponse.json({ error: 'delta gerekli' }, { status: 400 });

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: { stock: { increment: d } },
  });

  return NextResponse.json({ stock: updated.stock });
}
