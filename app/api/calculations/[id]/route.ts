export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession, unauthorized, calcNetWeight, calcMaterialCost, calcLaborSalaryBased, calcSellingPrice } from '@/lib/helpers';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();

    const calc = await prisma.soleCalculation.findUnique({
      where: { id: params.id },
      include: { parts: { include: { material: true } }, user: { select: { name: true, email: true } } },
    });

    if (!calc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role !== 'ADMIN' && calc.companyId !== session.user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(calc);
  } catch (error: any) {
    console.error('GET calculation error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();
    if (session.user.role === 'VIEWER') return NextResponse.json({ error: 'No permission' }, { status: 403 });

    const existing = await prisma.soleCalculation.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role !== 'ADMIN' && existing.companyId !== session.user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, parts, laborMethod, laborCurrency, monthlySalary, workDays, dailyProduction, laborCostPerPair, paintCost, profitMargin, vatRate, currency, notes } = body ?? {};

    // Get company exchange rates for labor currency conversion
    const company = await prisma.company.findUnique({ where: { id: existing.companyId } });
    const usdToTry = company?.usdToTry ?? 1;
    const eurToTry = company?.eurToTry ?? 1;

    let totalMaterialCost = 0;
    const partsData: any[] = [];

    for (const part of (parts ?? [])) {
      const mat = await prisma.material.findUnique({ where: { id: part.materialId } });
      if (!mat) continue;
      const netW = calcNetWeight(part.grossWeight ?? 0, part.wasteRate ?? 0);
      const cost = calcMaterialCost(netW, mat.pricePerKg);
      totalMaterialCost += cost;
      partsData.push({
        materialId: part.materialId,
        partName: part.partName ?? 'Part',
        grossWeight: part.grossWeight ?? 0,
        wasteRate: part.wasteRate ?? 0,
        netWeight: netW,
        cost,
      });
    }

    let rawLaborCost = laborCostPerPair ?? 0;
    if (laborMethod === 'salary' && monthlySalary && workDays && dailyProduction) {
      rawLaborCost = calcLaborSalaryBased(monthlySalary, workDays, dailyProduction);
    }

    // Convert labor cost to calculation currency
    const finalLaborCost = convertLaborCost(rawLaborCost, laborCurrency ?? 'USD', currency ?? 'USD', usdToTry, eurToTry);

    const totalCost = totalMaterialCost + finalLaborCost + (paintCost ?? 0);
    const sellingPrice = calcSellingPrice(totalCost, profitMargin ?? 0);
    const vat = vatRate ?? 0;
    const sellingPriceWithVat = sellingPrice * (1 + vat / 100);

    // Delete old parts and create new ones
    await prisma.solePart.deleteMany({ where: { calculationId: params.id } });

    const updated = await prisma.soleCalculation.update({
      where: { id: params.id },
      data: {
        name,
        laborMethod: laborMethod ?? 'direct',
        laborCurrency: laborCurrency ?? 'USD',
        monthlySalary: monthlySalary ?? null,
        workDays: workDays ?? null,
        dailyProduction: dailyProduction ?? null,
        laborCostPerPair: finalLaborCost,
        paintCost: paintCost ?? 0,
        profitMargin: profitMargin ?? 0,
        vatRate: vat,
        totalMaterialCost,
        totalCost,
        sellingPrice,
        sellingPriceWithVat,
        currency: currency ?? 'USD',
        notes: notes ?? '',
        parts: { create: partsData },
      },
      include: { parts: { include: { material: true } } },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT calculation error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();
    if (session.user.role === 'VIEWER') return NextResponse.json({ error: 'No permission' }, { status: 403 });

    const calc = await prisma.soleCalculation.findUnique({ where: { id: params.id } });
    if (!calc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role !== 'ADMIN' && calc.companyId !== session.user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.soleCalculation.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE calculation error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

function convertLaborCost(amount: number, fromCurrency: string, toCurrency: string, usdToTry: number, eurToTry: number): number {
  if (fromCurrency === toCurrency) return amount;
  // Convert to TRY first, then to target
  let inTry = amount;
  if (fromCurrency === 'USD') inTry = amount * usdToTry;
  else if (fromCurrency === 'EUR') inTry = amount * eurToTry;
  // TRY stays as is

  if (toCurrency === 'TRY') return inTry;
  if (toCurrency === 'USD') return usdToTry > 0 ? inTry / usdToTry : amount;
  if (toCurrency === 'EUR') return eurToTry > 0 ? inTry / eurToTry : amount;
  return amount;
}
