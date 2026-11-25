// Genel tanıtım: ana sayfa, menü, bildirimler, destek
export default {
  slug: 'genel',
  kicker: 'Başlangıç',
  title: 'SoleCost’a Genel Bakış',
  summary: ['Ana sayfa ve özet kartlar', 'Sol menü: modüller nerede', 'Bildirim zili', 'Ayarlar ve destek'],
  async run(h) {
    const { p } = h;
    await h.go('/dashboard', 2000);
    await h.say('Giriş yaptığınızda Ana Sayfa açılır: toplam alacak, borç ve günlük/aylık ciro bir bakışta görünür.', 3600);
    await h.point(p.getByText('Bekleyen Siparişler').first(), 1600);
    await h.say('Bekleyen siparişler, kasa ve banka varlıkları ve vadesi yaklaşan çekler burada listelenir.', 3200);
    await h.scroll(400, 1200); await h.scroll(-400, 800);
    const side = p.getByTestId('sidebar');
    await h.point(side.getByText('Ticari', { exact: true }).first(), 1200);
    await h.say('Sol menü gruplara ayrılır. Ticari: müşteriler, tedarikçiler, satışlar ve alışlar.', 3000);
    await h.point(side.getByText('Siparişler', { exact: true }).first(), 1000);
    await h.say('Siparişler: müşterilerden gelen ve sizin verdiğiniz siparişler.', 2600);
    await h.point(side.getByText('Stok & Hesaplar', { exact: true }).first(), 1000);
    await h.say('Stok & Hesaplar: ürünler, hammaddeler, kasa/banka hesapları ve çek portföyü.', 2800);
    await h.point(side.getByText('Operasyonlar', { exact: true }).first(), 1000);
    await h.say('Operasyonlar: fasoncular, fason siparişleri, personel ve müşteri portalı.', 2800);
    await h.point(p.getByTestId('notification-bell'), 800);
    await h.say('Zil simgesi bildirimlerinizi gösterir: yeni sipariş, mesaj, sevkiyat…', 1200);
    await h.click(p.getByTestId('notification-bell'), 2200);
    await h.say('Bir bildirime tıklayınca ilgili kayıt açılır.', 2000);
    await p.keyboard.press('Escape'); await h.click(p.locator('h1').first(), 600);
    await h.point(p.getByRole('link', { name: /Destek Merkezi/ }).first(), 800);
    await h.say('Takıldığınız yerde "Destek Merkezi"nden bize talep açabilirsiniz.', 2600);
    await h.click(side.getByRole('link', { name: 'Ayarlar', exact: true }).first(), 1800);
    await h.say('Ayarlar: firma bilgileri, logo, döviz kurları, KDV oranı, dil ve şifre burada.', 3400);
    await h.scroll(500, 1500);
  },
  recap: ['Ana Sayfa: özet ve bekleyen işler', 'Sol menü: Ticari, Siparişler, Stok & Hesaplar, Operasyonlar', 'Zil: bildirimler · Ayarlar: firma bilgileri'],
};
