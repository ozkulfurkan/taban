export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MAX_LOGO_BYTES, decodeImage, toDataUrl } from '@/lib/product-image';
import { getAuthSession, unauthorized } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();

    const companyId = session.user.companyId;
    if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(company);
  } catch (error: any) {
    console.error('GET company error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();
    if (!['ADMIN', 'COMPANY_OWNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No permission' }, { status: 403 });
    }

    const companyId = session.user.companyId;
    if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

    const body = await req.json();
    const { name, address, taxId, phone, bankInfo, logoUrl, usdToTry, eurToTry, vatRate, companyType, dailySummaryEmail } = body ?? {};

    // Logo: yalnızca gerçek JPEG/PNG/WebP (tür içerikten okunur); SVG ve dış adres kabul edilmez
    let logo: string | null | undefined = undefined;
    if (logoUrl !== undefined) {
      if (logoUrl === null || logoUrl === '') logo = null;
      else if (logoUrl === (await prisma.company.findUnique({ where: { id: companyId }, select: { logoUrl: true } }))?.logoUrl) {
        logo = undefined; // değişmeyen (eski) logo yeniden doğrulanmaz; diğer alanlar kaydedilebilsin
      } else {
        const img = decodeImage(logoUrl, MAX_LOGO_BYTES);
        if ('error' in img) return NextResponse.json({ error: img.error }, { status: 400 });
        logo = toDataUrl(img.mime, img.bytes);
      }
    }

    const VALID_COMPANY_TYPES = ['SOLE_MANUFACTURER', 'MATERIAL_SUPPLIER'];
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(taxId !== undefined ? { taxId } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(bankInfo !== undefined ? { bankInfo } : {}),
        ...(logo !== undefined ? { logoUrl: logo } : {}),
        ...(usdToTry !== undefined ? { usdToTry: parseFloat(usdToTry) || 1 } : {}),
        ...(eurToTry !== undefined ? { eurToTry: parseFloat(eurToTry) || 1 } : {}),
        ...(vatRate !== undefined ? { vatRate: parseFloat(vatRate) || 0 } : {}),
        ...(typeof dailySummaryEmail === 'boolean' ? { dailySummaryEmail } : {}),
        ...(companyType !== undefined && VALID_COMPANY_TYPES.includes(companyType) ? { companyType } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT company error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
