// Gelen siparişler: onay, üretim durumu, kısmi sevk, irsaliye, mesaj
import { sql } from '../lib.mjs';
export default {
  slug: 'gelen-siparisler',
  title: 'Gelen Siparişler',
  summary: ['Siparişi onaylama ve termin', 'Üretim durumunu güncelleme', 'Kısmi ve son sevkiyat, irsaliye', 'Müşteriyle mesajlaşma'],
  async run(h) {
    const { p } = h;
    // Eğitim için yeni bir sipariş açılır (Ayakkabı Dünyası, portal hesabı var)
    const cust = sql(`select id from "Customer" where name like 'Ayakkabı Dünyası%' limit 1`);
    const prod = sql(`select id from "Product" where code='TBN-001' and "companyId"=(select "companyId" from "User" where email='test@solecost.com') limit 1`);
    const r = await p.request.post('/api/orders', { data: { customerId: cust, productId: prod, color: 'Siyah', sizeDistribution: { '38': 40, '39': 40, '40': 40 }, notes: 'Eğitim siparişi' } });
    const order = await r.json();
    await h.go('/orders', 1800);
    await h.say('Siparişler → Gelen Siparişler: müşterilerinizden, portaldan ve firma ağından gelen tüm siparişler.', 3200);
    await h.say('Sekmeler sipariş durumuna göre ayırır: Bekliyor, Üretimde, Hazır, Sevk Edildi.', 2600);
    await h.go(`/orders/${order.id}`, 1800);
    await h.say('Yeni sipariş "Onay bekliyor" olarak gelir. Termin tarihini girip "Siparişi onayla" deyin; müşteriye bildirim gider.', 2000);
    const d = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
    await h.moveTo(p.getByTestId('confirm-termin')); await p.getByTestId('confirm-termin').fill(d); await h.wait(600);
    await h.click(p.getByTestId('order-confirm'), 2000);
    await h.say('"Durum Güncelle" ile üretim adımlarını işaretleyin: Üretime Girdi, Kalıplama, Boya, Paketleme…', 1200);
    const st = p.locator('form select').first();
    await h.select(st, 'IN_PRODUCTION');
    await h.click(p.getByRole('button', { name: /^Kaydet$/ }).first(), 1800);
    await h.say('Mal hazır olunca "Sevkiyat Ekle". Siparişin bir kısmını gönderiyorsanız "Son sevkiyat" işaretini kaldırın.', 1200);
    await h.click(p.getByTestId('ship-open'), 1000);
    await h.type(h.field('İrsaliye No'), 'IRS-2026-101');
    await h.type(h.field('Taşıyıcı'), 'Aras Kargo');
    await h.click(p.getByTestId('ship-final'), 600);
    await h.type(p.getByTestId('ship-qty').locator('input').first(), '60');
    await h.say('Sevk edilen miktarı yazın; kalan miktar ekranda görünür.', 2000);
    await h.click(p.getByRole('button', { name: /^Kaydet$/ }).last(), 2200);
    await h.point(p.getByTestId('shipment-list'), 1200);
    await h.say('Her sevkiyat listelenir. "İrsaliye" ile sevk irsaliyesini yazdırın ya da PDF kaydedin.', 3000);
    await h.click(p.getByTestId('ship-open'), 1000);
    await h.say('Kalanı gönderirken "Son sevkiyat" işaretli kalsın: sipariş "Sevk Edildi" olur.', 2400);
    await h.click(p.getByRole('button', { name: /^Kaydet$/ }).last(), 2200);
    await h.point(p.getByTestId('order-messages'), 800);
    await h.say('Müşteri portaldan yazarsa mesajı burada görür, yanıtlarsınız; iptal veya değişiklik taleplerini onaylarsınız.', 1000);
    await h.type(p.getByTestId('message-input'), 'Siparişinizin tamamı yola çıktı, iyi satışlar.');
    await h.click(p.getByTestId('message-send'), 1800);
    await h.point(p.getByTestId('koli-open'), 800);
    await h.say('"Koli Etiketi" ve "Satışa Çevir" de bu ekrandan: sevk edilen siparişi tek tıkla faturaya dönüştürün.', 3200);
  },
  recap: ['Onay: termin + Siparişi onayla', 'Durum Güncelle ile üretim takibi', 'Sevkiyat: kısmi / son, irsaliye, mesaj'],
};
