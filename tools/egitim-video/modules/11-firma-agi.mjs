// Firma ağı: SoleCost kullanan tedarikçiye kodla bağlanma ve sipariş verme (alıcı firma gözünden)
import { sql } from '../lib.mjs';
export default {
  slug: 'firma-agi',
  title: 'Firma Ağı ve Verilen Siparişler',
  as: 'buyer',
  summary: ['SoleCost firma koduyla bağlanma', 'Tedarikçinin kataloğundan sipariş', 'Verilen siparişleri takip', 'Tedarikçiyle mesajlaşma'],
  async run(h) {
    const { p } = h;
    await h.go('/settings', 1800);
    await p.getByTestId('company-code-card').waitFor({ timeout: 15000 }).catch(() => {});
    const code = p.getByTestId('company-code-card');
    if (await code.count()) { await h.point(code, 1200); }
    await h.say('Her firmanın bir SoleCost kodu vardır (Ayarlar). Tedarikçiniz de SoleCost kullanıyorsa kodunu isteyin.', 3400);
    await h.go('/suppliers/new', 1500);
    await h.point(p.getByTestId('new-supplier-code'), 1200);
    await h.say('Tedarikçi eklerken kodunu girin (ya da tedarikçi kartında "Firma koduyla bağla"). Tedarikçi onaylayınca bağlantı kurulur.', 3800);
    const sup = sql(`select "buyerSupplierId" from "CompanyLink" where status='ACTIVE' limit 1`);
    await h.go(`/suppliers/${sup}`, 1800);
    await h.point(p.getByTestId('supplier-network'), 1200);
    await h.say('Bağlı tedarikçinin kartında "Sipariş ver", "Siparişlerim" ve karşı ekstre çıkar.', 1400);
    await h.click(p.getByTestId('supplier-order'), 2200);
    await h.say('Tedarikçinizin size açtığı katalog: ürünü seçin, renk ve numara adetlerini girin.', 1200);
    await h.click(p.getByRole('button', { name: /Sipariş Ver/ }).first(), 1200);
    const color = p.locator('input[placeholder*="Siyah"], input[placeholder*="renk" i]').first();
    if (await color.count()) await h.type(color, 'Taba');
    const sizes = p.locator('input[placeholder="0"]');
    await h.type(sizes.nth(3), '36'); await h.type(sizes.nth(4), '36');
    await h.click(p.getByRole('button', { name: /Sepete Ekle/ }).first(), 1500);
    await h.say('"Siparişleri Gönder" ile sipariş doğrudan tedarikçinin Gelen Siparişler ekranına düşer.', 1400);
    await h.click(p.getByRole('button', { name: /Siparişleri Gönder/ }).first(), 300);
    await h.wait(2500);
    await h.go('/verilen-siparisler', 1800);
    await h.say('Siparişler → Verilen Siparişler: tedarikçilerinize verdiğiniz siparişlerin durumu burada.', 3000);
    await h.click(p.locator('[data-testid^="network-order-"] a, a[href^="/verilen-siparisler/c"]').first(), 2000);
    await h.say('Detayda onay, üretim adımları ve sevkiyatlar görünür.', 2400);
    await h.scroll(600, 900);
    await h.type(p.getByTestId('message-input'), 'Termin için teşekkürler, 39 numarayı öncelikli alabilir miyiz?');
    await h.say('Tedarikçinize siparişin içinden mesaj yazın; yanıtı bildirim olarak gelir.', 1000);
    await h.click(p.getByTestId('message-send'), 2000);
  },
  recap: ['SoleCost kodu ile tedarikçiye bağlan', 'Tedarikçi kartı → Sipariş ver', 'Verilen Siparişler: durum ve mesaj'],
};
