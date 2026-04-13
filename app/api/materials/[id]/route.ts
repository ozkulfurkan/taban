export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession, unauthorized } from '@/lib/helpers';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();

    const material = await prisma.material.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
      include: {
        priceHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
        subcontractorStocks: {
          include: { subcontractor: { select: { id: true, name: true } } },
        },
        materialTransfers: {
          orderBy: { transferDate: 'desc' },
          take: 30,
          include: { subcontractor: { select: { id: true, name: true } } },
        },
      },
    });
    if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(material);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();
    if (session.user.role === 'VIEWER') return NextResponse.json({ error: 'No permission' }, { status: 403 });

    const body = await req.json();
    const { name, category, supplier, pricePerKg, currency, description } = body ?? {};

    const existing = await prisma.material.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role !== 'ADMIN' && existing.companyId !== session.user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const newPrice = pricePerKg != null ? parseFloat(pricePerKg) : existing.pricePerKg;
    const newCurrency = currency ?? existing.currency;

    if (newPrice !== existing.pricePerKg || newCurrency !== existing.currency) {
      await prisma.priceHistory.create({
        data: { materialId: params.id, pricePerKg: newPrice, currency: newCurrency },
      });
    }

    const updated = await prisma.material.update({
      where: { id: params.id },
      data: {
        name: name ?? existing.name,
        category: category !== undefined ? (category || null) : existing.category,
        supplier: supplier ?? existing.supplier,
        pricePerKg: newPrice,
        currency: newCurrency,
        description: description ?? existing.description,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT material error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();
    if (session.user.role === 'VIEWER' || session.user.role === 'EDITOR') {
      return NextResponse.json({ error: 'No permission' }, { status: 403 });
    }

    const existing = await prisma.material.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role !== 'ADMIN' && existing.companyId !== session.user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Bağlı kayıt var mı kontrol et
    const [partCount, purchaseCount, transferCount] = await Promise.all([
      prisma.productPart.count({ where: { materialId: params.id } }),
      prisma.purchaseMaterial.count({ where: { materialId: params.id } }),
      prisma.materialTransfer.count({ where: { materialId: params.id } }),
    ]);
    if (partCount + purchaseCount + transferCount > 0) {
      return NextResponse.json(
        { error: 'Bu hammadde ürün BOM\'unda veya alış/transfer kayıtlarında kullanılıyor, silinemez.' },
        { status: 409 }
      );
    }

    await prisma.material.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE material error:', error);
    return NextResponse.json({ error: 'Silme işlemi başarısız.' }, { status: 500 });
  }
}
