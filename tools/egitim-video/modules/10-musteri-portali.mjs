// Müşteri portalı: firma tarafı ayarlar ve müşterinin sipariş vermesi
export default {
  slug: 'musteri-portali',
  title: 'Müşteri Portalı',
  summary: ['Müşteriye portal hesabı açma', 'Portalda fiyat gösterimi', 'Müşterinin katalogdan sipariş vermesi', 'Sipariş takibi ve mesaj'],
  async run(h) {
    const { p } = h;
    await h.go('/portal-admin', 1800);
    await h.say('Operasyonlar → Müşteri Portalı: müşterileriniz size 7/24 kendi ekranlarından sipariş verir.', 3200);
    await h.point(p.getByTestId('portal-show-prices'), 1000);
    await h.say('"Portalda fiyatları göster" açıksa müşteri kendi fiyatını ve tahmini tutarı görür.', 2800);
    await h.click(p.getByRole('button', { name: /Portal Kullanıcıları/ }).first(), 1200);
    await h.click(p.getByRole('button', { name: /Portal Kullanıcısı Ekle/ }).first(), 1000);
    await h.say('"Portal Kullanıcısı Ekle": müşteriyi seçin, e-posta ve geçici şifre girin. Giriş bilgileri e-postayla gider.', 3600);
    await h.click(p.getByRole('button', { name: /^İptal$/ }).last(), 800);
    await h.say('Şimdi müşterinin gözünden bakalım: portal adresi solecost.com/portal.', 2200);
    await h.loginAs('portal');
    await h.go('/portal/dashboard', 2000);
    await h.say('Müşteri giriş yapınca siparişlerini, termini yaklaşanları ve yeni mesajları görür.', 3000);
    await h.click(p.getByRole('link', { name: 'Katalog' }).first(), 2200);
    await h.say('Katalogdan ürünü seçer, renk ve numara adetlerini girip sepete ekler.', 1200);
    await h.click(p.getByRole('button', { name: /Sipariş Ver/ }).first(), 1200);
    const color = p.locator('input[placeholder*="Siyah"], input[placeholder*="renk" i]').first();
    if (await color.count()) await h.type(color, 'Siyah');
    const sizes = p.locator('input[placeholder="0"]');
    await h.type(sizes.nth(2), '24'); await h.type(sizes.nth(3), '24');
    await h.click(p.getByRole('button', { name: /Sepete Ekle/ }).first(), 1500);
    await h.say('Sepetteki ürünleri tek seferde "Siparişleri Gönder" ile iletir; firmaya anında bildirim düşer.', 1500);
    await h.click(p.getByRole('button', { name: /Siparişleri Gönder/ }).first(), 300);
    await p.waitForURL(/\/portal\/orders/, { timeout: 15000 }).catch(() => {}); await h.wait(2000);
    await h.say('"Siparişlerim"de her siparişin durumu adım adım görünür.', 2400);
    const first = p.locator('table a[href*="/portal/orders/"]').first();
    if (await first.count()) {
      await h.click(first, 2000);
      await h.say('Sipariş detayında üretim adımları, sevkiyatlar, irsaliyeler ve firmayla mesajlaşma var.', 3000);
      await h.scroll(700, 1500);
    }
  },
  recap: ['Müşteri Portalı → Portal Kullanıcısı Ekle', 'Müşteri: Katalog → Sepete Ekle → Gönder', 'Durum, sevkiyat ve mesajlar portalda'],
};
