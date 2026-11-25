// Müşteriler: müşteri ekleme, cari kart, tahsilat, ekstre
import { sql } from '../lib.mjs';
const AD = 'Deneme Ayakkabı Ltd.';
export default {
  slug: 'musteriler',
  title: 'Müşteriler (Cari Hesaplar)',
  summary: ['Yeni müşteri ekleme', 'Cari kart: bakiye ve hareketler', 'Tahsilat girme', 'Hesap ekstresi ve paylaşma'],
  // Önceki kaydın müşterisi silinir (aynı ad uyarısı çıkmasın)
  prepare() {
    sql(`delete from "Payment" where "customerId" in (select id from "Customer" where name='${AD}'); delete from "Customer" where name='${AD}';`);
  },
  async run(h) {
    const { p } = h;
    await h.go('/customers');
    await h.say('Sol menüden Ticari → Müşteriler ekranını açın. Tüm müşterileriniz ve bakiyeleri burada listelenir.', 3200);
    await h.point(p.getByRole('link', { name: /Yeni Müşteri/ }).first());
    await h.say('Yeni bir müşteri için "Yeni Müşteri" düğmesine tıklayın.', 1800);
    await h.click(p.getByRole('link', { name: /Yeni Müşteri/ }).first(), 1200);
    await h.say('Firma adını yazın. Vergi numarası, telefon ve adres isteğe bağlıdır.', 1200);
    await h.type(p.locator('form input[required]').first(), AD);
    await h.type(h.field('Telefon'), '0212 555 44 33');
    await h.say('Para birimini seçin: müşterinin bakiyesi bu para biriminde tutulur.', 2200);
    await h.say('"Kaydet" ile müşteri oluşur ve cari kartı açılır.', 1500);
    await h.click(p.getByRole('button', { name: /Kaydet/ }).first(), 300);
    await p.waitForURL(/\/customers\/(?!new)[^/]+$/); await h.wait(1800);
    await h.say('Cari kartta bakiye, satışlar, tahsilatlar ve tüm hareketler tek ekranda görünür.', 3000);
    await h.point(p.getByRole('button', { name: /Tahsilat\/Ödeme/ }).first());
    await h.say('Para aldığınızda "Tahsilat/Ödeme" → "Nakit / KK / Banka" seçin.', 1600);
    await h.click(p.getByRole('button', { name: /Tahsilat\/Ödeme/ }).first());
    await h.click(p.getByRole('button', { name: /Nakit \/ KK \/ Banka/ }).first(), 900);
    const dialog = p.locator('form').last();
    const acc = dialog.locator('select').first();
    const opt = await acc.locator('option').evaluateAll(os => (os.find(o => /Kasa/.test(o.textContent) && o.value) ?? os.find(o => o.value))?.value);
    await h.say('Paranın girdiği kasayı ya da banka hesabını seçin ve tutarı yazın.', 1000);
    await h.select(acc, opt);
    await h.type(dialog.locator('input[inputmode]').first(), '5000');
    await h.say('Kaydedince müşterinin bakiyesi ve seçtiğiniz kasa aynı anda güncellenir.', 1500);
    await h.click(dialog.getByRole('button', { name: /Kaydet/ }).last(), 2500);
    await h.say('Hesap ekstresi için "Hesap Ekstresi" bağlantısını kullanın.', 1500);
    const eks = p.getByRole('link', { name: /Hesap Ekstresi|Ekstre/ }).first();
    await h.click(eks, 1500);
    await h.say('Ekstrede tarih aralığı seçebilir, PDF alabilir ya da müşterinize bağlantı olarak gönderebilirsiniz.', 3400);
  },
  recap: ['Ticari → Müşteriler → Yeni Müşteri', 'Tahsilat: cari kart → Tahsilat/Ödeme', 'Ekstre: PDF ya da paylaşım bağlantısı'],
};
