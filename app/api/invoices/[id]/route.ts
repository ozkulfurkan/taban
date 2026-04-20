import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

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

  const existing = await prisma.invoice.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      items: { include: { product: { include: { parts: true } } } },
    },
  });
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
      // Eski hammadde stoğunu geri al (stok düşüldüyse)
      if (existing.stockDeducted && !existing.isReturn) {
        for (const oldItem of existing.items) {
          if (!oldItem.productId || !(oldItem as any).product) continue;
          const pvData: Array<{ partId: string; materialId: string }> =
            Array.isArray((oldItem as any).partVariantsData) ? (oldItem as any).partVariantsData : [];
          for (const part of (oldItem as any).product.parts) {
            const matId = pvData.find(pv => pv.partId === part.id)?.materialId ?? part.materialId;
            if (!matId) continue;
            const kgUsed = (part.gramsPerPiece * (1 + part.wasteRate / 100) * oldItem.quantity) / 1000;
            await tx.material.updateMany({
              where: { id: matId, companyId: user.companyId },
              data: { stock: { increment: kgUsed } },
            });
          }
        }
      }

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
            partVariantsData: Array.isArray(i.partVariantsData) && i.partVariantsData.length > 0
              ? i.partVariantsData
              : undefined,
          };
        }),
      });

      // Yeni hammadde stoğunu düş (stok daha önce düşüldüyse)
      if (existing.stockDeducted && !existing.isReturn) {
        const newProductItems = items.filter((i: any) => i.productId);
        if (newProductItems.length > 0) {
          const seen = new Set<string>();
          const uniqueIds: string[] = [];
          for (const i of newProductItems) { if (!seen.has(i.productId)) { seen.add(i.productId); uniqueIds.push(i.productId); } }
          const products = await tx.product.findMany({
            where: { id: { in: uniqueIds }, companyId: user.companyId },
            include: { parts: true },
          });
          const materialMap = new Map<string, number>();
          for (const item of newProductItems) {
            const qty = parseFloat(item.quantity) || 0;
            const product = products.find((p: any) => p.id === item.productId);
            if (!product) continue;
            const pvData: Array<{ partId: string; materialId: string }> =
              Array.isArray(item.partVariantsData) ? item.partVariantsData : [];
            for (const part of product.parts) {
              const matId = pvData.find(pv => pv.partId === part.id)?.materialId ?? part.materialId;
              if (!matId) continue;
              const kgUsed = (part.gramsPerPiece * (1 + part.wasteRate / 100) * qty) / 1000;
              materialMap.set(matId, (materialMap.get(matId) || 0) + kgUsed);
            }
          }
          for (const [matId, kg] of Array.from(materialMap.entries())) {
            await tx.material.updateMany({
              where: { id: matId, companyId: user.companyId },
              data: { stock: { decrement: kg } },
            });
          }
        }
      }
    }
    return tx.invoice.update({
      where: { id: params.id },
      data: updateData,
      include: { items: true, customer: true, payments: true },
    });
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'Invoice',
    entityId: params.id,
    detail: `Fatura güncellendi — ${invoice.invoiceNo}`,
    ip: getIp(req),
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

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: existing.isReturn ? 'ReturnInvoice' : 'Invoice',
    entityId: params.id,
    detail: `Fatura silindi — ${existing.invoiceNo}`,
    meta: { total: existing.total, currency: existing.currency },
    ip: getIp(req),
  });
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

      // Hammadde stoğunu geri al (partVariantsData'daki seçili malzemeyi kullan)
      const partVariants: Array<{ partId: string; materialId: string }> =
        Array.isArray((item as any).partVariantsData) ? (item as any).partVariantsData : [];
      for (const part of item.product.parts) {
        const matId = partVariants.find(pv => pv.partId === part.id)?.materialId ?? part.materialId;
        if (!matId) continue;
        const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
        const kgUsed = (grossGrams * item.quantity) / 1000;
        await tx.material.updateMany({
          where: { id: matId, companyId: user.companyId },
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
