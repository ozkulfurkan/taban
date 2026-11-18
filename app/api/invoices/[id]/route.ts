import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';
import { rejectForeignRefs } from '@/lib/tenant';
import { parseDateInput } from '@/lib/time';
import { validateInvoiceInput } from '@/lib/invoice-input';

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

  const foreign = await rejectForeignRefs(user.companyId, {
    customer: rest.customerId,
    product: Array.isArray(items) ? items.map((i: any) => i?.productId) : [],
  });
  if (foreign) return foreign;

  let input: Extract<ReturnType<typeof validateInvoiceInput>, { ok: true }> | null = null;
  if (items) {
    const v = validateInvoiceInput({ ...rest, items }, { defaultVatRate: existing.vatRate });
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    input = v;
  } else if (rest.date && !parseDateInput(rest.date)) {
    return NextResponse.json({ error: 'Fatura tarihi geçersiz' }, { status: 400 });
  }

  const newInvoiceNo = typeof rest.invoiceNo === 'string' && rest.invoiceNo.trim() ? rest.invoiceNo.trim() : existing.invoiceNo;
  if (newInvoiceNo !== existing.invoiceNo &&
      await prisma.invoice.findFirst({ where: { companyId: user.companyId, invoiceNo: newInvoiceNo, NOT: { id: existing.id } }, select: { id: true } })) {
    return NextResponse.json({ error: `${newInvoiceNo} numaralı fatura zaten var` }, { status: 409 });
  }

  let updateData: any = {
    customerId: rest.customerId ?? existing.customerId,
    invoiceNo: newInvoiceNo,
    date: rest.date ? (() => {
      const incoming = parseDateInput(rest.date)!;
      const orig = new Date(existing.date as Date);
      // Aynı gün içindeki sıralama bozulmasın diye orijinal saat korunur
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(rest.date))) {
        const istDay = new Date(incoming.getTime() + 3 * 60 * 60 * 1000);
        const origIst = new Date(orig.getTime() + 3 * 60 * 60 * 1000);
        istDay.setUTCHours(origIst.getUTCHours(), origIst.getUTCMinutes(), origIst.getUTCSeconds(), origIst.getUTCMilliseconds());
        return new Date(istDay.getTime() - 3 * 60 * 60 * 1000);
      }
      return incoming;
    })() : existing.date,
    dueDate: rest.dueDate ? parseDateInput(rest.dueDate) : existing.dueDate,
    irsaliyeNo: rest.irsaliyeNo !== undefined ? (String(rest.irsaliyeNo).trim() || null) : existing.irsaliyeNo,
    sevkTarihi: rest.sevkTarihi !== undefined ? (rest.sevkTarihi ? parseDateInput(rest.sevkTarihi) : null) : existing.sevkTarihi,
    currency: rest.currency ?? existing.currency,
    notes: rest.notes !== undefined ? rest.notes : existing.notes,
    status: rest.status ?? existing.status,
  };

  if (input) {
    // Tutarlar pozitif saklanır (iade faturasında da); ödeme durumu yeni toplama göre güncellenir
    const { subtotal, vatRate, vatAmount, total } = input;
    updateData = { ...updateData, subtotal, vatRate, vatAmount, total };
    if (!rest.status && !['CANCELLED', 'DRAFT'].includes(existing.status)) {
      const paid = existing.paidAmount;
      updateData.status = paid <= 0 ? 'PENDING' : paid < total - 0.005 ? 'PARTIAL' : 'PAID';
    }
  }

  const invoice = await prisma.$transaction(async (tx) => {
    if (items) {
      // Eski hammadde stoğunu geri al (stok düşüldüyse, sadece SOLE_MANUFACTURER)
      if (existing.stockDeducted && !existing.isReturn && user.companyType !== 'MATERIAL_SUPPLIER') {
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

      // Ürün stoğu: eski kalemlerin etkisini geri al, yenilerini uygula
      // (satış stoğu düşürür, iade artırır)
      const dir = existing.isReturn ? 1 : -1;
      const stockDelta = new Map<string, number>();
      for (const old of existing.items) {
        if (old.productId) stockDelta.set(old.productId, (stockDelta.get(old.productId) ?? 0) - dir * old.quantity);
      }
      for (const line of input!.lines) {
        if (line.productId) stockDelta.set(line.productId, (stockDelta.get(line.productId) ?? 0) + dir * line.quantity);
      }
      for (const [productId, delta] of Array.from(stockDelta.entries())) {
        if (Math.abs(delta) < 1e-9) continue;
        await tx.product.updateMany({
          where: { id: productId, companyId: user.companyId },
          data: { stock: { increment: delta } },
        });
      }

      await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
      await tx.invoiceItem.createMany({
        data: input!.lines.map(line => ({ ...line, invoiceId: params.id })),
      });

      // Yeni hammadde stoğunu düş (stok daha önce düşüldüyse, sadece SOLE_MANUFACTURER)
      if (existing.stockDeducted && !existing.isReturn && user.companyType !== 'MATERIAL_SUPPLIER') {
        const newProductItems = input!.lines.filter((i): i is typeof i & { productId: string } => !!i.productId);
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
            const qty = item.quantity;
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

      // Hammadde stoğunu geri al (sadece SOLE_MANUFACTURER)
      if (user.companyType !== 'MATERIAL_SUPPLIER') {
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
    }

    await tx.payment.deleteMany({ where: { invoiceId: params.id } });
    await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
    await tx.invoice.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ ok: true });
}
