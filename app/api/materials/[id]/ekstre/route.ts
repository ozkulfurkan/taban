import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET: hammadde stok ekstresi
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const material = await prisma.material.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // ── 1. ALIŞLAR ──────────────────────────────────────────────────────────
  const purchases = await prisma.purchaseMaterial.findMany({
    where: { materialId: params.id },
    include: {
      purchase: {
        include: {
          supplier: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // ── 2 & 3. SATIŞLAR / İADELER ────────────────────────────────────────────
  const partFilter = { materialId: params.id };

  const invoiceItems = await prisma.invoiceItem.findMany({
    where: {
      product: { parts: { some: partFilter } },
      invoice: { companyId: user.companyId, isReturn: false },
    },
    include: {
      invoice: { include: { customer: { select: { id: true, name: true } } } },
      product: {
        include: {
          parts: { where: partFilter },
        },
      },
    },
  });

  const returnItems = await prisma.invoiceItem.findMany({
    where: {
      product: { parts: { some: partFilter } },
      invoice: { companyId: user.companyId, isReturn: true },
    },
    include: {
      invoice: { include: { customer: { select: { id: true, name: true } } } },
      product: {
        include: {
          parts: { where: partFilter },
        },
      },
    },
  });

  // ── 4. FASONCU TRANSFERLERİ ─────────────────────────────────────────────
  const transfers = await prisma.materialTransfer.findMany({
    where: { materialId: params.id, companyId: user.companyId },
    include: {
      subcontractor: { select: { id: true, name: true } },
    },
    orderBy: { transferDate: 'desc' },
  });

  // ── Birleşik timeline ────────────────────────────────────────────────────
  // ── 5. STOK DÜZELTMELERİ ────────────────────────────────────────────────
  const adjustments = await prisma.stockAdjustment.findMany({
    where: { materialId: params.id, companyId: user.companyId },
    orderBy: { createdAt: 'desc' },
  });

  type Entry = {
    id: string;
    date: Date;
    type: 'alis' | 'satis' | 'iade' | 'fason_transfer' | 'artirma' | 'azaltma' | 'stok_guncelleme';
    party: string;
    partyId: string;
    product: string | null;
    productId: string | null;
    kgAmount: number;
    pricePerKg: number | null;
    currency: string | null;
    invoiceNo: string | null;
  };

  const entries: Entry[] = [];

  for (const pm of purchases) {
    entries.push({
      id: pm.id,
      date: pm.purchase.date,
      type: 'alis',
      party: pm.purchase.supplier?.name ?? '—',
      partyId: pm.purchase.supplierId,
      product: null,
      productId: null,
      kgAmount: pm.kgAmount,
      pricePerKg: pm.pricePerKg,
      currency: pm.purchase.currency,
      invoiceNo: pm.purchase.invoiceNo,
    });
  }

  for (const ii of invoiceItems) {
    let kgUsed = 0;
    for (const part of (ii.product as any)?.parts ?? []) {
      const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
      kgUsed += (grossGrams * ii.quantity) / 1000;
    }
    if (kgUsed > 0) {
      entries.push({
        id: ii.id,
        date: (ii as any).invoice.date,
        type: 'satis',
        party: (ii as any).invoice.customer?.name ?? '—',
        partyId: (ii as any).invoice.customerId,
        product: ii.description,
        productId: ii.productId,
        kgAmount: -Math.round(kgUsed * 1000) / 1000,
        pricePerKg: null,
        currency: (ii as any).invoice.currency,
        invoiceNo: (ii as any).invoice.invoiceNo,
      });
    }
  }

  for (const ii of returnItems) {
    let kgRestored = 0;
    for (const part of (ii.product as any)?.parts ?? []) {
      const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
      kgRestored += (grossGrams * ii.quantity) / 1000;
    }
    if (kgRestored > 0) {
      entries.push({
        id: `ret-${ii.id}`,
        date: (ii as any).invoice.date,
        type: 'iade',
        party: (ii as any).invoice.customer?.name ?? '—',
        partyId: (ii as any).invoice.customerId,
        product: ii.description,
        productId: ii.productId,
        kgAmount: Math.round(kgRestored * 1000) / 1000,
        pricePerKg: null,
        currency: (ii as any).invoice.currency,
        invoiceNo: (ii as any).invoice.invoiceNo,
      });
    }
  }

  for (const t of transfers) {
    entries.push({
      id: `tr-${t.id}`,
      date: t.transferDate,
      type: 'fason_transfer',
      party: `${(t as any).subcontractor?.name ?? '—'} (Fasoncu)`,
      partyId: t.subcontractorId,
      product: null,
      productId: null,
      kgAmount: t.direction === 'OUTGOING' ? -t.quantity : t.quantity,
      pricePerKg: null,
      currency: null,
      invoiceNo: null,
    });
  }

  for (const adj of adjustments) {
    entries.push({
      id: `adj-${adj.id}`,
      date: adj.createdAt,
      type: adj.type as any,
      party: 'Manuel Düzeltme',
      partyId: '',
      product: adj.notes || null,
      productId: null,
      kgAmount: adj.delta,
      pricePerKg: null,
      currency: null,
      invoiceNo: null,
    });
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({
    material: {
      id: material.id,
      name: material.name,
      category: material.category,
      stock: material.stock,
      currency: material.currency,
    },
    entries,
  });
}
