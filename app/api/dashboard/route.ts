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
      totalReceivableRaw, totalPaidRaw,
      totalPurchaseRaw, totalSupplierPaidRaw,
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
      // Günlük ciro — today's non-return invoices
      prisma.invoice.aggregate({
        where: { companyId, isReturn: false, date: { gte: todayStart, lt: tomorrowStart } },
        _sum: { total: true },
      }),
      // Aylık ciro — this month's non-return invoices
      prisma.invoice.aggregate({
        where: { companyId, isReturn: false, date: { gte: monthStart } },
        _sum: { total: true },
      }),
      // Toplam faturalar (positive + negative/returns included in balance)
      prisma.invoice.aggregate({
        where: { companyId },
        _sum: { total: true },
      }),
      // Toplam tahsilat
      prisma.payment.aggregate({
        where: { companyId, type: 'RECEIVED' },
        _sum: { amount: true },
      }),
      // Toplam alış
      prisma.purchase.aggregate({
        where: { companyId },
        _sum: { total: true },
      }),
      // Toplam tedarikçi ödemesi
      prisma.payment.aggregate({
        where: { companyId, type: 'PAID' },
        _sum: { amount: true },
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

    const totalReceivables = Math.max(0, (totalReceivableRaw._sum.total ?? 0) - (totalPaidRaw._sum.amount ?? 0));
    const totalPayables = Math.max(0, (totalPurchaseRaw._sum.total ?? 0) - (totalSupplierPaidRaw._sum.amount ?? 0));

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
