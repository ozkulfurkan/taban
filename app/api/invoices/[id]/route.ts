import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

async function getInvoice(id: string, companyId: string) {
  return prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      customer: { select: { id: true, name: true, taxId: true, email: true, phone: true } },
      items: {
        include: {
          product: {
            include: {
              parts: {
                include: {
                  material: { select: { id: true, name: true } },
                },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      },
      payments: { orderBy: { date: 'desc' } },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const invoice = await getInvoice(params.id, user.companyId);
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const existing = await prisma.invoice.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { items, ...rest } = body;

  let updateData: any = {
    customerId: rest.customerId ?? existing.customerId,
    invoiceNo: rest.invoiceNo ?? existing.invoiceNo,
    date: rest.date ? new Date(rest.date) : existing.date,
    dueDate: rest.dueDate ? new Date(rest.dueDate) : existing.dueDate,
    currency: rest.currency ?? existing.currency,
    notes: rest.notes !== undefined ? rest.notes : existing.notes,
    status: rest.status ?? existing.status,
  };

  if (items) {
    const subtotal = items.reduce((s: number, i: any) => {
      const qty = parseFloat(i.quantity) || 0;
      const price = parseFloat(i.unitPrice) || 0;
      const disc = parseFloat(i.discount) || 0;
      return s + qty * price * (1 - disc / 100);
    }, 0);
    const vatRate = parseFloat(rest.vatRate) ?? existing.vatRate;
    const vatAmount = subtotal * vatRate / 100;
    const total = subtotal + vatAmount;
    updateData = { ...updateData, subtotal, vatRate, vatAmount, total };
  }

  const invoice = await prisma.$transaction(async (tx) => {
    if (items) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
      await tx.invoiceItem.createMany({
        data: items.map((i: any) => {
          const qty = parseFloat(i.quantity) || 0;
          const price = parseFloat(i.unitPrice) || 0;
          const disc = parseFloat(i.discount) || 0;
          return {
            invoiceId: params.id,
            productId: i.productId || null,
            description: i.description,
            quantity: qty,
            unitPrice: price,
            discount: disc,
            total: qty * price * (1 - disc / 100),
            notes: i.notes || null,
          };
        }),
      });
    }
    return tx.invoice.update({
      where: { id: params.id },
      data: updateData,
      include: { items: true, customer: true, payments: true },
    });
  });

  return NextResponse.json(invoice);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const existing = await prisma.invoice.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      items: {
        include: {
          product: { include: { parts: true } },
        },
      },
    },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // ── Stok geri al ───────────────────────────────────────────────────────
    // Normal satış faturası: stok düşüldüyse geri ekle
    // İade faturası: stok eklenmişti, geri düş
    const sign = existing.isReturn ? -1 : 1; // sign to reverse

    for (const item of existing.items) {
      if (!item.productId || !item.product) continue;

      // Ürün stoğunu geri al
      await tx.product.updateMany({
        where: { id: item.productId, companyId: user.companyId },
        data: { stock: { increment: sign * item.quantity } },
      });

      // Hammadde stoğunu geri al
      for (const part of item.product.parts) {
        if (!part.materialId) continue;
        const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
        const kgUsed = (grossGrams * item.quantity) / 1000;
        await tx.material.updateMany({
          where: { id: part.materialId, companyId: user.companyId },
          data: { stock: { increment: sign * kgUsed } },
        });
      }
    }

    await tx.payment.deleteMany({ where: { invoiceId: params.id } });
    await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
    await tx.invoice.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ ok: true });
}
