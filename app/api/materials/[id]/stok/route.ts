import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// POST: stok ekle veya azalt (delta: pozitif = ekle, negatif = azalt)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const material = await prisma.material.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { delta } = await req.json() as { delta: number };
  if (typeof delta !== 'number') return NextResponse.json({ error: 'delta gerekli' }, { status: 400 });

  const updated = await prisma.material.update({
    where: { id: params.id },
    data: { stock: { increment: delta } },
  });

  return NextResponse.json({ stock: updated.stock });
}
