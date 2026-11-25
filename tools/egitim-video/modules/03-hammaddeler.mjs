// Hammaddeler: malzeme ekleme ve stok güncelleme
import { sql } from '../lib.mjs';
const AD = 'Eğitim EVA Granül';
export default {
  slug: 'hammaddeler',
  title: 'Hammaddeler ve Stok',
  summary: ['Hammadde ekleme (kg fiyatı)', 'Stok artırma / azaltma', 'Stok ekstresi', 'Fasoncuya hammadde gönderme'],
  prepare() {
    sql(`delete from "StockAdjustment" where "materialId" in (select id from "Material" where name='${AD}'); delete from "Material" where name='${AD}';`);
  },
  async run(h) {
    const { p } = h;
    await h.go('/materials');
    await h.say('Stok & Hesaplar → Hammaddeler: kullandığınız tüm malzemeler kg fiyatı ve stoğuyla listelenir.', 3200);
    await h.click(p.getByRole('button', { name: /Malzeme Ekle/ }).first(), 1000);
    await h.say('Malzeme adını, kategorisini ve kg fiyatını girin.', 800);
    await h.type(p.locator('#mat-name'), AD);
    await h.type(p.locator('#mat-category'), 'Granül');
    await h.type(p.locator('#mat-price'), '2,35');
    await h.select(p.locator('#mat-currency'), 'USD');
    await h.click(p.getByTestId('modal').getByRole('button', { name: /^Kaydet$/ }), 1800);
    await h.say('Malzemenin üzerine tıklayınca detayı açılır.', 1000);
    await h.click(p.getByText(AD).first(), 1800);
    await h.click(p.getByRole('button', { name: /Stok Güncelle/ }).first(), 900);
    await h.say('"Stok Güncelle": gelen malı "Artır", kullanılanı "Azalt" ile girin. Sayım farkı için "Düzelt".', 1500);
    await h.type(h.field('Eklenecek Miktar'), '750');
    await h.wait(800);
    await h.click(p.getByRole('button', { name: /^Kaydet$/ }).last(), 2000);
    await h.say('Her hareket "Stok Ekstresi"nde tarihiyle görünür. Alış faturası girince stok kendiliğinden artar.', 3400);
    await h.scroll(500, 1600);
    await h.say('Fasoncunuz varsa "Fasoncuya Gönder" ile hammaddeyi onun zimmetine aktarabilirsiniz.', 3000);
  },
  recap: ['Hammaddeler → Malzeme Ekle', 'Stok Güncelle: Artır / Azalt / Düzelt', 'Alış faturası stoğu otomatik artırır'],
};
