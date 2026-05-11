import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

const DEFAULTS = {
  labelWidth: 100, labelHeight: 60, labelPadding: 3,
  companyFontSize: 7, productFontSize: 9, detailsFontSize: 6,
  barcodeFontSize: 6, dateFontSize: 6, barcodeHeight: 35,
  defaultQtyPerPack: '1', defaultQtyUnit: 'adet',
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json(DEFAULTS);

  const settings = await (prisma as any).barcodeSettings.findUnique({
    where: { companyId: user.companyId },
  });

  return NextResponse.json(settings ?? DEFAULTS);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!['ADMIN', 'COMPANY_OWNER'].includes(user.role)) {
    return NextResponse.json({ error: 'No permission' }, { status: 403 });
  }
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const n = (k: string, def: number) => Number(body[k]) || def;

  const data = {
    labelWidth: n('labelWidth', 100),
    labelHeight: n('labelHeight', 60),
    labelPadding: n('labelPadding', 3),
    companyFontSize: n('companyFontSize', 7),
    productFontSize: n('productFontSize', 9),
    detailsFontSize: n('detailsFontSize', 6),
    barcodeFontSize: n('barcodeFontSize', 6),
    dateFontSize: n('dateFontSize', 6),
    barcodeHeight: n('barcodeHeight', 35),
    defaultQtyPerPack: String(body.defaultQtyPerPack ?? '1') || '1',
    defaultQtyUnit: String(body.defaultQtyUnit ?? 'adet') || 'adet',
  };

  const settings = await (prisma as any).barcodeSettings.upsert({
    where: { companyId: user.companyId },
    update: data,
    create: { companyId: user.companyId, ...data },
  });

  return NextResponse.json(settings);
}
