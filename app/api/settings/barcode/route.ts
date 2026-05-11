import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ labelWidth: 100, labelHeight: 100 });

  const settings = await (prisma as any).barcodeSettings.findUnique({
    where: { companyId: user.companyId },
  });

  return NextResponse.json(settings ?? { labelWidth: 100, labelHeight: 100 });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!['ADMIN', 'COMPANY_OWNER'].includes(user.role)) {
    return NextResponse.json({ error: 'No permission' }, { status: 403 });
  }
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const { labelWidth, labelHeight } = await req.json();

  const settings = await (prisma as any).barcodeSettings.upsert({
    where: { companyId: user.companyId },
    update: { labelWidth: Number(labelWidth) || 100, labelHeight: Number(labelHeight) || 100 },
    create: { companyId: user.companyId, labelWidth: Number(labelWidth) || 100, labelHeight: Number(labelHeight) || 100 },
  });

  return NextResponse.json(settings);
}
