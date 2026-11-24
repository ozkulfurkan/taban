// Ek tanıtım videoları için demo verisi: fason üretim, personel, firma ağı (alıcı firma + bağlantı) ve ekstre linki.
// Kullanım: DATABASE_URL=<demo veritabanı> npx tsx tools/promo-video/demo-data-ek.ts
// Tekrar çalıştırılabilir (sabit kimliklerle upsert). Yalnızca taban_demo'da çalışır.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const day = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * day);

async function main() {
  if (!/taban_demo/.test(process.env.DATABASE_URL ?? '')) throw new Error('Bu betik yalnızca taban_demo veritabanında çalışır');
  const owner = await prisma.user.findFirstOrThrow({ where: { email: 'test@solecost.com' } });
  const cid = owner.companyId!;

  // Hammadde stokları
  const stocks: Record<string, number> = { 'mat-test-1': 1850, 'mat-test-2': 2400, 'mat-test-3': 640, 'mat-test-4': 1250, 'mat-test-5': 85 };
  for (const [id, stock] of Object.entries(stocks)) await prisma.material.update({ where: { id }, data: { stock } });

  // ── Fason
  const subs = [
    { id: 'sub-1', name: 'Usta Kalıp Atölyesi', contactPerson: 'Hasan Usta', phone: '0532 411 22 33', address: 'Bayrampaşa, İstanbul' },
    { id: 'sub-2', name: 'Demir Enjeksiyon', contactPerson: 'Mehmet Demir', phone: '0533 210 45 67', address: 'Gaziosmanpaşa, İstanbul' },
    { id: 'sub-3', name: 'Ege Taban Fason', contactPerson: 'Ali Kaya', phone: '0542 655 78 90', address: 'Torbalı, İzmir' },
  ];
  for (const s of subs) await prisma.subcontractor.upsert({ where: { id: s.id }, create: { ...s, companyId: cid }, update: s });
  const orders = [
    { id: 'so-1', orderNo: 'FSN-2026-0031', subcontractorId: 'sub-1', productId: 'prod-1', status: 'IN_PRODUCTION', due: 6, sizes: { '39': 120, '40': 240, '41': 300, '42': 240, '43': 100 }, done: 560 },
    { id: 'so-2', orderNo: 'FSN-2026-0032', subcontractorId: 'sub-2', productId: 'prod-4', status: 'MATERIAL_SENT', due: 12, sizes: { '40': 200, '41': 300, '42': 300, '43': 200 }, done: 0 },
    { id: 'so-3', orderNo: 'FSN-2026-0029', subcontractorId: 'sub-3', productId: 'prod-2', status: 'COMPLETED', due: -1, sizes: { '39': 100, '40': 150, '41': 150, '42': 100 }, done: 500 },
    { id: 'so-4', orderNo: 'FSN-2026-0026', subcontractorId: 'sub-1', productId: 'prod-5', status: 'RECEIVED', due: -9, sizes: { '28': 150, '29': 150, '30': 200, '31': 150 }, done: 650 },
    { id: 'so-5', orderNo: 'FSN-2026-0033', subcontractorId: 'sub-2', productId: 'prod-3', status: 'PENDING', due: 18, sizes: { '36': 150, '37': 200, '38': 200, '39': 150 }, done: 0 },
  ] as const;
  for (const o of orders) {
    const total = Object.values(o.sizes).reduce((a, b) => a + b, 0);
    const data = {
      companyId: cid, orderNo: o.orderNo, subcontractorId: o.subcontractorId, productId: o.productId, status: o.status as any,
      sizeDistribution: o.sizes, totalPairs: total, dueDate: new Date(Date.now() + o.due * day), notes: 'Kalıp ve hammadde bizden.',
    };
    await prisma.subcontractorOrder.upsert({ where: { id: o.id }, create: { id: o.id, ...data, createdAt: ago(10 - o.due / 3) }, update: data });
    await prisma.productionUpdate.deleteMany({ where: { orderId: o.id } });
    const steps: [string, number | null, string, number][] = [['PENDING', null, 'Sipariş oluşturuldu', 9]];
    if (o.status !== 'PENDING') steps.push(['MATERIAL_SENT', null, 'Hammadde gönderildi', 7]);
    if (['IN_PRODUCTION', 'COMPLETED', 'RECEIVED'].includes(o.status)) steps.push(['IN_PRODUCTION', Math.round(o.done * .4), 'Üretime başlandı', 4]);
    if (o.status === 'IN_PRODUCTION') steps.push(['IN_PRODUCTION', o.done, 'Günlük üretim', 1]);
    if (['COMPLETED', 'RECEIVED'].includes(o.status)) steps.push(['COMPLETED', o.done, 'Üretim tamamlandı', 2]);
    if (o.status === 'RECEIVED') steps.push(['RECEIVED', o.done, 'Mallar teslim alındı', 1]);
    for (const [status, completedPairs, notes, d] of steps) {
      await prisma.productionUpdate.create({ data: { orderId: o.id, status: status as any, completedPairs, notes, updatedBy: 'Hasan Usta', createdAt: ago(d) } });
    }
  }
  await prisma.materialTransfer.deleteMany({ where: { companyId: cid, id: { startsWith: 'mt-' } } });
  await prisma.subcontractorScrap.deleteMany({ where: { companyId: cid, id: { startsWith: 'sc-' } } });
  const transfers = [
    ['mt-1', 'sub-1', 'so-1', 'mat-test-2', 420, 'OUTGOING', 7], ['mt-2', 'sub-1', 'so-1', 'mat-test-5', 12, 'OUTGOING', 7],
    ['mt-3', 'sub-2', 'so-2', 'mat-test-1', 650, 'OUTGOING', 3], ['mt-4', 'sub-3', 'so-3', 'mat-test-4', 380, 'OUTGOING', 8],
    ['mt-5', 'sub-3', 'so-3', 'mat-test-4', 22, 'INCOMING', 2], ['mt-6', 'sub-1', 'so-4', 'mat-test-3', 160, 'OUTGOING', 14],
  ] as const;
  for (const [id, subcontractorId, orderId, materialId, quantity, direction, d] of transfers) {
    await prisma.materialTransfer.create({ data: { id, companyId: cid, subcontractorId, orderId, materialId, quantity, direction: direction as any, transferDate: ago(d), createdAt: ago(d) } });
  }
  await prisma.subcontractorScrap.create({ data: { id: 'sc-1', companyId: cid, orderId: 'so-1', materialId: 'mat-test-2', quantity: 8.5, reason: 'Kalıp ayarı sırasında fire', reportedBy: 'Hasan Usta' } });
  await prisma.subcontractorScrap.create({ data: { id: 'sc-2', companyId: cid, orderId: 'so-3', materialId: 'mat-test-4', quantity: 4.2, reason: 'Çapak', reportedBy: 'Ali Kaya' } });
  await prisma.subcontractorStock.deleteMany({ where: { subcontractorId: { in: subs.map(s => s.id) } } });
  for (const [subcontractorId, materialId, quantity] of [['sub-1', 'mat-test-2', 196], ['sub-1', 'mat-test-5', 5.5], ['sub-2', 'mat-test-1', 650], ['sub-1', 'mat-test-3', 12]] as const) {
    await prisma.subcontractorStock.create({ data: { subcontractorId, materialId, quantity } });
  }

  // ── Personel
  const emps = [
    { id: 'emp-1', name: 'Ahmet Yıldırım', department: 'Üretim', role: 'Enjeksiyon Ustası', salary: 42000, payday: 1, hire: 1460, leave: 9 },
    { id: 'emp-2', name: 'Ayşe Demir', department: 'Muhasebe', role: 'Muhasebe Sorumlusu', salary: 48000, payday: 1, hire: 980, leave: 12 },
    { id: 'emp-3', name: 'Mustafa Kılıç', department: 'Üretim', role: 'Makine Operatörü', salary: 34000, payday: 5, hire: 520, leave: 14 },
    { id: 'emp-4', name: 'Zeynep Arslan', department: 'Satış', role: 'Satış Temsilcisi', salary: 39000, payday: 1, hire: 410, leave: 11 },
    { id: 'emp-5', name: 'Emre Şahin', department: 'Depo', role: 'Depo Sorumlusu', salary: 33000, payday: 5, hire: 300, leave: 14 },
    { id: 'emp-6', name: 'Hatice Çelik', department: 'Kalite', role: 'Kalite Kontrol', salary: 36000, payday: 1, hire: 760, leave: 6 },
  ];
  for (const e of emps) {
    const data = { companyId: cid, name: e.name, department: e.department, role: e.role, salary: e.salary, currency: 'TRY', payday: e.payday, hireDate: ago(e.hire), leaveBalance: e.leave, phone: '0532 000 00 0' + e.id.slice(-1) };
    await prisma.employee.upsert({ where: { id: e.id }, create: { id: e.id, ...data }, update: data });
    await prisma.personnelLedger.deleteMany({ where: { employeeId: e.id } });
    await prisma.personnelLeave.deleteMany({ where: { employeeId: e.id } });
    await prisma.personnelOvertime.deleteMany({ where: { employeeId: e.id } });
    // Son 3 ay maaş hakedişi ve ödemesi, avans
    for (let m = 3; m >= 1; m--) {
      await prisma.personnelLedger.create({ data: { companyId: cid, employeeId: e.id, date: ago(m * 30 + 2), type: 'Hakediş', description: 'Aylık maaş hakedişi', credit: e.salary } });
      await prisma.personnelLedger.create({ data: { companyId: cid, employeeId: e.id, date: ago(m * 30), type: 'Maaş', description: 'Maaş ödemesi', debit: e.salary, account: 'Banka TRY' } });
    }
    await prisma.personnelLedger.create({ data: { companyId: cid, employeeId: e.id, date: ago(2), type: 'Hakediş', description: 'Aylık maaş hakedişi', credit: e.salary } });
  }
  const extra: [string, string, string, number, number, number][] = [
    ['emp-1', 'Avans', 'Avans ödemesi', 5000, 0, 12], ['emp-1', 'Mesai', 'Hafta sonu mesaisi (12 saat)', 0, 3150, 9], ['emp-1', 'Prim', 'Kalıp değişim primi', 0, 2000, 5],
    ['emp-3', 'Avans', 'Avans ödemesi', 3000, 0, 8], ['emp-6', 'Kesinti', 'İzinsiz devamsızlık', 1200, 0, 15],
  ];
  for (const [employeeId, type, description, debit, credit, d] of extra) {
    await prisma.personnelLedger.create({ data: { companyId: cid, employeeId, date: ago(d), type, description, debit, credit, account: debit ? 'Ana Kasa' : null } });
  }
  for (const [employeeId, s, e, type, days, note] of [
    ['emp-1', 40, 36, 'Yıllık', 5, 'Bayram sonrası'], ['emp-6', 20, 13, 'Yıllık', 8, 'Yaz tatili'], ['emp-2', 3, 2, 'Mazeret', 2, 'Taşınma'], ['emp-4', -5, -9, 'Yıllık', 3, 'Planlı izin'],
  ] as const) {
    await prisma.personnelLeave.create({ data: { companyId: cid, employeeId, startDate: ago(s), endDate: ago(e), type, days, note } });
  }
  for (const [employeeId, d, hours, amount] of [['emp-1', 9, 12, 3150], ['emp-1', 23, 6, 1575], ['emp-3', 9, 8, 1700], ['emp-5', 16, 4, 820]] as const) {
    await prisma.personnelOvertime.create({ data: { companyId: cid, employeeId, date: ago(d), hours, amount, note: 'Sipariş yetiştirme' } });
  }

  // ── Firma ağı: alıcı firma (Moda Adım) Yılmaz Taban'a bağlı; siparişlerini doğrudan verir
  const buyer = await prisma.company.upsert({
    where: { id: 'co-modaadim' },
    create: { id: 'co-modaadim', name: 'Moda Adım Ayakkabı Ltd. Şti.', code: 'SC-MODA24', taxId: '6120458812', phone: '0212 555 41 41', address: 'Merter, İstanbul' } as any,
    update: { name: 'Moda Adım Ayakkabı Ltd. Şti.' },
  });
  await prisma.user.upsert({
    where: { email: 'satinalma@modaadim.demo' },
    create: { email: 'satinalma@modaadim.demo', name: 'Selin Aydın', password: await bcrypt.hash('Demo12345', 10), role: 'COMPANY_OWNER', emailVerified: true, companyId: buyer.id, currency: 'TRY' } as any,
    update: { password: await bcrypt.hash('Demo12345', 10), emailVerified: true, companyId: buyer.id },
  });
  const sup = await prisma.supplier.upsert({
    where: { id: 'sup-yilmaz' },
    create: { id: 'sup-yilmaz', companyId: buyer.id, name: 'Yılmaz Taban San. Tic. Ltd.', currency: 'USD', phone: '0212 444 12 34' },
    update: {},
  });
  await prisma.companyLink.upsert({
    where: { buyerCompanyId_sellerCompanyId: { buyerCompanyId: buyer.id, sellerCompanyId: cid } },
    create: { buyerCompanyId: buyer.id, sellerCompanyId: cid, buyerSupplierId: sup.id, sellerCustomerId: 'cust-2', status: 'ACTIVE', respondedAt: ago(20), createdAt: ago(21) },
    update: { status: 'ACTIVE', buyerSupplierId: sup.id, sellerCustomerId: 'cust-2' },
  });

  // ── Ekstre linki (Ayakkabı Dünyası); jeton biçimi gerçek jetonla aynı (43 karakter)
  await prisma.statementShareLink.upsert({
    where: { token: 'demo_ekstre_ayakkabi_dunyasi_xxxxxxxxxxxxxx' },
    create: { companyId: cid, customerId: 'cust-1', token: 'demo_ekstre_ayakkabi_dunyasi_xxxxxxxxxxxxxx', createdById: owner.id, viewCount: 4, lastViewedAt: ago(1) },
    update: { revokedAt: null },
  });
  console.log('ek demo verisi hazır');
}

main().finally(() => prisma.$disconnect());
