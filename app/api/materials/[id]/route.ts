export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession, unauthorized } from '@/lib/helpers';

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

    await prisma.material.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE material error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
