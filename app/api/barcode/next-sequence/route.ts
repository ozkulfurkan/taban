import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

function todayKey(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${mm}${dd}-${yy}`;
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const count = Math.max(1, parseInt(req.nextUrl.searchParams.get('count') ?? '1', 10));
  const date = todayKey();

  // Atomik: mevcut lastNumber'ı oku, N kadar ilerlet
  const result = await prisma.$transaction(async (tx: any) => {
    const existing = await tx.barcodeSequence.findUnique({
      where: { companyId_date: { companyId: user.companyId, date } },
    });

    const from = (existing?.lastNumber ?? 0) + 1;
    const to = from + count - 1;

    await tx.barcodeSequence.upsert({
      where: { companyId_date: { companyId: user.companyId, date } },
      update: { lastNumber: to },
      create: { companyId: user.companyId, date, lastNumber: to },
    });

    return { from, to };
  });

  const numbers = Array.from({ length: count }, (_, i) => `${date}-${pad3(result.from + i)}`);

  return NextResponse.json({ date, from: result.from, to: result.to, numbers });
}
