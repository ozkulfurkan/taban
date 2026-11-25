// Fason üretim: fasoncu, fason siparişi, hammadde gönderme, teslim alma
export default {
  slug: 'fason',
  title: 'Fason Üretim',
  summary: ['Fasoncu kaydı ve portal hesabı', 'Fason siparişi oluşturma', 'Fasoncuya hammadde gönderme', 'Üretimi teslim alma'],
  async run(h) {
    const { p } = h;
    await h.go('/subcontractors', 1800);
    await h.say('Operasyonlar → Fasoncular: dışarıda üretim yaptırdığınız atölyeler.', 2800);
    await h.say('Fasoncuya "Portal Hesabı Oluştur" ile kendi ekranını açarsanız üretim ilerlemesini kendisi girer.', 3200);
    await h.go('/subcontractor-orders/new', 1800);
    await h.say('Fason Siparişleri → Yeni Sipariş: 4 adımda fasoncuya iş verin.', 1000);
    const sel = p.locator('select');
    const sopt = await sel.nth(0).locator('option').evaluateAll(os => os.find(o => o.value)?.value);
    await h.select(sel.nth(0), sopt);
    const popt = await sel.nth(1).locator('option').evaluateAll(os => os.find(o => o.value)?.value);
    if (popt) await h.select(sel.nth(1), popt);
    await h.click(p.getByRole('button', { name: /Sonraki/ }).first(), 1200);
    await h.say('Numara dağılımını girin: hangi numaradan kaç çift üretilecek.', 600);
    const sz = p.locator('table input, input[placeholder="0"]');
    await h.type(sz.nth(2), '50'); await h.type(sz.nth(3), '50');
    await h.click(p.getByRole('button', { name: /Sonraki/ }).first(), 1500);
    await h.say('Gerekli hammadde, ürün reçetesinden kg olarak hesaplanır.', 2600);
    await h.click(p.getByRole('button', { name: /Sonraki/ }).first(), 1200);
    await h.say('Termin ve sevk adresini yazıp "Siparişi Oluştur" deyin.', 1200);
    await h.click(p.getByRole('button', { name: /Siparişi Oluştur/ }).first(), 2500);
    await h.go('/subcontractor-orders', 1800);
    await h.say('Fason Siparişleri listesinde tüm işler termin ve ilerleme durumuyla görünür.', 2600);
    await h.click(p.locator('a[href^="/subcontractor-orders/c"]').first(), 2000);
    await h.say('Sipariş detayında "Hammadde Gönder" ile malzemeyi fasoncunun zimmetine aktarırsınız.', 3000);
    await h.scroll(500, 1200);
    await h.say('Üretilen çiftler gelince "Teslim Al ve Stoğa Ekle": ürün stoğunuza girer, fire ve zimmet düşer.', 3400);
  },
  recap: ['Fasoncular → fasoncu ve portal hesabı', 'Fason Siparişleri → Yeni Sipariş (4 adım)', 'Hammadde Gönder → Teslim Al ve Stoğa Ekle'],
};
