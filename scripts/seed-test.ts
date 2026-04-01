import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Test verisi oluşturuluyor...');

  // Şirketi bul veya oluştur
  let company = await prisma.company.findFirst({ where: { id: 'default-company' } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        id: 'default-company',
        name: 'SoleCost Demo',
        subscriptionStatus: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        usdToTry: 38.5,
        eurToTry: 42.0,
        vatRate: 20,
      },
    });
  } else {
    // Kur bilgilerini güncelle
    await prisma.company.update({
      where: { id: 'default-company' },
      data: { usdToTry: 38.5, eurToTry: 42.0, vatRate: 20 },
    });
  }

  // Test kullanıcısı oluştur
  const testPassword = await bcrypt.hash('test123', 12);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@solecost.com' },
    update: { password: testPassword },
    create: {
      email: 'test@solecost.com',
      name: 'Test Kullanıcı',
      password: testPassword,
      role: 'EDITOR',
      companyId: company.id,
      language: 'tr',
      currency: 'USD',
    },
  });
  console.log(`✅ Kullanıcı: ${testUser.email} / test123`);

  // ── Müşteriler ───────────────────────────────────────────────────────
  const customersData = [
    { id: 'cust-1', name: 'Ayakkabı Dünyası A.Ş.', taxId: '1234567890', taxOffice: 'Bağcılar', phone: '0212 555 1001', email: 'siparis@ayakkabidunya.com', address: 'Bağcılar, İstanbul', currency: 'TRY' },
    { id: 'cust-2', name: 'Moda Adım Ltd. Şti.', taxId: '9876543210', taxOffice: 'Kadıköy', phone: '0216 444 2002', email: 'info@modaadim.com', address: 'Kadıköy, İstanbul', currency: 'USD' },
    { id: 'cust-3', name: 'Euro Steps GmbH', taxId: 'DE123456789', taxOffice: 'Berlin', phone: '+49 30 555 3003', email: 'order@eurosteps.de', address: 'Berlin, Almanya', currency: 'EUR' },
    { id: 'cust-4', name: 'Yıldız Spor Mağazaları', taxId: '5544332211', taxOffice: 'Şişli', phone: '0212 333 4004', email: 'temin@yildizspor.com.tr', address: 'Şişli, İstanbul', currency: 'TRY' },
    { id: 'cust-5', name: 'Comfort Walk LLC', taxId: 'US-987654', taxOffice: 'New York', phone: '+1 212 555 5005', email: 'buy@comfortwalk.com', address: 'New York, ABD', currency: 'USD' },
  ];

  for (const c of customersData) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, companyId: company.id },
    });
  }
  console.log(`✅ 5 müşteri oluşturuldu`);

  // ── Tedarikçiler ──────────────────────────────────────────────────────
  const suppliersData = [
    { id: 'supp-1', name: 'PoliKimya Hammadde A.Ş.', taxId: '1122334455', phone: '0212 600 1001', email: 'satis@polikimya.com', address: 'İkitelli OSB, İstanbul' },
    { id: 'supp-2', name: 'Termo Plastik San. Ltd.', taxId: '5566778899', phone: '0224 700 2002', email: 'info@termoplastik.com', address: 'Nilüfer OSB, Bursa' },
    { id: 'supp-3', name: 'RubberMax Kauçuk', taxId: '9988776655', phone: '0332 800 3003', email: 'satis@rubbermax.com.tr', address: 'Konya OSB, Konya' },
    { id: 'supp-4', name: 'FoamTech EVA Köpük', taxId: '4433221100', phone: '0242 900 4004', email: 'order@foamtech.com', address: 'Antalya OSB, Antalya' },
    { id: 'supp-5', name: 'Kimya Depot Dış Tic.', taxId: '6677889900', phone: '0216 500 5005', email: 'import@kimdepot.com', address: 'Tuzla, İstanbul' },
  ];

  for (const s of suppliersData) {
    await prisma.supplier.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, companyId: company.id },
    });
  }
  console.log(`✅ 5 tedarikçi oluşturuldu`);

  // ── Hammaddeler ───────────────────────────────────────────────────────
  const materialsData = [
    { id: 'mat-test-1', name: 'Termo Hammadde', supplier: 'Termo Plastik San. Ltd.', pricePerKg: 4.0, currency: 'USD', description: 'Standart termoplastik hammadde' },
    { id: 'mat-test-2', name: 'TPR Granül', supplier: 'RubberMax Kauçuk', pricePerKg: 3.5, currency: 'USD', description: 'Termoplastik kauçuk granül' },
    { id: 'mat-test-3', name: 'EVA Köpük', supplier: 'FoamTech EVA Köpük', pricePerKg: 5.2, currency: 'USD', description: 'Etilen-vinil asetat köpük' },
    { id: 'mat-test-4', name: 'PVC Bileşiği', supplier: 'PoliKimya Hammadde A.Ş.', pricePerKg: 2.8, currency: 'USD', description: 'PVC taban bileşiği' },
    { id: 'mat-test-5', name: 'Renk Masterbatch', supplier: 'Kimya Depot Dış Tic.', pricePerKg: 8.0, currency: 'USD', description: 'Renklendiriciler için masterbatch' },
  ];

  for (const m of materialsData) {
    await prisma.material.upsert({
      where: { id: m.id },
      update: { pricePerKg: m.pricePerKg },
      create: { ...m, companyId: company.id },
    });
  }
  console.log(`✅ 5 hammadde oluşturuldu`);

  // ── Ürünler ───────────────────────────────────────────────────────────
  const productsData = [
    {
      id: 'prod-1', code: 'TBN-001', name: 'Campus Taban', description: 'Standart spor ayakkabı tabanı',
      unit: 'çift', unitPrice: 2.50, currency: 'USD', stock: 1940,
      laborCostPerPair: 20, laborCurrency: 'TRY', ciftPerKoli: 24, koliFiyati: 45, koliCurrency: 'TRY',
    },
    {
      id: 'prod-2', code: 'TBN-002', name: 'Klasik Deri Taban', description: 'Klasik kundura için PVC taban',
      unit: 'çift', unitPrice: 1.80, currency: 'USD', stock: 850,
      laborCostPerPair: 15, laborCurrency: 'TRY', ciftPerKoli: 36, koliFiyati: 35, koliCurrency: 'TRY',
    },
    {
      id: 'prod-3', code: 'TBN-003', name: 'Sandalet Tabanı', description: 'Yaz sandalet EVA tabanı',
      unit: 'çift', unitPrice: 1.20, currency: 'USD', stock: 620,
      laborCostPerPair: 12, laborCurrency: 'TRY', ciftPerKoli: 48, koliFiyati: 28, koliCurrency: 'TRY',
    },
    {
      id: 'prod-4', code: 'TBN-004', name: 'Bot Tabanı Heavy', description: 'Ağır hizmet bot tabanı TPR',
      unit: 'çift', unitPrice: 4.20, currency: 'USD', stock: 320,
      laborCostPerPair: 25, laborCurrency: 'TRY', ciftPerKoli: 12, koliFiyati: 55, koliCurrency: 'TRY',
    },
    {
      id: 'prod-5', code: 'TBN-005', name: 'Çocuk Taban Mini', description: 'Çocuk ayakkabısı kauçuk taban',
      unit: 'çift', unitPrice: 1.50, currency: 'USD', stock: 1200,
      laborCostPerPair: 10, laborCurrency: 'TRY', ciftPerKoli: 60, koliFiyati: 22, koliCurrency: 'TRY',
    },
  ];

  for (const p of productsData) {
    const { id, ...productFields } = p;
    await prisma.product.upsert({
      where: { id },
      update: {},
      create: { id, ...productFields, companyId: company.id },
    });
  }
  console.log(`✅ 5 ürün oluşturuldu`);

  // Campus Taban için parçalar ekle (örnek)
  const existingParts = await prisma.productPart.findMany({ where: { productId: 'prod-1' } });
  if (existingParts.length === 0) {
    await prisma.productPart.createMany({
      data: [
        { productId: 'prod-1', materialId: 'mat-test-1', name: 'Alt Taban Gövde', gramsPerPiece: 180, wasteRate: 8, sortOrder: 0 },
        { productId: 'prod-1', materialId: 'mat-test-2', name: 'Dış Taban', gramsPerPiece: 120, wasteRate: 5, sortOrder: 1 },
        { productId: 'prod-1', materialId: 'mat-test-5', name: 'Renk Pigmenti', gramsPerPiece: 8, wasteRate: 2, sortOrder: 2 },
      ],
    });
    console.log(`✅ Campus Taban parçaları eklendi`);
  }

  // Ekstra maliyetler (Campus Taban)
  const existingExtras = await prisma.productExtraCost.findMany({ where: { productId: 'prod-1' } });
  if (existingExtras.length === 0) {
    await prisma.productExtraCost.createMany({
      data: [
        { productId: 'prod-1', name: 'Nakliye', amount: 5, currency: 'TRY', sortOrder: 0 },
        { productId: 'prod-1', name: 'Ambalaj', amount: 3, currency: 'TRY', sortOrder: 1 },
      ],
    });
    console.log(`✅ Ekstra maliyetler eklendi`);
  }

  console.log('\n🎉 Test verisi başarıyla oluşturuldu!\n');
  console.log('═══════════════════════════════════════');
  console.log('  Giriş Bilgileri:');
  console.log('  E-posta : test@solecost.com');
  console.log('  Şifre   : test123');
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
