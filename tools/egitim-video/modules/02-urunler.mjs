// Ürünler: yeni ürün, parçalar ve maliyet, stok, koli etiketi, katalog
import { sql } from '../lib.mjs';
const AD = 'Eğitim Taban', KOD = 'EGT-100';
export default {
  slug: 'urunler',
  title: 'Ürünler ve Maliyet',
  summary: ['Yeni ürün (taban) kaydı', 'Parça ve hammadde ile maliyet', 'Stok girişi ve koli etiketi', 'Müşteriye katalog PDF'],
  prepare() {
    sql(`delete from "ProductPart" where "productId" in (select id from "Product" where code='${KOD}'); delete from "Koli" where "productId" in (select id from "Product" where code='${KOD}'); delete from "ProductStockAdjustment" where "productId" in (select id from "Product" where code='${KOD}'); delete from "Product" where code='${KOD}';`);
  },
  async run(h) {
    const { p } = h;
    await h.go('/products');
    await h.say('Stok & Hesaplar → Ürünler: tüm tabanlarınız, fiyat ve stoklarıyla burada.', 3000);
    await h.click(p.getByRole('link', { name: /Yeni Ürün/ }).first(), 1200);
    await h.say('Ürün adını, kodunu ve birimini girin (taban için "çift").', 1000);
    await h.type(h.field('Ürün Adı'), AD);
    await h.type(h.field('Ürün Kodu'), KOD);
    await h.say('Satış fiyatı, para birimi ve mevcut stok da buradan girilir.', 1000);
    await h.type(h.field('Birim Fiyat'), '85,00');
    await h.select(h.field('Para Birimi'), 'TRY');
    await h.type(h.field('Mevcut Stok'), '500');
    await h.click(p.getByRole('button', { name: /^Kaydet$/ }).first(), 300);
    await p.waitForURL(/\/products\/[^/]+\?edit=true/); await h.wait(1800);
    await h.say('Kaydedince ürün kartı açılır. Fotoğraf ekleyebilir, renk, shore ve numaraları girebilirsiniz.', 3200);
    await h.scroll(500, 1200);
    const add = p.getByRole('button', { name: /Parça Ekle/ }).first();
    if (await add.count()) {
      await h.point(add, 1000);
      await h.say('"Parça / Hammadde Listesi"ne tabanın parçalarını ekleyin: hammadde, net gram ve fire oranı.', 3400);
    }
    await h.say('Parçalar, işçilik ve ekstra giderler girilince çift başı maliyet otomatik hesaplanır.', 3200);
    await h.scroll(-2000, 800);
    const vaz = p.getByRole('button', { name: /Vazgeç/ }).first();
    if (await vaz.count()) await h.click(vaz, 1500);
    const cost = p.getByRole('button', { name: /Maliyet Hesapla/ }).first();
    if (await cost.count()) { await h.point(cost, 1000); await h.say('"Maliyet Hesapla" maliyet dökümünü ve kâr marjını gösterir.', 2800); }
    await h.say('Stok Yönetimi kartından miktar yazıp "Ekle" ya da "Çıkar" ile stoğu güncelleyin.', 2800);
    await h.click(p.getByTestId('koli-open'), 1200);
    await h.say('"Koli Etiketi": koliye girecek numara ve adetleri seçip barkodlu etiket yazdırın.', 2200);
    await h.type(p.getByTestId('koli-color'), 'Siyah');
    const q = p.locator('[data-testid^="koli-qty-"]').first();
    if (await q.count()) await h.type(q, '12');
    await h.point(p.getByTestId('koli-summary'), 1200);
    await h.say('İsterseniz "Toplamı stoğa ekle" ile etiketlenen adetler stoğa da girer.', 2600);
    await h.click(p.getByRole('button', { name: 'Vazgeç' }).last(), 1000);
    await h.go('/products/katalog', 1800);
    await h.say('Ürünler → "Katalog PDF": müşteriye göndereceğiniz fotoğraflı kataloğu hazırlayın.', 1500);
    await h.type(p.getByTestId('catalog-customer'), 'Sayın Ayakkabı Dünyası');
    await h.click(p.getByTestId('catalog-all'), 1200);
    await h.point(p.getByTestId('catalog-pdf'), 1200);
    await h.say('Ürünleri seçip "Katalog PDF hazırla" deyin; PDF’i WhatsApp ya da e-postayla paylaşın.', 3200);
  },
  recap: ['Ürünler → Yeni Ürün → Kaydet', 'Parçalar + işçilik = çift başı maliyet', 'Koli Etiketi ve Katalog PDF'],
};
