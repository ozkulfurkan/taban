import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const cats = await (prisma as any).supplierCategory.findMany({
    where: { companyId: user.companyId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(cats);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'İsim zorunlu' }, { status: 400 });

  try {
    const cat = await (prisma as any).supplierCategory.upsert({
      where: { companyId_name: { companyId: user.companyId, name: name.trim() } },
      update: {},
      create: { companyId: user.companyId, name: name.trim() },
    });
    return NextResponse.json(cat);
  } catch {
    return NextResponse.json({ error: 'Kategori oluşturulamadı' }, { status: 500 });
  }
}
