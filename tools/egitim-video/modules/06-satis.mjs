// Satış faturası ve satış iadesi
import { sql } from '../lib.mjs';
export default {
  slug: 'satis',
  title: 'Satış ve Satış İadesi',
  summary: ['Müşteri kartından yeni satış', 'Katalogdan ürün ve adet seçme', 'Stok düşümü onayı', 'İade faturası'],
  async run(h) {
    const { p } = h;
    const cust = sql(`select id from "Customer" where name like 'Yıldız Spor%' limit 1`);
    await h.go(`/customers/${cust}`);
    await h.say('Satış yapmak için müşterinin kartını açıp "Yeni Satış"a tıklayın.', 1400);
    await h.click(p.getByRole('link', { name: /Yeni Satış/ }).first(), 1800);
    await h.say('Müşteri hazır gelir. Belge numarası otomatik verilir; tarih ve para birimini kontrol edin.', 3000);
    const search = p.getByPlaceholder(/Ürün adı, kodu veya barkod/);
    await h.say('Ürünü adı, kodu ya da barkoduyla arayın ve listeden seçin.', 600);
    await h.type(search, 'Campus');
    await h.wait(900);
    await h.click(p.getByRole('option').first(), 1200);
    const dlg = p.getByRole('dialog').last();
    await h.say('Miktarı ve gerekiyorsa birim fiyatı yazıp "Ekle" deyin.', 600);
    await h.type(dlg.locator('input[inputmode=decimal]').first(), '120');
    await h.type(dlg.locator('input[inputmode=decimal]').nth(1), '95');
    await h.click(dlg.getByRole('button', { name: /^Ekle$/ }), 1300);
    await h.say('Kalem tabloya eklendi. KDV ve genel toplam altta otomatik hesaplanır.', 2800);
    await h.click(p.getByRole('button', { name: /Faturayı Kaydet/ }).first(), 1500);
    const ok = p.getByRole('button', { name: /Onayla ve Kaydet/ });
    if (await ok.count()) {
      await h.say('Kaydetmeden önce düşülecek ürün ve hammadde stokları gösterilir. Onaylayın.', 2600);
      await h.click(ok.first(), 300);
    }
    await p.waitForURL(/\/customers\//, { timeout: 20000 }).catch(() => {}); await h.wait(1800);
    await h.say('Satış kaydedildi: müşterinin bakiyesi arttı, stok düştü.', 2800);
    await h.point(p.getByRole('link', { name: /İade Faturası/ }).first(), 800);
    await h.say('Müşteri mal iade ederse "İade Faturası" ile aynı ekranda iade belgesi kesin.', 1400);
    await h.click(p.getByRole('link', { name: /İade Faturası/ }).first(), 1800);
    await h.say('İade edilen ürünü ve adedi girip "İadeyi Kaydet" deyin; bakiye azalır, stok geri girer.', 3200);
    await h.go('/invoices', 1800);
    await h.say('Satışlar menüsünde tüm faturalar listelenir; bir faturayı açıp yazdırabilir ya da tahsilat girebilirsiniz.', 3400);
  },
  recap: ['Müşteri kartı → Yeni Satış', 'Ürün ara → miktar → Ekle → Faturayı Kaydet', 'İade: İade Faturası'],
};
