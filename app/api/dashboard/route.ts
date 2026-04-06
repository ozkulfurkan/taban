export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession, unauthorized } from '@/lib/helpers';

export async function GET() {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();

    const companyId = session.user.companyId;
    const where = session.user.role === 'ADMIN' ? {} : { companyId };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const oneMonthLater = new Date(now); oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const [
      materialCount, calcCount, recentCalcs,
      dailyInvoices, monthlyInvoices,
      normalInvoices, returnInvoices,
      customerPayments,
      totalPurchaseRaw,
      supplierPayments,
      accounts,
      products,
      cekTotal,
      upcomingChecks,
    ] = await Promise.all([
      prisma.material.count({ where }),
      prisma.soleCalculation.count({ where }),
      prisma.soleCalculation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true } } },
      }),
      // Günlük ciro
      prisma.invoice.aggregate({
        where: { companyId, isReturn: false, date: { gte: todayStart, lt: tomorrowStart } },
        _sum: { total: true },
      }),
      // Aylık ciro
      prisma.invoice.aggregate({
        where: { companyId, isReturn: false, date: { gte: monthStart } },
        _sum: { total: true },
      }),
      // Normal faturalar (müşteri alacak hesabı için)
      prisma.invoice.aggregate({
        where: { companyId, isReturn: false },
        _sum: { total: true },
      }),
      // İade faturalar
      prisma.invoice.aggregate({
        where: { companyId, isReturn: true },
        _sum: { total: true },
      }),
      // Müşterilerden tahsilatlar (bakiye düzeltme dahil)
      prisma.payment.findMany({
        where: { companyId, type: 'RECEIVED' },
        select: { amount: true, method: true, notes: true },
      }),
      // Toplam alış (tedarikçi borç hesabı için)
      prisma.purchase.aggregate({
        where: { companyId },
        _sum: { total: true },
      }),
      // Tedarikçilere ödemeler (bakiye düzeltme dahil)
      prisma.payment.findMany({
        where: { companyId, type: 'PAID' },
        select: { amount: true, method: true, notes: true },
      }),
      // Hesap bakiyeleri
      prisma.account.findMany({ where: { companyId } }),
      // Ürün stok
      prisma.product.findMany({ where: { companyId }, select: { stock: true, unitPrice: true, currency: true } }),
      // Aktif çek toplamı
      prisma.cek.aggregate({
        where: { companyId, durum: { in: ['PORTFOY', 'BANKAYA_VERILDI'] } },
        _sum: { tutar: true },
      }),
      // Vadesi son 1 ay içindeki aktif çekler
      prisma.cek.findMany({
        where: {
          companyId,
          durum: { in: ['PORTFOY', 'BANKAYA_VERILDI'] },
          vadesi: { gte: now, lte: oneMonthLater },
        },
        include: { customer: { select: { name: true } } },
        orderBy: { vadesi: 'asc' },
        take: 15,
      }),
    ]);

    const calcs = await prisma.soleCalculation.findMany({ where, select: { totalCost: true } });
    const avgCost = calcs?.length ? (calcs.reduce((s: number, c: any) => s + (c?.totalCost ?? 0), 0) / calcs.length) : 0;

    // Müşteri bakiyesi: müşteriler sayfasıyla aynı mantık
    let customerBalanceDelta = 0;
    for (const p of customerPayments) {
      if (p.method === 'Borç Fişi' || (p.method === 'Bakiye Düzeltme' && p.notes?.startsWith('+'))) {
        customerBalanceDelta += p.amount;
      } else {
        customerBalanceDelta -= p.amount;
      }
    }
    const totalReceivables = (normalInvoices._sum.total ?? 0) - (returnInvoices._sum.total ?? 0) + customerBalanceDelta;

    // Tedarikçi bakiyesi: tedarikçiler sayfasıyla aynı mantık
    let supplierBalanceDelta = 0;
    for (const p of supplierPayments) {
      if (p.method === 'Borç Fişi' || (p.method === 'Bakiye Düzeltme' && p.notes?.startsWith('+'))) {
        supplierBalanceDelta += p.amount;
      } else {
        supplierBalanceDelta -= p.amount;
      }
    }
    const totalPayables = (totalPurchaseRaw._sum.total ?? 0) + supplierBalanceDelta;

    // Assets breakdown
    const kasaTotal = accounts.filter(a => a.type === 'Kasa' || a.name.toLowerCase().includes('kasa')).reduce((s, a) => s + a.balance, 0);
    const posTotal = accounts.filter(a => a.name.toLowerCase().includes('pos')).reduce((s, a) => s + a.balance, 0);
    const stokTotal = products.reduce((s, p) => s + p.stock * p.unitPrice, 0);

    return NextResponse.json({
      materialCount,
      calcCount,
      avgCost,
      recentCalcs,
      dailyCiro: dailyInvoices._sum.total ?? 0,
      monthlyCiro: monthlyInvoices._sum.total ?? 0,
      totalReceivables,
      totalPayables,
      assets: {
        kasa: kasaTotal,
        pos: posTotal,
        cek: cekTotal._sum.tutar ?? 0,
        senet: 0,
        stok: stokTotal,
        acikHesap: totalReceivables,
        calisanlar: 0,
      },
      upcomingChecks,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
