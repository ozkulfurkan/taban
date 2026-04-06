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
      company,
      materialCount, calcCount, recentCalcs,
      dailyInvoicesByCurrency,
      monthlyInvoicesByCurrency,
      customers,
      allInvoices,
      allCustomerPayments,
      suppliers,
      allPurchases,
      allSupplierPayments,
      accounts,
      products,
      cekTotal,
      upcomingChecks,
    ] = await Promise.all([
      // Kur bilgileri
      prisma.company.findUnique({
        where: { id: companyId },
        select: { usdToTry: true, eurToTry: true },
      }),
      prisma.material.count({ where }),
      prisma.soleCalculation.count({ where }),
      prisma.soleCalculation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true } } },
      }),
      // Günlük ciro — para birimine göre grupla
      prisma.invoice.groupBy({
        by: ['currency'],
        where: { companyId, isReturn: false, date: { gte: todayStart, lt: tomorrowStart } },
        _sum: { total: true },
      }),
      // Aylık ciro — para birimine göre grupla
      prisma.invoice.groupBy({
        by: ['currency'],
        where: { companyId, isReturn: false, date: { gte: monthStart } },
        _sum: { total: true },
      }),
      // Müşteriler (id + currency)
      prisma.customer.findMany({
        where: { companyId },
        select: { id: true, currency: true },
      }),
      // Tüm faturalar (müşteri bazlı bakiye için)
      prisma.invoice.findMany({
        where: { companyId },
        select: { customerId: true, total: true, isReturn: true },
      }),
      // Tüm müşteri tahsilatları
      prisma.payment.findMany({
        where: { companyId, type: 'RECEIVED' },
        select: { customerId: true, amount: true, method: true, notes: true },
      }),
      // Tedarikçiler (id + currency)
      prisma.supplier.findMany({
        where: { companyId },
        select: { id: true, currency: true },
      }),
      // Tüm alışlar (tedarikçi bazlı borç için)
      prisma.purchase.findMany({
        where: { companyId },
        select: { supplierId: true, total: true },
      }),
      // Tüm tedarikçi ödemeleri
      prisma.payment.findMany({
        where: { companyId, type: 'PAID' },
        select: { supplierId: true, amount: true, method: true, notes: true },
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

    const usdToTry = company?.usdToTry ?? 1;
    const eurToTry = company?.eurToTry ?? 1;

    const toTry = (amount: number, currency: string) => {
      if (currency === 'USD') return amount * usdToTry;
      if (currency === 'EUR') return amount * eurToTry;
      return amount; // TRY
    };

    const calcs = await prisma.soleCalculation.findMany({ where, select: { totalCost: true } });
    const avgCost = calcs?.length ? (calcs.reduce((s: number, c: any) => s + (c?.totalCost ?? 0), 0) / calcs.length) : 0;

    // Günlük & aylık ciro → TL cinsinden
    const dailyCiro = dailyInvoicesByCurrency.reduce((s, g) => s + toTry(g._sum.total ?? 0, g.currency), 0);
    const monthlyCiro = monthlyInvoicesByCurrency.reduce((s, g) => s + toTry(g._sum.total ?? 0, g.currency), 0);

    // Toplam alacak: her müşterinin bakiyesi kendi para birimiyle TL'ye çevrilir
    let totalReceivables = 0;
    for (const customer of customers) {
      const invoices = allInvoices.filter(i => i.customerId === customer.id);
      const payments = allCustomerPayments.filter(p => p.customerId === customer.id);

      const normalTotal = invoices.filter(i => !i.isReturn).reduce((s, i) => s + i.total, 0);
      const returnTotal = invoices.filter(i => i.isReturn).reduce((s, i) => s + i.total, 0);

      let delta = 0;
      for (const p of payments) {
        if (p.method === 'Borç Fişi' || (p.method === 'Bakiye Düzeltme' && p.notes?.startsWith('+'))) {
          delta += p.amount;
        } else {
          delta -= p.amount;
        }
      }

      const balance = normalTotal - returnTotal + delta;
      totalReceivables += toTry(balance, customer.currency);
    }

    // Toplam borç: her tedarikçinin bakiyesi kendi para birimiyle TL'ye çevrilir
    let totalPayables = 0;
    for (const supplier of suppliers) {
      const purchases = allPurchases.filter(p => p.supplierId === supplier.id);
      const payments = allSupplierPayments.filter(p => p.supplierId === supplier.id);

      const totalPurchased = purchases.reduce((s, p) => s + p.total, 0);

      let delta = 0;
      for (const p of payments) {
        if (p.method === 'Borç Fişi' || (p.method === 'Bakiye Düzeltme' && p.notes?.startsWith('+'))) {
          delta += p.amount;
        } else {
          delta -= p.amount;
        }
      }

      const balance = totalPurchased + delta;
      totalPayables += toTry(balance, supplier.currency);
    }

    // Assets breakdown
    const kasaTotal = accounts.filter(a => a.type === 'Kasa' || a.name.toLowerCase().includes('kasa')).reduce((s, a) => s + a.balance, 0);
    const posTotal = accounts.filter(a => a.name.toLowerCase().includes('pos')).reduce((s, a) => s + a.balance, 0);
    const stokTotal = products.reduce((s, p) => s + toTry(p.stock * p.unitPrice, p.currency), 0);

    return NextResponse.json({
      materialCount,
      calcCount,
      avgCost,
      recentCalcs,
      dailyCiro,
      monthlyCiro,
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
