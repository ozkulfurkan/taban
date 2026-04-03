export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession, unauthorized, badRequest } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') ?? '';

    const where: any = {};
    if (session.user.role !== 'ADMIN') {
      where.companyId = session.user.companyId;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const materials = await prisma.material.findMany({
      where,
      include: {
        priceHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
        variants: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(materials);
  } catch (error: any) {
    console.error('GET materials error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();
    if (session.user.role === 'VIEWER') return NextResponse.json({ error: 'No permission' }, { status: 403 });

    const body = await req.json();
    const { name, supplier, pricePerKg, currency, description } = body ?? {};

    if (!name || pricePerKg == null) return badRequest('Name and price required');

    const companyId = session.user.companyId;
    if (!companyId) return badRequest('No company assigned');

    const material = await prisma.material.create({
      data: {
        companyId,
        name,
        supplier: supplier ?? '',
        pricePerKg: parseFloat(pricePerKg),
        currency: currency ?? 'USD',
        description: description ?? '',
      },
    });

    await prisma.priceHistory.create({
      data: {
        materialId: material.id,
        pricePerKg: material.pricePerKg,
        currency: material.currency,
      },
    });

    return NextResponse.json(material, { status: 201 });
  } catch (error: any) {
    console.error('POST materials error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
