import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET: hammadde stok ekstresi
// Alışlar (PurchaseMaterial) + Satışlar (InvoiceItem → Product → Part)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const { searchParams } = new URL(req.url);
  const filterVariantId = searchParams.get('variantId'); // if set, show only this variant

  const material = await prisma.material.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: { variants: { orderBy: { colorName: 'asc' } } },
  });
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // ── 1. ALIŞLAR ──────────────────────────────────────────────────────────
  const allVariantIds = material.variants.map((v: any) => v.id);

  // If filtering to a specific variant, only show that variant's purchases
  // Otherwise show all (material-level + all variants)
  const purchaseWhere = filterVariantId
    ? { materialVariantId: filterVariantId }
    : {
        OR: [
          { materialId: params.id, materialVariantId: null },
          ...(allVariantIds.length > 0 ? [{ materialVariantId: { in: allVariantIds } }] : []),
        ],
      };

  const purchases = await prisma.purchaseMaterial.findMany({
    where: purchaseWhere,
    include: {
      purchase: {
        include: {
          supplier: { select: { id: true, name: true } },
        },
      },
      materialVariant: { select: { colorName: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // ── 2. SATIŞLAR ─────────────────────────────────────────────────────────
  // Variant filter: if filterVariantId, only match parts with that specific variant
  const partFilter = filterVariantId
    ? { materialVariantId: filterVariantId }
    : {
        OR: [
          { materialId: params.id },
          { materialVariantId: { in: allVariantIds.length > 0 ? allVariantIds : ['__none__'] } },
        ],
      };

  const invoiceItems = await prisma.invoiceItem.findMany({
    where: {
      product: { parts: { some: partFilter } },
      invoice: { companyId: user.companyId, isReturn: false },
    },
    include: {
      invoice: { include: { customer: { select: { id: true, name: true } } } },
      product: {
        include: {
          parts: {
            where: partFilter,
            include: { materialVariant: { select: { colorName: true, code: true } } },
          },
        },
      },
    },
  });

  // ── 3. İADELER ──────────────────────────────────────────────────────────
  const returnItems = await prisma.invoiceItem.findMany({
    where: {
      product: { parts: { some: partFilter } },
      invoice: { companyId: user.companyId, isReturn: true },
    },
    include: {
      invoice: { include: { customer: { select: { id: true, name: true } } } },
      product: {
        include: {
          parts: {
            where: partFilter,
            include: { materialVariant: { select: { colorName: true, code: true } } },
          },
        },
      },
    },
  });

  // ── Birleşik timeline oluştur ────────────────────────────────────────────
  type Entry = {
    id: string;
    date: Date;
    type: 'alis' | 'satis' | 'iade';
    party: string;       // tedarikçi veya müşteri adı
    partyId: string;
    product: string | null;
    productId: string | null;
    variant: string | null;
    kgAmount: number;    // pozitif = stok artışı, negatif = stok azalışı
    pricePerKg: number | null;
    currency: string | null;
    invoiceNo: string | null;
  };

  const entries: Entry[] = [];

  // Alışları ekle
  for (const pm of purchases) {
    entries.push({
      id: pm.id,
      date: pm.purchase.date,
      type: 'alis',
      party: pm.purchase.supplier?.name ?? '—',
      partyId: pm.purchase.supplierId,
      product: null,
      productId: null,
      variant: pm.materialVariant
        ? `${pm.materialVariant.colorName}${pm.materialVariant.code ? ` (${pm.materialVariant.code})` : ''}`
        : null,
      kgAmount: pm.kgAmount,
      pricePerKg: pm.pricePerKg,
      currency: pm.purchase.currency,
      invoiceNo: pm.purchase.invoiceNo,
    });
  }

  // Satışları ekle (kg tüketimi hesapla)
  for (const ii of invoiceItems) {
    let kgUsed = 0;
    let variantLabel: string | null = null;

    for (const part of ii.product?.parts ?? []) {
      const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
      kgUsed += (grossGrams * ii.quantity) / 1000;
      if (part.materialVariant) {
        variantLabel = `${part.materialVariant.colorName}${part.materialVariant.code ? ` (${part.materialVariant.code})` : ''}`;
      }
    }

    if (kgUsed > 0) {
      entries.push({
        id: ii.id,
        date: ii.invoice.date,
        type: 'satis',
        party: ii.invoice.customer?.name ?? '—',
        partyId: ii.invoice.customerId,
        product: ii.description,
        productId: ii.productId,
        variant: variantLabel,
        kgAmount: -Math.round(kgUsed * 1000) / 1000,
        pricePerKg: null,
        currency: ii.invoice.currency,
        invoiceNo: ii.invoice.invoiceNo,
      });
    }
  }

  // İadeleri ekle
  for (const ii of returnItems) {
    let kgRestored = 0;
    let variantLabel: string | null = null;

    for (const part of ii.product?.parts ?? []) {
      const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
      kgRestored += (grossGrams * ii.quantity) / 1000;
      if (part.materialVariant) {
        variantLabel = `${part.materialVariant.colorName}${part.materialVariant.code ? ` (${part.materialVariant.code})` : ''}`;
      }
    }

    if (kgRestored > 0) {
      entries.push({
        id: `ret-${ii.id}`,
        date: ii.invoice.date,
        type: 'iade',
        party: ii.invoice.customer?.name ?? '—',
        partyId: ii.invoice.customerId,
        product: ii.description,
        productId: ii.productId,
        variant: variantLabel,
        kgAmount: Math.round(kgRestored * 1000) / 1000,
        pricePerKg: null,
        currency: ii.invoice.currency,
        invoiceNo: ii.invoice.invoiceNo,
      });
    }
  }

  // Tarihe göre sırala (en yeni önce)
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // If filtering by variant, return variant-level stock
  const activeVariant = filterVariantId
    ? material.variants.find((v: any) => v.id === filterVariantId)
    : null;

  return NextResponse.json({
    material: {
      id: material.id,
      name: material.name,
      stock: activeVariant ? activeVariant.stock : material.stock,
      currency: material.currency,
      variants: material.variants,
      activeVariant: activeVariant ?? null,
    },
    entries,
  });
}
