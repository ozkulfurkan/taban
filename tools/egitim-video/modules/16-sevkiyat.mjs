// Sevkiyat: yazdırma ayarları (nokta vuruşlu / A4), sevk fişi, cari hesaba işleme, nakliyeci
import { sql } from '../lib.mjs';
export default {
  slug: 'sevkiyat',
  title: 'Sevkiyat ve Sevk Fişi',
  summary: ['Yazdırma ayarları: nokta vuruşlu sürekli form, matbu form, A4', 'Sevke hazır siparişten sevk fişi kesme', 'Fişi yazdırırken cari hesaba işleme (satış, KDV, stok)', 'Nakliyeci kullanıcısı: fiyatsız fiş'],
  async run(h) {
    const { p } = h;
    // Eğitim için sevke hazır bir sipariş açılır
    const co = `(select "companyId" from "User" where email='test@solecost.com')`;
    const cust = sql(`select id from "Customer" where name like 'Kaya Ayakkab%' and "companyId"=${co} limit 1`);
    const prod = sql(`select id from "Product" where code='TBN-002' and "companyId"=${co} limit 1`);
    sql(`update "SoleOrder" set status='SHIPPED' where notes='Eğitim sevkiyatı' and "companyId"=${co}`); // önceki kayıtlardan kalanlar
    const order = await (await p.request.post('/api/orders', { data: { customerId: cust, productId: prod, color: 'Kahve', sizeDistribution: { '39': 40, '40': 40, '41': 40 }, notes: 'Eğitim sevkiyatı' } })).json();
    for (const status of ['IN_PRODUCTION', 'READY_FOR_SHIPMENT']) await p.request.put(`/api/orders/${order.id}`, { data: { status } });
    await p.request.put('/api/print-settings', { data: { paper: 'A4', mode: 'full', showPrices: false, postByDefault: true } });

    await h.go('/settings/yazdirma', 1800);
    await h.say('Önce bir kez: Ayarlar → Yazdırma Ayarları. Sevk fişinin kâğıt ölçüsünü buradan seçersiniz.', 3200);
    await h.select(p.getByTestId('ps-paper'), 'CF240x140');
    await h.say('Nokta vuruşlu yazıcı için sürekli form (ör. 240 × 140 mm); normal yazıcı için A4 veya A5. Özel ölçü de girilebilir.', 3200);
    await h.point(p.getByTestId('ps-preview'), 1000);
    await h.say('Sağdaki önizleme kâğıdın gerçek oranını gösterir; kenar boşluğu ve yazı boyu değiştikçe güncellenir.', 2800);
    await h.click(p.getByTestId('ps-mode-preprinted'), 1200);
    await h.say('Üstü basılı matbu formunuz varsa "Matbu form"u seçin: her alanın yerini milimetre olarak ayarlarsınız.', 3000);
    await h.point(p.getByTestId('ps-calibration'), 800);
    await h.say('"Kalibrasyon sayfası"nı formun üstüne yazdırıp ızgaradan doğru mm değerlerini okuyun.', 2800);
    await h.click(p.getByTestId('ps-mode-full'), 800);
    await h.click(p.getByTestId('ps-prices'), 600);
    await h.say('Fişte fiyat ve toplam görünsün mü, "Cari hesaba işle" hazır işaretli gelsin mi: hepsi burada.', 2600);
    await h.click(p.getByTestId('ps-save'), 1600);

    await h.go('/sevkiyat', 1800);
    await h.say('Menüde Sevkiyat: sevke hazır siparişler müşteri müşteri listelenir, altında kesilen fişler.', 3000);
    const li = p.getByTestId('sv-ready').locator('li', { hasText: order.orderNo });
    await h.point(li, 1000);
    await h.click(li.getByRole('link', { name: /Sevk et/ }), 2200);
    await h.say('Müşterinin açık siparişleri gelir; sevke hazır olanlar işaretli. Başka ürün de ekleyebilirsiniz.', 3000);
    const row = p.getByTestId('sv-row').filter({ hasText: 'TBN-002' }).first();
    await h.type(row.getByTestId('sv-qty'), '80');
    await h.say('Bu sefer 80 çift gidiyor: kalan 40 çift siparişte açık kalır, sonraki fişe gelir.', 2600);
    await h.point(row.getByTestId('sv-price'), 800);
    await h.say('Fiyat müşteriye özel fiyattan, yoksa ürün liste fiyatından gelir; boşsa elle yazın.', 2800);
    await h.type(p.getByTestId('sv-plate'), '34 SC 2026');
    await h.type(p.getByTestId('sv-carrier'), 'Kendi aracımız');
    await h.point(p.getByTestId('sv-post'), 800);
    await h.say('"Cari hesaba işle" işaretliyse fiş kaydedilirken satış oluşur: müşteri borçlanır, KDV eklenir, stok düşer.', 3200);
    await h.click(p.getByTestId('sv-save'), 600);
    await p.waitForURL(/\/sevkiyat\/c/, { timeout: 20000 }); await h.wait(1800);
    await h.point(p.getByTestId('sv-invoice'), 1000);
    await h.say('Fiş numarası verildi ve yazdırma penceresi açıldı. Satış faturası da hazır: bağlantıdan açabilirsiniz.', 3000);
    await h.point(p.getByTestId('sv-print'), 800);
    await h.say('"Yazdır" ile fişi istediğiniz zaman tekrar basın; ayarlardaki kâğıt ölçüsü kullanılır.', 2600);

    await h.go(`/orders/${order.id}`, 1800);
    await h.point(p.getByTestId('order-posted'), 1000);
    await h.say('Sipariş ekranında sevkiyat görünür; hesaba işlendiği için "Satışa Çevir" çıkmaz, çift kayıt olmaz.', 3000);
    await h.point(p.getByTestId('order-dispatch'), 1000);
    await h.say('Kalanı göndermek için buradan "Sevk fişi kes" deyin. Durumu "Sevk Edildi" yaparken de fiş önerilir.', 3000);
    await h.say('Nakliyeci için Ayarlar → Kullanıcılar\'da yalnız "Sevkiyat" izni verin: fiş keser, fiyat görmez, hesaba işlemez.', 3600);
    await p.request.put('/api/print-settings', { data: { paper: 'A4', mode: 'full', showPrices: false, postByDefault: false } });
  },
  recap: ['Ayarlar → Yazdırma Ayarları: kâğıt, matbu form, kalibrasyon', 'Sevkiyat → Sevk et → miktar → Kaydet ve fişi yazdır', 'Cari hesaba işle: satış + KDV + stok tek adımda'],
};
