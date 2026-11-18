export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession, unauthorized } from '@/lib/helpers';
import { round2 } from '@/lib/money';

export async function GET() {
  try {
    const session = await getAuthSession() as any;
    if (!session?.user) return unauthorized();

    const companyId = session.user.companyId;
    const where = session.user.role === 'ADMIN' ? {} : { companyId };

    // Gün ve ay sınırları İstanbul saatine göre (sunucu UTC'de çalışır)
    const now = new Date();
    const IST = 3 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + IST);
    const todayStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const monthStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST);
    const oneMonthLater = new Date(now); oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    type CurrencySum = { currency: string; amount: number | null };
    // Bakiye kuralları lib/money.ts ile aynı: iade borcu azaltır (eski negatif kayıtlar için ABS),
    // borç fişi ve "+" bakiye düzeltmesi borcu artırır, diğer ödemeler azaltır.
    const debtSign = `CASE WHEN "method" = 'Borç Fişi' OR ("method" = 'Bakiye Düzeltme' AND "notes" LIKE '+%') THEN 1 ELSE -1 END`;

    const [
      company,
      materialCount, calcCount, recentCalcs, calcAvg,
      dailyInvoicesByCurrency,
      monthlyInvoicesByCurrency,
      invoiceSums, customerPaymentSums, customerCekSums,
      purchaseSums, supplierPaymentSums,
      accounts,
      stockSums,
      cekTotal,
      upcomingChecks,
    ] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId }, select: { usdToTry: true, eurToTry: true } }),
      prisma.material.count({ where }),
      prisma.soleCalculation.count({ where }),
      prisma.soleCalculation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true } } },
      }),
      prisma.soleCalculation.aggregate({ where, _avg: { totalCost: true } }),
      prisma.invoice.groupBy({
        by: ['currency'],
        where: { companyId, isReturn: false, date: { gte: todayStart, lt: tomorrowStart } },
        _sum: { total: true },
      }),
      prisma.invoice.groupBy({
        by: ['currency'],
        where: { companyId, isReturn: false, date: { gte: monthStart } },
        _sum: { total: true },
      }),
      prisma.$queryRaw<CurrencySum[]>`
        SELECT "currency", SUM(CASE WHEN "isReturn" THEN -ABS("total") ELSE ABS("total") END) AS amount
        FROM "Invoice" WHERE "companyId" = ${companyId} GROUP BY "currency"`,
      prisma.$queryRawUnsafe<CurrencySum[]>(
        `SELECT "currency", SUM(${debtSign} * "amount") AS amount
         FROM "Payment" WHERE "companyId" = $1 AND "customerId" IS NOT NULL GROUP BY "currency"`, companyId),
      prisma.$queryRaw<CurrencySum[]>`
        SELECT COALESCE("customerCurrency", "currency") AS currency, SUM(COALESCE("customerAmount", "tutar")) AS amount
        FROM "Cek" WHERE "companyId" = ${companyId} AND "customerId" IS NOT NULL AND "islem" = 'Müşteriden Alınan Çek Kaydı'
        GROUP BY 1`,
      prisma.$queryRaw<CurrencySum[]>`
        SELECT "currency", SUM(CASE WHEN "isReturn" THEN -ABS("total") ELSE ABS("total") END) AS amount
        FROM "Purchase" WHERE "companyId" = ${companyId} AND "supplierId" IS NOT NULL GROUP BY "currency"`,
      prisma.$queryRawUnsafe<CurrencySum[]>(
        `SELECT "currency", SUM(${debtSign} * "amount") AS amount
         FROM "Payment" WHERE "companyId" = $1 AND "supplierId" IS NOT NULL AND "type" = 'PAID' GROUP BY "currency"`, companyId),
      prisma.account.findMany({ where: { companyId } }),
      prisma.$queryRaw<CurrencySum[]>`
        SELECT "currency", SUM("stock" * "unitPrice") AS amount
        FROM "Product" WHERE "companyId" = ${companyId} GROUP BY "currency"`,
      prisma.cek.groupBy({
        by: ['currency'],
        where: { companyId, durum: { in: ['PORTFOY', 'BANKAYA_VERILDI'] } },
        _sum: { tutar: true },
      }),
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
    const sumTry = (rows: CurrencySum[]) => rows.reduce((s, r) => s + toTry(Number(r.amount ?? 0), r.currency), 0);

    const avgCost = calcAvg._avg.totalCost ?? 0;
    const dailyCiro = dailyInvoicesByCurrency.reduce((s, g) => s + toTry(g._sum.total ?? 0, g.currency), 0);
    const monthlyCiro = monthlyInvoicesByCurrency.reduce((s, g) => s + toTry(g._sum.total ?? 0, g.currency), 0);

    // Toplam alacak = satışlar − iadeler ± müşteri ödemeleri − müşteriden alınan çekler (TL)
    const totalReceivables = round2(sumTry(invoiceSums) + sumTry(customerPaymentSums) - sumTry(customerCekSums));
    // Toplam borç = alışlar ± tedarikçi ödemeleri (TL)
    const totalPayables = round2(sumTry(purchaseSums) + sumTry(supplierPaymentSums));

    // Varlıklar: her hesap kendi para birimiyle TL'ye çevrilir
    const kasaTotal = accounts
      .filter(a => a.type === 'Kasa' || a.name.toLowerCase().includes('kasa'))
      .reduce((s, a) => s + toTry(a.balance, a.currency), 0);
    const posTotal = accounts
      .filter(a => a.name.toLowerCase().includes('pos'))
      .reduce((s, a) => s + toTry(a.balance, a.currency), 0);
    const cekTotalTRY = cekTotal.reduce((s, g) => s + toTry(g._sum.tutar ?? 0, g.currency), 0);
    const stokTotal = sumTry(stockSums);

    // Satış stoğu eksiye düşürebilir; eksi stoktaki kalemler ana sayfada uyarı olarak gösterilir
    const [negativeMaterials, negativeProducts] = await Promise.all([
      prisma.material.findMany({
        where: { companyId, stock: { lt: 0 } },
        select: { id: true, name: true, stock: true },
        orderBy: { stock: 'asc' }, take: 10,
      }),
      prisma.product.findMany({
        where: { companyId, stock: { lt: 0 } },
        select: { id: true, name: true, code: true, stock: true, unit: true },
        orderBy: { stock: 'asc' }, take: 10,
      }),
    ]);

    return NextResponse.json({
      negativeStock: { materials: negativeMaterials, products: negativeProducts },
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
        cek: cekTotalTRY,
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
