import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CID = 'default-company';

// Helper: round to 2 decimals
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  console.log('🌱 Tam test verisi oluşturuluyor...\n');

  // ── Ürün Parçaları ────────────────────────────────────────────────────
  console.log('🔩 Ürün parçaları ekleniyor...');

  const partsByProduct: Record<string, any[]> = {
    'prod-2': [
      { materialId: 'mat-test-4', name: 'PVC Gövde', gramsPerPiece: 200, wasteRate: 6, sortOrder: 0 },
      { materialId: 'mat-test-5', name: 'Renk Katkısı', gramsPerPiece: 10, wasteRate: 3, sortOrder: 1 },
    ],
    'prod-3': [
      { materialId: 'mat-test-3', name: 'EVA Taban', gramsPerPiece: 150, wasteRate: 4, sortOrder: 0 },
      { materialId: 'mat-test-5', name: 'Renk Pigmenti', gramsPerPiece: 6, wasteRate: 2, sortOrder: 1 },
    ],
    'prod-4': [
      { materialId: 'mat-test-2', name: 'TPR Dış Taban', gramsPerPiece: 280, wasteRate: 7, sortOrder: 0 },
      { materialId: 'mat-test-1', name: 'Termo Ara Taban', gramsPerPiece: 180, wasteRate: 5, sortOrder: 1 },
      { materialId: 'mat-test-5', name: 'Renk Masterbatch', gramsPerPiece: 15, wasteRate: 2, sortOrder: 2 },
    ],
    'prod-5': [
      { materialId: 'mat-test-1', name: 'Termo Taban', gramsPerPiece: 120, wasteRate: 5, sortOrder: 0 },
      { materialId: 'mat-test-3', name: 'EVA Orta Taban', gramsPerPiece: 60, wasteRate: 3, sortOrder: 1 },
    ],
  };

  for (const [productId, parts] of Object.entries(partsByProduct)) {
    const existing = await prisma.productPart.findMany({ where: { productId } });
    if (existing.length === 0) {
      await prisma.productPart.createMany({ data: parts.map(p => ({ ...p, productId })) });
    }
  }

  // Ekstra maliyetler diğer ürünlere
  const extrasByProduct: Record<string, any[]> = {
    'prod-2': [{ name: 'Nakliye', amount: 4, currency: 'TRY', sortOrder: 0 }],
    'prod-3': [{ name: 'Ambalaj', amount: 2.5, currency: 'TRY', sortOrder: 0 }],
    'prod-4': [{ name: 'Nakliye', amount: 8, currency: 'TRY', sortOrder: 0 }, { name: 'Kalıp payı', amount: 5, currency: 'TRY', sortOrder: 1 }],
    'prod-5': [{ name: 'Ambalaj', amount: 2, currency: 'TRY', sortOrder: 0 }],
  };
  for (const [productId, extras] of Object.entries(extrasByProduct)) {
    const existing = await prisma.productExtraCost.findMany({ where: { productId } });
    if (existing.length === 0) {
      await prisma.productExtraCost.createMany({ data: extras.map(e => ({ ...e, productId })) });
    }
  }
  console.log('  ✅ Ürün parçaları ve ekstra maliyetler eklendi');

  // ── Hesaplar (Kasalar) ────────────────────────────────────────────────
  console.log('\n🏦 Kasa hesapları oluşturuluyor...');

  const accountsData = [
    { id: 'acc-1', name: 'Ana Kasa', currency: 'TRY', balance: 15000, color: '#10B981' },
    { id: 'acc-2', name: 'Banka TRY', currency: 'TRY', balance: 48500, color: '#3B82F6' },
    { id: 'acc-3', name: 'USD Hesabı', currency: 'USD', balance: 2800, color: '#F59E0B' },
    { id: 'acc-4', name: 'EUR Hesabı', currency: 'EUR', balance: 1650, color: '#8B5CF6' },
    { id: 'acc-5', name: 'Pos Cihazı', currency: 'TRY', balance: 3200, color: '#EF4444' },
    { id: 'acc-6', name: 'Ofis Kasası', currency: 'TRY', balance: 5000, color: '#6B7280' },
    { id: 'acc-7', name: 'İstanbul Şube', currency: 'TRY', balance: 12000, color: '#10B981' },
    { id: 'acc-8', name: 'Bursa Şube', currency: 'TRY', balance: 7800, color: '#3B82F6' },
    { id: 'acc-9', name: 'Yapı Kredi', currency: 'TRY', balance: 22000, color: '#F59E0B' },
    { id: 'acc-10', name: 'Döviz Kasası', currency: 'USD', balance: 5000, color: '#8B5CF6' },
  ];

  for (const acc of accountsData) {
    await prisma.account.upsert({
      where: { id: acc.id },
      update: {},
      create: { ...acc, type: 'Kasa', companyId: CID },
    });
  }
  console.log('  ✅ 10 hesap oluşturuldu');

  // Hesap hareketleri (standalone Para Girişi/Çıkışı)
  const accTxIds = [
    'acc-tx-1', 'acc-tx-2', 'acc-tx-3', 'acc-tx-4', 'acc-tx-5',
    'acc-tx-6', 'acc-tx-7', 'acc-tx-8', 'acc-tx-9', 'acc-tx-10',
  ];
  const existingAccTx = await prisma.payment.findMany({ where: { id: { in: accTxIds } } });
  const existingAccTxIds = new Set(existingAccTx.map(p => p.id));

  const accTxData = [
    { id: 'acc-tx-1', accountId: 'acc-1', type: 'RECEIVED' as const, amount: 15000, method: 'Para Girişi', notes: 'Açılış bakiyesi', date: new Date('2026-01-01') },
    { id: 'acc-tx-2', accountId: 'acc-2', type: 'RECEIVED' as const, amount: 48500, method: 'Para Girişi', notes: 'Açılış bakiyesi', date: new Date('2026-01-01') },
    { id: 'acc-tx-3', accountId: 'acc-3', type: 'RECEIVED' as const, amount: 2800, method: 'Para Girişi', notes: 'Açılış bakiyesi', date: new Date('2026-01-01') },
    { id: 'acc-tx-4', accountId: 'acc-4', type: 'RECEIVED' as const, amount: 1650, method: 'Para Girişi', notes: 'Açılış bakiyesi', date: new Date('2026-01-01') },
    { id: 'acc-tx-5', accountId: 'acc-5', type: 'RECEIVED' as const, amount: 3200, method: 'Para Girişi', notes: 'Açılış bakiyesi', date: new Date('2026-01-01') },
    { id: 'acc-tx-6', accountId: 'acc-1', type: 'PAID' as const, amount: 2000, method: 'Para Çıkışı', notes: 'Kira ödemesi Ocak', date: new Date('2026-01-05') },
    { id: 'acc-tx-7', accountId: 'acc-2', type: 'PAID' as const, amount: 5000, method: 'Havale/EFT', notes: 'Fatura ödemesi', date: new Date('2026-01-10') },
    { id: 'acc-tx-8', accountId: 'acc-3', type: 'RECEIVED' as const, amount: 500, method: 'Para Girişi', notes: 'USD alımı', date: new Date('2026-01-15') },
    { id: 'acc-tx-9', accountId: 'acc-1', type: 'RECEIVED' as const, amount: 3000, method: 'Para Girişi', notes: 'Nakit tahsilat', date: new Date('2026-02-01') },
    { id: 'acc-tx-10', accountId: 'acc-6', type: 'RECEIVED' as const, amount: 5000, method: 'Para Girişi', notes: 'Açılış bakiyesi', date: new Date('2026-01-01') },
  ];

  for (const tx of accTxData) {
    if (!existingAccTxIds.has(tx.id)) {
      await prisma.payment.create({ data: { ...tx, currency: 'TRY', companyId: CID } });
    }
  }
  console.log('  ✅ Hesap hareketleri eklendi');

  // ── Satış Faturaları ─────────────────────────────────────────────────
  console.log('\n📄 Satış faturaları oluşturuluyor...');

  // Helper: invoice total from items
  const makeInvoiceItems = (items: { desc: string; qty: number; price: number; disc?: number }[], vatRate: number) => {
    const rows = items.map(i => {
      const tutar = i.qty * i.price;
      const indirim = tutar * (i.disc ?? 0) / 100;
      const net = tutar - indirim;
      return { description: i.desc, quantity: i.qty, unitPrice: i.price, discount: i.disc ?? 0, total: r2(net) };
    });
    const subtotal = r2(rows.reduce((s, r) => s + r.total, 0));
    const vatAmount = r2(subtotal * vatRate / 100);
    const total = r2(subtotal + vatAmount);
    return { rows, subtotal, vatAmount, total };
  };

  const invoicesRaw = [
    { id: 'inv-1', customerId: 'cust-1', invoiceNo: 'FTR-2026-001', date: new Date('2026-01-05'), dueDate: new Date('2026-02-05'), currency: 'TRY', vatRate: 20, items: [{ desc: 'Campus Taban', qty: 50, price: 96.25 }, { desc: 'Kargo', qty: 1, price: 150 }], paidFull: true, payMethod: 'Havale/EFT', accountId: 'acc-2' },
    { id: 'inv-2', customerId: 'cust-2', invoiceNo: 'FTR-2026-002', date: new Date('2026-01-10'), dueDate: new Date('2026-02-10'), currency: 'USD', vatRate: 0, items: [{ desc: 'Campus Taban', qty: 100, price: 2.5 }], paidFull: false, partialPct: 0.5, payMethod: 'Havale/EFT', accountId: 'acc-3' },
    { id: 'inv-3', customerId: 'cust-3', invoiceNo: 'FTR-2026-003', date: new Date('2026-01-15'), dueDate: new Date('2026-02-15'), currency: 'EUR', vatRate: 0, items: [{ desc: 'Sandalet Tabanı', qty: 200, price: 1.1 }], paidFull: false, partialPct: 0, payMethod: 'Nakit', accountId: 'acc-1' },
    { id: 'inv-4', customerId: 'cust-4', invoiceNo: 'FTR-2026-004', date: new Date('2026-01-20'), dueDate: new Date('2026-02-20'), currency: 'TRY', vatRate: 20, items: [{ desc: 'Bot Tabanı Heavy', qty: 30, price: 161.7 }, { desc: 'Klasik Deri Taban', qty: 20, price: 69.3, disc: 5 }], paidFull: true, payMethod: 'Nakit', accountId: 'acc-1' },
    { id: 'inv-5', customerId: 'cust-5', invoiceNo: 'FTR-2026-005', date: new Date('2026-01-25'), dueDate: new Date('2026-02-25'), currency: 'USD', vatRate: 0, items: [{ desc: 'Çocuk Taban Mini', qty: 150, price: 1.5 }], paidFull: false, partialPct: 0.3, payMethod: 'Kredi Kartı', accountId: 'acc-5' },
    { id: 'inv-6', customerId: 'cust-1', invoiceNo: 'FTR-2026-006', date: new Date('2026-02-01'), dueDate: new Date('2026-03-01'), currency: 'TRY', vatRate: 20, items: [{ desc: 'Campus Taban', qty: 80, price: 96.25 }, { desc: 'Sandalet Tabanı', qty: 40, price: 46.2 }], paidFull: false, partialPct: 0, payMethod: 'Nakit', accountId: 'acc-1' },
    { id: 'inv-7', customerId: 'cust-2', invoiceNo: 'FTR-2026-007', date: new Date('2026-02-10'), dueDate: new Date('2026-03-10'), currency: 'USD', vatRate: 0, items: [{ desc: 'Klasik Deri Taban', qty: 60, price: 1.8 }], paidFull: true, payMethod: 'Havale/EFT', accountId: 'acc-3' },
    { id: 'inv-8', customerId: 'cust-3', invoiceNo: 'FTR-2026-008', date: new Date('2026-02-15'), dueDate: new Date('2026-03-15'), currency: 'EUR', vatRate: 0, items: [{ desc: 'Bot Tabanı Heavy', qty: 25, price: 4.1 }], paidFull: false, partialPct: 0.6, payMethod: 'Havale/EFT', accountId: 'acc-4' },
    { id: 'inv-9', customerId: 'cust-4', invoiceNo: 'FTR-2026-009', date: new Date('2026-02-20'), dueDate: new Date('2026-03-20'), currency: 'TRY', vatRate: 20, items: [{ desc: 'Çocuk Taban Mini', qty: 120, price: 57.75 }], paidFull: false, partialPct: 0, payMethod: 'Nakit', accountId: 'acc-1' },
    { id: 'inv-10', customerId: 'cust-5', invoiceNo: 'FTR-2026-010', date: new Date('2026-03-01'), dueDate: new Date('2026-04-01'), currency: 'USD', vatRate: 0, items: [{ desc: 'Campus Taban', qty: 80, price: 2.5 }, { desc: 'Çocuk Taban Mini', qty: 50, price: 1.5, disc: 10 }], paidFull: true, payMethod: 'Kredi Kartı', accountId: 'acc-5' },
  ];

  for (const inv of invoicesRaw) {
    const existing = await prisma.invoice.findFirst({ where: { id: inv.id } });
    if (existing) continue;

    const { rows, subtotal, vatAmount, total } = makeInvoiceItems(inv.items, inv.vatRate);
    const paidAmount = inv.paidFull ? total : r2(total * (inv.partialPct ?? 0));
    const status = paidAmount >= total ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING';

    const invoice = await prisma.invoice.create({
      data: {
        id: inv.id,
        companyId: CID,
        customerId: inv.customerId,
        invoiceNo: inv.invoiceNo,
        date: inv.date,
        dueDate: inv.dueDate,
        currency: inv.currency,
        subtotal,
        vatRate: inv.vatRate,
        vatAmount,
        total,
        paidAmount,
        status: status as any,
        items: { create: rows },
      },
    });

    // Create payment if paidAmount > 0
    if (paidAmount > 0) {
      await prisma.payment.create({
        data: {
          companyId: CID,
          type: 'RECEIVED',
          customerId: inv.customerId,
          invoiceId: invoice.id,
          accountId: inv.accountId,
          amount: paidAmount,
          currency: inv.currency,
          date: new Date(inv.date.getTime() + 3 * 24 * 60 * 60 * 1000),
          method: inv.payMethod,
          notes: `${inv.invoiceNo} tahsilatı`,
        },
      });
    }
  }
  console.log('  ✅ 10 satış faturası oluşturuldu');

  // ── Alış Faturaları ──────────────────────────────────────────────────
  console.log('\n📦 Alış faturaları oluşturuluyor...');

  const purchasesData = [
    { id: 'pur-1', supplierId: 'supp-1', invoiceNo: 'ALI-2026-001', date: new Date('2026-01-03'), currency: 'USD', total: 200, paidFull: true, payMethod: 'Havale/EFT', accountId: 'acc-3' },
    { id: 'pur-2', supplierId: 'supp-2', invoiceNo: 'ALI-2026-002', date: new Date('2026-01-08'), currency: 'USD', total: 105, paidFull: false, partialPct: 0.5, payMethod: 'Nakit', accountId: 'acc-1' },
    { id: 'pur-3', supplierId: 'supp-3', invoiceNo: 'ALI-2026-003', date: new Date('2026-01-12'), currency: 'USD', total: 104, paidFull: false, partialPct: 0, payMethod: 'Nakit', accountId: 'acc-1' },
    { id: 'pur-4', supplierId: 'supp-4', invoiceNo: 'ALI-2026-004', date: new Date('2026-01-18'), currency: 'USD', total: 208, paidFull: true, payMethod: 'Havale/EFT', accountId: 'acc-3' },
    { id: 'pur-5', supplierId: 'supp-5', invoiceNo: 'ALI-2026-005', date: new Date('2026-01-22'), currency: 'TRY', total: 6468, paidFull: false, partialPct: 0.4, payMethod: 'Havale/EFT', accountId: 'acc-2' },
    { id: 'pur-6', supplierId: 'supp-1', invoiceNo: 'ALI-2026-006', date: new Date('2026-02-03'), currency: 'USD', total: 80, paidFull: true, payMethod: 'Nakit', accountId: 'acc-1' },
    { id: 'pur-7', supplierId: 'supp-2', invoiceNo: 'ALI-2026-007', date: new Date('2026-02-08'), currency: 'USD', total: 320, paidFull: false, partialPct: 0, payMethod: 'Havale/EFT', accountId: 'acc-3' },
    { id: 'pur-8', supplierId: 'supp-3', invoiceNo: 'ALI-2026-008', date: new Date('2026-02-14'), currency: 'USD', total: 87.5, paidFull: true, payMethod: 'Nakit', accountId: 'acc-1' },
    { id: 'pur-9', supplierId: 'supp-4', invoiceNo: 'ALI-2026-009', date: new Date('2026-02-20'), currency: 'TRY', total: 5082, paidFull: false, partialPct: 0.6, payMethod: 'Havale/EFT', accountId: 'acc-2' },
    { id: 'pur-10', supplierId: 'supp-5', invoiceNo: 'ALI-2026-010', date: new Date('2026-03-02'), currency: 'USD', total: 140, paidFull: false, partialPct: 0, payMethod: 'Nakit', accountId: 'acc-1' },
  ];

  for (const pur of purchasesData) {
    const existing = await prisma.purchase.findFirst({ where: { id: pur.id } });
    if (existing) continue;

    const paidAmount = pur.paidFull ? pur.total : r2(pur.total * (pur.partialPct ?? 0));
    const status = paidAmount >= pur.total ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING';

    const purchase = await prisma.purchase.create({
      data: {
        id: pur.id,
        companyId: CID,
        supplierId: pur.supplierId,
        invoiceNo: pur.invoiceNo,
        date: pur.date,
        currency: pur.currency,
        total: pur.total,
        paidAmount,
        status: status as any,
      },
    });

    if (paidAmount > 0) {
      await prisma.payment.create({
        data: {
          companyId: CID,
          type: 'PAID',
          supplierId: pur.supplierId,
          purchaseId: purchase.id,
          accountId: pur.accountId,
          amount: paidAmount,
          currency: pur.currency,
          date: new Date(pur.date.getTime() + 2 * 24 * 60 * 60 * 1000),
          method: pur.payMethod,
          notes: `${pur.invoiceNo} ödemesi`,
        },
      });
    }
  }
  console.log('  ✅ 10 alış faturası oluşturuldu');

  // ── Çekler ───────────────────────────────────────────────────────────
  console.log('\n📝 Çekler oluşturuluyor...');

  const ceklerData = [
    { id: 'cek-1', customerId: 'cust-1', borclu: 'Ayakkabı Dünyası A.Ş.', islem: 'Müşteriden Alınan Çek', aciklama: 'Ocak tahsilatı', islemTarihi: new Date('2026-01-05'), vadesi: new Date('2026-03-05'), tutar: 5000, currency: 'TRY', seriNo: 'A001234', bankasi: 'Ziraat Bankası', durum: 'PORTFOY' },
    { id: 'cek-2', customerId: 'cust-2', borclu: 'Moda Adım Ltd.', islem: 'Müşteriden Alınan Çek', aciklama: 'Şubat vadeli', islemTarihi: new Date('2026-01-10'), vadesi: new Date('2026-04-10'), tutar: 3500, currency: 'TRY', seriNo: 'B005678', bankasi: 'Garanti BBVA', durum: 'BANKAYA_VERILDI' },
    { id: 'cek-3', customerId: 'cust-4', borclu: 'Yıldız Spor Mağazaları', islem: 'Müşteriden Alınan Çek', aciklama: 'Mart vadeli', islemTarihi: new Date('2026-01-20'), vadesi: new Date('2026-03-20'), tutar: 8000, currency: 'TRY', seriNo: 'C009012', bankasi: 'İş Bankası', durum: 'ODENDI' },
    { id: 'cek-4', customerId: 'cust-1', borclu: 'Ayakkabı Dünyası A.Ş.', islem: 'Müşteriden Alınan Çek', aciklama: 'Nisan vadeli', islemTarihi: new Date('2026-02-01'), vadesi: new Date('2026-04-30'), tutar: 12000, currency: 'TRY', seriNo: 'D003456', bankasi: 'Akbank', durum: 'PORTFOY' },
    { id: 'cek-5', customerId: 'cust-5', borclu: 'Comfort Walk LLC', islem: 'Müşteriden Alınan Çek', aciklama: 'Mayıs vadeli', islemTarihi: new Date('2026-02-10'), vadesi: new Date('2026-05-10'), tutar: 6500, currency: 'TRY', seriNo: 'E007890', bankasi: 'Yapı Kredi', durum: 'PORTFOY' },
    { id: 'cek-6', supplierId: 'supp-1', borclu: 'PoliKimya Hammadde A.Ş.', islem: 'Tedarikçiye Verilen Çek', aciklama: 'Ocak alımı ödemesi', islemTarihi: new Date('2026-01-15'), vadesi: new Date('2026-02-15'), tutar: 7700, currency: 'TRY', seriNo: 'F001111', bankasi: 'Ziraat Bankası', durum: 'TEDARIKCI_VERILDI' },
    { id: 'cek-7', supplierId: 'supp-2', borclu: 'Termo Plastik San.', islem: 'Tedarikçiye Verilen Çek', aciklama: 'Şubat alımı', islemTarihi: new Date('2026-01-25'), vadesi: new Date('2026-03-25'), tutar: 4042, currency: 'TRY', seriNo: 'G002222', bankasi: 'Garanti BBVA', durum: 'TEDARIKCI_VERILDI' },
    { id: 'cek-8', customerId: 'cust-3', borclu: 'Euro Steps GmbH', islem: 'Müşteriden Alınan Çek', aciklama: 'Ödeme çeki', islemTarihi: new Date('2026-02-05'), vadesi: new Date('2026-06-05'), tutar: 2800, currency: 'TRY', seriNo: 'H003333', bankasi: 'ING Bank', durum: 'KARSILIKS' },
    { id: 'cek-9', supplierId: 'supp-3', borclu: 'RubberMax Kauçuk', islem: 'Tedarikçiye Verilen Çek', aciklama: 'Mart vadeli ödeme', islemTarihi: new Date('2026-02-20'), vadesi: new Date('2026-03-31'), tutar: 3367.5, currency: 'TRY', seriNo: 'I004444', bankasi: 'İş Bankası', durum: 'ODENDI' },
    { id: 'cek-10', customerId: 'cust-2', borclu: 'Moda Adım Ltd.', islem: 'Müşteriden Alınan Çek', aciklama: 'Son çek', islemTarihi: new Date('2026-03-01'), vadesi: new Date('2026-06-30'), tutar: 9000, currency: 'TRY', seriNo: 'J005555', bankasi: 'Akbank', durum: 'PORTFOY' },
  ];

  for (const cek of ceklerData) {
    await prisma.cek.upsert({
      where: { id: cek.id },
      update: {},
      create: { ...cek, companyId: CID, durum: cek.durum as any },
    });
  }
  console.log('  ✅ 10 çek oluşturuldu');

  // ── Maliyet Hesaplamaları ─────────────────────────────────────────────
  console.log('\n🧮 Maliyet hesaplamaları oluşturuluyor...');

  // Find admin user for calculations
  const adminUser = await prisma.user.findFirst({ where: { companyId: CID } });
  if (!adminUser) throw new Error('Kullanıcı bulunamadı');

  const calcsData = [
    { id: 'calc-1', name: 'Campus Taban v1.2', currency: 'USD', profitMargin: 20, vatRate: 20, laborCostPerPair: 0.52, paintCost: 0.05 },
    { id: 'calc-2', name: 'Bot Tabanı Heavy Rev.3', currency: 'USD', profitMargin: 25, vatRate: 20, laborCostPerPair: 0.65, paintCost: 0.08 },
    { id: 'calc-3', name: 'Sandalet EVA Taban', currency: 'USD', profitMargin: 15, vatRate: 20, laborCostPerPair: 0.31, paintCost: 0.03 },
    { id: 'calc-4', name: 'Klasik PVC Taban', currency: 'USD', profitMargin: 18, vatRate: 20, laborCostPerPair: 0.39, paintCost: 0.04 },
    { id: 'calc-5', name: 'Çocuk Termo Taban', currency: 'USD', profitMargin: 22, vatRate: 20, laborCostPerPair: 0.26, paintCost: 0.02 },
  ];

  const calcPartsMap: Record<string, any[]> = {
    'calc-1': [
      { materialId: 'mat-test-1', partName: 'Gövde', grossWeight: 194.4, wasteRate: 8, netWeight: 180, cost: 0.72 },
      { materialId: 'mat-test-2', partName: 'Dış Taban', grossWeight: 126, wasteRate: 5, netWeight: 120, cost: 0.42 },
    ],
    'calc-2': [
      { materialId: 'mat-test-2', partName: 'TPR Dış', grossWeight: 299.6, wasteRate: 7, netWeight: 280, cost: 0.98 },
      { materialId: 'mat-test-1', partName: 'Ara Taban', grossWeight: 189, wasteRate: 5, netWeight: 180, cost: 0.72 },
    ],
    'calc-3': [
      { materialId: 'mat-test-3', partName: 'EVA Taban', grossWeight: 156, wasteRate: 4, netWeight: 150, cost: 0.78 },
    ],
    'calc-4': [
      { materialId: 'mat-test-4', partName: 'PVC Gövde', grossWeight: 212, wasteRate: 6, netWeight: 200, cost: 0.56 },
    ],
    'calc-5': [
      { materialId: 'mat-test-1', partName: 'Termo', grossWeight: 126, wasteRate: 5, netWeight: 120, cost: 0.48 },
      { materialId: 'mat-test-3', partName: 'Orta Taban', grossWeight: 61.8, wasteRate: 3, netWeight: 60, cost: 0.31 },
    ],
  };

  for (const c of calcsData) {
    const existing = await prisma.soleCalculation.findFirst({ where: { id: c.id } });
    if (existing) continue;

    const parts = calcPartsMap[c.id] || [];
    const totalMaterialCost = r2(parts.reduce((s: number, p: any) => s + p.cost, 0));
    const totalCost = r2(totalMaterialCost + c.laborCostPerPair + c.paintCost);
    const sellingPrice = r2(totalCost * (1 + c.profitMargin / 100));
    const sellingPriceWithVat = r2(sellingPrice * (1 + c.vatRate / 100));

    await prisma.soleCalculation.create({
      data: {
        id: c.id,
        companyId: CID,
        userId: adminUser.id,
        name: c.name,
        currency: c.currency,
        laborMethod: 'direct',
        laborCurrency: c.currency,
        laborCostPerPair: c.laborCostPerPair,
        paintCost: c.paintCost,
        profitMargin: c.profitMargin,
        vatRate: c.vatRate,
        totalMaterialCost,
        totalCost,
        sellingPrice,
        sellingPriceWithVat,
        parts: {
          create: parts.map((p: any) => ({
            materialId: p.materialId,
            partName: p.partName,
            grossWeight: p.grossWeight,
            wasteRate: p.wasteRate,
            netWeight: p.netWeight,
            cost: p.cost,
          })),
        },
      },
    });
  }
  console.log('  ✅ 5 maliyet hesaplaması oluşturuldu');

  // ── Özet ────────────────────────────────────────────────────────────
  console.log('\n📊 Veritabanı özeti:');
  const counts = await Promise.all([
    prisma.customer.count({ where: { companyId: CID } }),
    prisma.supplier.count({ where: { companyId: CID } }),
    prisma.material.count({ where: { companyId: CID } }),
    prisma.product.count({ where: { companyId: CID } }),
    prisma.productPart.count({ where: { product: { companyId: CID } } }),
    prisma.invoice.count({ where: { companyId: CID } }),
    prisma.purchase.count({ where: { companyId: CID } }),
    prisma.payment.count({ where: { companyId: CID } }),
    prisma.cek.count({ where: { companyId: CID } }),
    prisma.account.count({ where: { companyId: CID } }),
    prisma.soleCalculation.count({ where: { companyId: CID } }),
  ]);
  const labels = ['Müşteri', 'Tedarikçi', 'Hammadde', 'Ürün', 'Ürün Parçası', 'Fatura', 'Alış', 'Ödeme', 'Çek', 'Hesap', 'Hesaplama'];
  labels.forEach((l, i) => console.log(`  ${l.padEnd(14)}: ${counts[i]}`));

  console.log('\n🎉 Tüm test verisi başarıyla oluşturuldu!');
}

main()
  .catch(e => { console.error('❌ Hata:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
