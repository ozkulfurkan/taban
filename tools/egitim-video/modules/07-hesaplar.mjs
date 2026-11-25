// Kasa ve banka hesapları
import { sql } from '../lib.mjs';
const AD = 'Eğitim Kasası';
export default {
  slug: 'hesaplar',
  title: 'Kasa ve Banka Hesapları',
  summary: ['Kasa / banka / POS hesabı açma', 'Para girişi ve çıkışı', 'Hesaplar arası transfer', 'Hesap hareketleri'],
  prepare() {
    sql(`delete from "Payment" where "accountId" in (select id from "Account" where name='${AD}'); delete from "Account" where name='${AD}';`);
  },
  async run(h) {
    const { p } = h;
    await h.go('/accounts');
    await h.say('Stok & Hesaplar → Hesaplarım: kasa, banka ve POS hesaplarınız ve güncel bakiyeleri.', 3000);
    await h.click(p.getByRole('button', { name: /Yeni Hesap Ekle/ }).first(), 600);
    await h.click(p.getByRole('button', { name: /Kasa Ekle/ }).first(), 900);
    await h.say('Hesaba bir ad verin, para birimini ve açılış bakiyesini girin.', 600);
    await h.type(h.field('Tanım'), AD);
    await h.click(p.getByRole('button', { name: /^Kaydet$/ }).last(), 1800);
    await h.click(p.getByText(AD).first(), 1800);
    await h.say('Hesabın içinde tüm giriş-çıkış hareketleri tarih sırasıyla listelenir.', 2400);
    await h.click(p.getByRole('button', { name: /Para Girişi/ }).first(), 900);
    await h.say('"Hesaba Para Girişi Yap": tutarı ve açıklamayı yazın.', 600);
    await h.type(h.field('Tutar'), '2500');
    await h.type(h.field('Açıklama'), 'Kasaya nakit');
    await h.click(p.getByRole('button', { name: /^Kaydet$/ }).last(), 2000);
    await h.point(p.getByRole('button', { name: /Transfer/ }).first(), 1000);
    await h.say('Bir hesaptan diğerine para aktarmak için "Hesaplar Arası Transfer"i kullanın; farklı para birimlerinde kur sorulur.', 3600);
    await h.say('Müşteri tahsilatları ve tedarikçi ödemeleri seçtiğiniz hesaba otomatik işlenir.', 3000);
  },
  recap: ['Hesaplarım → Yeni Hesap Ekle', 'Para girişi / çıkışı', 'Hesaplar arası transfer'],
};
