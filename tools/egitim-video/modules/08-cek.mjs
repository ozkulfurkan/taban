// Çek portföyü
import { sql } from '../lib.mjs';
export default {
  slug: 'cek',
  title: 'Çek Portföyü',
  summary: ['Müşteriden çek alma', 'Portföy ve vade takibi', 'Bankaya verme, tedarikçiye ciro', 'Tahsil etme'],
  async run(h) {
    const { p } = h;
    const cust = sql(`select id from "Customer" where name like 'Yıldız Spor%' limit 1`);
    await h.go(`/customers/${cust}`);
    await h.say('Müşteriden çek aldığınızda: müşteri kartı → "Tahsilat/Ödeme" → "Çek".', 1200);
    await h.click(p.getByRole('button', { name: /Tahsilat\/Ödeme/ }).first());
    await h.click(p.getByRole('button', { name: /^Çek$/ }).first(), 1200);
    await h.click(p.getByRole('button', { name: /Çek Ekle/ }).first(), 1000);
    await h.say('Çekin vadesini, tutarını, seri numarasını ve bankasını girin.', 600);
    const d = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
    await h.moveTo(h.field('Vadesi')); await h.field('Vadesi').fill(d); await h.wait(500);
    await h.type(h.field('Tutar'), '15000');
    await h.type(h.field('Seri No'), 'EGT-' + Math.floor(Math.random() * 9000 + 1000));
    await h.click(p.getByRole('button', { name: /^Tamam$/ }).last(), 1200);
    await h.say('Birden fazla çek ekleyebilirsiniz; ortalama vade otomatik hesaplanır. "Kaydet" ile çekler portföye girer.', 3000);
    await h.click(p.getByRole('button', { name: /^Kaydet$/ }).last(), 2200);
    await h.go('/cek-portfolyo', 2000);
    await h.say('Stok & Hesaplar → Çek Portföyü: tüm çekler durum ve vadeleriyle burada.', 3000);
    await h.click(p.getByRole('button', { name: /Portföydekiler/ }).first(), 1500);
    const box = p.getByRole('checkbox').nth(1);
    if (await box.count()) { await h.click(box, 900); }
    await h.say('Çekleri seçip toplu işlem yapın: "Bankaya Gönder", "Tedarikçiye Ödeme Yap" ya da "Tahsil Et".', 3400);
    await h.say('Satır menüsündeki "İşlemler" ile tek çeki karşılıksız, ödendi ya da iptal olarak işaretleyebilirsiniz.', 3200);
  },
  recap: ['Müşteri kartı → Tahsilat/Ödeme → Çek', 'Çek Portföyü: vade ve durum takibi', 'Toplu: bankaya ver, tedarikçiye ciro, tahsil et'],
};
