// Tedarikçiler: alış faturası ve ödeme
import { sql } from '../lib.mjs';
export default {
  slug: 'tedarikciler',
  title: 'Tedarikçiler, Alış ve Ödeme',
  summary: ['Tedarikçi kartı', 'Hammadde alış faturası', 'Stoğun otomatik artması', 'Tedarikçiye ödeme'],
  async run(h) {
    const { p } = h;
    await h.go('/suppliers');
    await h.say('Ticari → Tedarikçiler: hammadde aldığınız firmalar ve onlara olan borcunuz.', 3000);
    const sup = sql(`select id from "Supplier" where "companyId"=(select "companyId" from "User" where email='test@solecost.com') and name like 'FoamTech%' limit 1`);
    await h.go(`/suppliers/${sup}`);
    await h.say('Tedarikçi kartında bakiye ve tüm alış/ödeme hareketleri görünür.', 2800);
    await h.click(p.getByRole('link', { name: /Yeni Alış/ }).first(), 1800);
    await h.say('"Yeni Alış": aldığınız hammaddeyi arayıp seçin.', 600);
    await h.type(p.getByPlaceholder(/Hammadde veya ürün arayın/), 'EVA');
    await h.wait(900);
    await h.click(p.getByText('EVA Köpük', { exact: true }).first(), 1200);
    const dlg = p.getByRole('dialog').last();
    await h.say('Kilo ve kg fiyatını yazın, "Ekle" deyin.', 600);
    await h.type(dlg.locator('input[inputmode=decimal]').first(), '250');
    await h.click(dlg.getByRole('button', { name: /^Ekle$/ }), 1200);
    await h.point(p.locator('#doc-depot'), 1000);
    await h.say('"Hedef Depo": mal ana depoya mı, doğrudan bir fasoncuya mı gidiyor seçin.', 2800);
    await h.click(p.getByRole('button', { name: /Alışı Kaydet/ }).first(), 300);
    await p.waitForURL(/\/suppliers\//, { timeout: 20000 }).catch(() => {}); await h.wait(1800);
    await h.say('Alış kaydedildi: tedarikçi borcu arttı, hammadde stoğu kendiliğinden yükseldi.', 3000);
    await h.click(p.getByRole('button', { name: /Ödeme\/Tahsilat/ }).first());
    await h.click(p.getByRole('button', { name: /Nakit \/ KK \/ Banka/ }).first(), 900);
    const f = p.locator('form').last();
    const acc = f.locator('select').first();
    const opt = await acc.locator('option').evaluateAll(os => (os.find(o => /USD/.test(o.textContent) && o.value) ?? os.find(o => o.value))?.value);
    await h.say('Ödeme yaparken parayı çıkacağınız kasa ya da bankayı seçip tutarı girin.', 600);
    await h.select(acc, opt);
    await h.type(f.locator('input[inputmode]').first(), '300');
    await h.click(f.getByRole('button', { name: /Kaydet/ }).last(), 2200);
    await h.say('Borç düştü, kasadan çıkış yazıldı. Çekle ödemek için "Ödeme/Tahsilat → Çek" kullanılır.', 3200);
  },
  recap: ['Tedarikçi kartı → Yeni Alış → Alışı Kaydet', 'Stok otomatik artar', 'Ödeme/Tahsilat → Nakit / KK / Banka'],
};
