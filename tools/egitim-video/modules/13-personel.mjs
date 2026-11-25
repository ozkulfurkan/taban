// Personel takip
import { sql } from '../lib.mjs';
const AD = 'Eğitim Personeli';
export default {
  slug: 'personel',
  title: 'Personel Takip',
  summary: ['Personel kaydı', 'Maaş, avans, prim ve kesinti', 'İzin ve mesai', 'Personel ekstresi'],
  prepare() { try { sql(`delete from "Employee" where name='${AD}'`); } catch {} },
  async run(h) {
    const { p } = h;
    await h.go('/personnel', 1800);
    await h.say('Operasyonlar → Personel Takip: çalışanlarınız, maaş günleri ve bakiyeleri.', 2800);
    await h.click(p.getByRole('button', { name: /Yeni Personel/ }).first(), 1000);
    await h.say('Ad, departman, görev, maaş ve maaş gününü girin.', 600);
    await h.type(p.getByPlaceholder('Ahmet Yılmaz'), AD);
    await h.type(p.getByPlaceholder('Üretim', { exact: true }), 'Üretim');
    await h.type(p.getByPlaceholder('Operatör'), 'Kalıp Ustası');
    await h.type(p.getByPlaceholder('25000'), '32000');
    await h.click(p.getByRole('button', { name: /^Kaydet$/ }).last(), 2000);
    await h.click(p.getByText(AD).first(), 2000);
    await h.say('Personel kartında maaş ödeme, avans, prim, kesinti, izin ve mesai işlemleri tek tıkla girilir.', 3200);
    await h.click(p.getByRole('button', { name: /Avans Ver/ }).first(), 1000);
    await h.say('Örneğin avans: tutarı ve ödenen kasayı seçin.', 2400);
    await h.click(p.getByRole('button', { name: /^İptal$|Vazgeç/ }).last(), 900);
    await h.scroll(600, 1500);
    await h.say('Tüm hakediş ve ödemeler personel ekstresinde; izinler, mesailer ve belgeler sekmelerde.', 3200);
  },
  recap: ['Personel Takip → Yeni Personel', 'Maaş, avans, prim, kesinti', 'İzin, mesai, evrak ve ekstre'],
};
