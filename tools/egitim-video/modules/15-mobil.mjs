// Mobil uygulama (iPhone / Android): giriş, ana ekran, cari ve tahsilat, siparişler, bildirimler
const APP = process.env.MOBILE ?? 'http://localhost:8090';
export default {
  slug: 'mobil',
  kicker: 'Mobil uygulama',
  title: 'SoleCost Mobil Uygulama',
  summary: ['App Store ve Google Play’den indirin', 'Aynı hesapla giriş', 'Cari, tahsilat ve ekstre cepte', 'Sipariş ve bildirimler'],
  async run(h) {
    const { p } = h;
    const f = await h.phone(`${APP}/login`);
    const frame = () => p.frames().find(x => x.url().startsWith(APP));
    // Sayfayı yeniden yüklemeden geri gider (oturum uygulama belleğinde)
    const back = async (n = 1, ms = 1500) => { for (let i = 0; i < n; i++) { await frame().evaluate(() => history.back()); await h.wait(700); } await h.wait(ms); };
    await h.say('Web’de kullandığınız e-posta ve şifreyle mobil uygulamaya giriş yapın.', 600);
    await h.type(f.getByTestId('login-email'), 'test@solecost.com', 40);
    await h.type(f.getByTestId('login-password'), 'Test123456', 40);
    await h.click(f.getByTestId('login-submit'), 3000);
    await h.say('Ana ekranda tüm modüller kutucuk olarak durur: müşteriler, satışlar, çekler, kasa, stok, siparişler…', 3400);
    await h.click(f.getByTestId('home-customers'), 2400);
    await h.say('Müşteriler: arayın, bakiyeleri görün.', 1200);
    await h.click(f.getByText(/Yıldız Spor/).first(), 1000);
    await f.getByTestId('party-payment').waitFor({ timeout: 15000 }); await h.wait(1200);
    await h.say('Cari kartta bakiye ve hareketler; buradan satış, tahsilat, çek ve sipariş girersiniz.', 3000);
    await h.click(f.getByTestId('party-payment'), 1200);
    await h.click(f.getByText('Tahsilat gir', { exact: true }), 2200);
    await h.say('Tahsilat: kasayı seçin, tutarı yazın, kaydedin. Hepsi anında web ile eşitlenir.', 800);
    await h.click(f.getByTestId('payment-account'), 900);
    await h.click(f.locator('[data-testid^="payment-account-"]').first(), 800);
    await h.type(f.getByTestId('payment-amount'), '750', 90);
    await h.click(f.getByTestId('payment-save'), 2600);
    await h.say('Ekstreyi PDF olarak WhatsApp’tan müşterinize tek dokunuşla gönderebilirsiniz.', 3000);
    await back(2);
    await h.click(f.getByTestId('home-orders'), 2400);
    await h.say('Siparişler: gelen ve verilen siparişler, onay ve sevkiyat durumu.', 3000);
    await back(1);
    await h.click(f.getByTestId('bell').first(), 2400);
    await h.say('Yeni sipariş, mesaj ve sevkiyatlar telefonunuza bildirim olarak gelir.', 3000);
    await back(1);
    await h.point(f.getByTestId('home-stock'), 800);
    await h.say('Stok ekranında barkod okutarak ürün bulabilir, stok girişi yapabilirsiniz.', 3000);
  },
  recap: ['Mağazadan “SoleCost” uygulamasını indirin', 'Web hesabınızla giriş yapın', 'Cari, tahsilat, sipariş ve bildirimler cebinizde'],
};
