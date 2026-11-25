import { NextRequest, NextResponse } from 'next/server';
import { duplicateGuarded } from '@/lib/request-dedup';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseDateInputOrNow, formatDate } from '@/lib/time';
import { parseAmount, round2 } from '@/lib/money';
import { logAction, getIp } from '@/lib/audit-logger';
import { rejectForeignRefs } from '@/lib/tenant';

// Çek portföyünde toplu işlemler. Hepsi tek işlemde: bir çek uygun değilse hiçbiri değişmez.
//  bank     : portföydeki çekler seçilen banka hesabına tahsile verilir
//  supplier : portföydeki çekler tedarikçiye ödeme olarak verilir (tedarikçi dövizinde ödeme kaydı)
//  collect  : bankadaki / portföydeki çekler tahsil edilir, tutar seçilen hesaba girer
type Action = 'bank' | 'supplier' | 'collect';

const ALLOWED_FROM: Record<Action, string[]> = {
  bank: ['PORTFOY'],
  supplier: ['PORTFOY'],
  collect: ['PORTFOY', 'BANKAYA_VERILDI'],
};

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function create(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return err('Unauthorized', 401);
  const user = session.user as any;
  if (!user.companyId) return err('No company');

  const body = await req.json().catch(() => ({}));
  const action = body.action as Action;
  if (!['bank', 'supplier', 'collect'].includes(action)) return err('Geçersiz işlem');

  const ids: string[] = Array.isArray(body.ids) ? Array.from(new Set(body.ids.filter((x: unknown) => typeof x === 'string'))) : [];
  if (ids.length === 0) return err('En az bir çek seçin');
  if (ids.length > 500) return err('Bir seferde en fazla 500 çek işlenebilir');

  const foreign = await rejectForeignRefs(user.companyId, {
    account: body.accountId,
    supplier: body.supplierId,
  });
  if (foreign) return foreign;

  const cekler = await prisma.cek.findMany({ where: { id: { in: ids }, companyId: user.companyId } });
  if (cekler.length !== ids.length) return err('Çeklerden bazıları bulunamadı', 404);
  const wrong = cekler.filter(c => !ALLOWED_FROM[action].includes(c.durum));
  if (wrong.length) {
    return err(`${wrong.length} çek bu işlem için uygun durumda değil (${wrong.map(c => c.seriNo || c.borclu).slice(0, 3).join(', ')}${wrong.length > 3 ? '…' : ''})`);
  }

  const date = parseDateInputOrNow(body.date);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';

  if (action === 'bank') {
    if (!body.accountId) return err('Banka hesabı seçin');
    const account = await prisma.account.findFirst({ where: { id: body.accountId, companyId: user.companyId } });
    if (!account) return err('Hesap bulunamadı', 404);
    await prisma.$transaction(cekler.map(c => prisma.cek.update({
      where: { id: c.id },
      data: {
        durum: 'BANKAYA_VERILDI',
        bankAccountId: account.id,
        aciklama: [c.aciklama, `Bankaya verildi: ${account.name} ${formatDate(date)}`, note].filter(Boolean).join(' | '),
      },
    })));
    await log(req, user, `${cekler.length} çek bankaya verildi — ${account.name}`, { ids, accountId: account.id });
    return NextResponse.json({ ok: true, count: cekler.length });
  }

  if (action === 'collect') {
    if (!body.accountId) return err('Kasa / banka hesabı seçin');
    const account = await prisma.account.findFirst({ where: { id: body.accountId, companyId: user.companyId } });
    if (!account) return err('Hesap bulunamadı', 404);
    const mismatch = cekler.filter(c => c.currency !== account.currency);
    if (mismatch.length) return err(`${account.name} hesabı ${account.currency}; ${mismatch.length} çek farklı dövizde. Aynı dövizdeki hesabı seçin.`);
    await prisma.$transaction(async tx => {
      for (const c of cekler) {
        const p = await tx.payment.create({
          data: {
            companyId: user.companyId,
            type: 'RECEIVED',
            accountId: account.id,
            amount: round2(c.tutar),
            currency: c.currency,
            date,
            method: 'Çek',
            notes: [c.seriNo ? `Çek No: ${c.seriNo}` : '', c.bankasi ? `Banka: ${c.bankasi}` : '', `Borçlu: ${c.borclu}`, note].filter(Boolean).join(' | '),
          },
        });
        await tx.cek.update({ where: { id: c.id }, data: { durum: 'ODENDI', paymentId: p.id } });
      }
      const sum = round2(cekler.reduce((s, c) => s + c.tutar, 0));
      await tx.account.update({ where: { id: account.id }, data: { balance: { increment: sum } } });
    });
    await log(req, user, `${cekler.length} çek tahsil edildi — ${account.name}`, { ids, accountId: account.id });
    return NextResponse.json({ ok: true, count: cekler.length });
  }

  // supplier
  if (!body.supplierId) return err('Tedarikçi seçin');
  const supplier = await prisma.supplier.findFirst({ where: { id: body.supplierId, companyId: user.companyId } });
  if (!supplier) return err('Tedarikçi bulunamadı', 404);
  const items: Array<{ id: string; amount: unknown; rate?: unknown }> = Array.isArray(body.items) ? body.items : [];
  const byId = new Map(items.map(i => [i.id, i]));
  const plan: Array<{ cek: typeof cekler[number]; amount: number; rate: number | null }> = [];
  for (const c of cekler) {
    const same = c.currency === supplier.currency;
    const item = byId.get(c.id);
    const amount = same ? round2(c.tutar) : round2(parseAmount(item?.amount));
    if (!(amount > 0)) {
      return err(`${c.seriNo || c.borclu} çeki için ${supplier.currency} karşılığını girin`);
    }
    const rate = same ? null : Math.round((amount / c.tutar) * 1e6) / 1e6; // 1 birim çek dövizi = rate tedarikçi dövizi
    plan.push({ cek: c, amount, rate });
  }
  await prisma.$transaction(async tx => {
    for (const { cek: c, amount, rate } of plan) {
      const p = await tx.payment.create({
        data: {
          companyId: user.companyId,
          type: 'PAID',
          supplierId: supplier.id,
          amount,
          currency: supplier.currency,
          ...(rate != null ? { originalAmount: round2(c.tutar), originalCurrency: c.currency, exchangeRate: rate } : {}),
          date,
          method: 'Çek',
          notes: [c.seriNo ? `Çek No: ${c.seriNo}` : '', c.bankasi ? `Banka: ${c.bankasi}` : '', `Vade: ${formatDate(c.vadesi)}`, c.borclu ? `Sahibi: ${c.borclu}` : '', note].filter(Boolean).join(' | '),
        },
      });
      await tx.cek.update({
        where: { id: c.id },
        data: { durum: 'TEDARIKCI_VERILDI', supplierId: supplier.id, paymentId: p.id, islemTarihi: date, ...(note ? { aciklama: note } : {}) },
      });
    }
  });
  await log(req, user, `${cekler.length} çek tedarikçiye verildi — ${supplier.name}`, { ids, supplierId: supplier.id, total: round2(plan.reduce((s, p) => s + p.amount, 0)), currency: supplier.currency });
  return NextResponse.json({ ok: true, count: cekler.length });
}

async function log(req: NextRequest, user: any, detail: string, meta: Record<string, unknown>) {
  await logAction({ companyId: user.companyId, userId: user.id, userName: user.name, action: 'UPDATE', entity: 'Cek', detail, meta, ip: getIp(req) });
}

// Mükerrer kayıt koruması: aynı içerikli istek kısa süre içinde ikinci kez işlenmez (çift tıklama, iki sekme)
export const POST = duplicateGuarded('cek-bulk', create);
