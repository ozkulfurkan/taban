import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const { searchParams } = new URL(req.url);
  const durum = searchParams.get('durum');
  const customerId = searchParams.get('customerId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 50;

  const where: any = { companyId: user.companyId };
  if (durum) where.durum = durum;
  if (customerId) where.customerId = customerId;

  const [cekler, total] = await Promise.all([
    prisma.cek.findMany({
      where,
      include: { customer: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } },
      orderBy: { vadesi: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.cek.count({ where }),
  ]);

  return NextResponse.json({ cekler, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const body = await req.json();
  const { customerId, supplierId, borclu, islem, aciklama, islemTarihi, vadesi, tutar, currency, seriNo, bankasi } = body;

  const cek = await prisma.cek.create({
    data: {
      companyId: user.companyId,
      customerId: customerId || null,
      supplierId: supplierId || null,
      borclu,
      islem: islem || 'Müşteriden Alınan Çek Kaydı',
      aciklama: aciklama || null,
      islemTarihi: new Date(islemTarihi || Date.now()),
      vadesi: new Date(vadesi),
      tutar: parseFloat(tutar),
      currency: currency || 'TRY',
      seriNo: seriNo || null,
      bankasi: bankasi || null,
    },
  });

  return NextResponse.json(cek, { status: 201 });
}
