# Müşteri portalı sipariş süreci denetimi (25.11.2026)

Kapsam:
- **Müşteri portalı:** giriş, ana sayfa, katalog, yeni sipariş, siparişlerim, sipariş detayı, bildirimler, hesabım.
- **Firma tarafı:** Gelen Siparişler, sipariş detayı (onay, termin, durum, sevkiyat, satışa çevirme), Müşteri Portalı Yönetimi.
- **Mobil portal ekranları:** web çıktısıyla.

Yöntem:
- **API testleri:** iki firma (A, B); A'da iki müşteri ve iki portal hesabı (M1, M2), B'de bir portal hesabı. Testlerde genel ürün, gizli ürün, yalnızca M2'ye özel ürün ve B'nin ürünü kullanıldı.
- **Senaryo testleri:** gerçek istekler gönderildi, veritabanı sonuçları kontrol edildi.
- **Ekran incelemesi:** masaüstü ve telefon genişliğinde, Türkçe ve İngilizce tarayıcıyla.
- **Kod incelemesi.**

Kalıcı testler `tests/security/portal-orders.spec.ts` dosyasında. Açık bulgular orada `test.fixme` olarak duruyor.

## Özet

**Müşteriler ve firmalar arasında veri sızıntısı yok.** Aşağıdakilerin hepsi doğrulandı:
- Müşteri kataloğunda yalnızca kendine açık ürünleri görüyor. Gizli ürünler, başka müşteriye özel ürünler ve başka firmanın ürünleri görünmüyor; fotoğraf uçları da 404 dönüyor.
- Katalog ve sipariş yanıtlarında fiyat, maliyet, reçete gramajı, iç not ve firma/müşteri kimlikleri yok.
- Müşteri, başka müşterinin ve başka firmanın siparişini listede ya da kimlik tahminiyle göremiyor.
- Gizli, başkasına özel ya da başka firmanın ürünü sipariş edilemiyor; paket siparişte de engelleniyor. Gövdeye başka müşteri ya da firma kimliği yazılsa bile sipariş müşterinin kendi adına açılıyor.
- Müşteri portalı firma API'lerine ve fason portalına erişemiyor.
- Firma başka firmanın siparişini okuyamıyor, değiştiremiyor, onaylayamıyor ve silemiyor.
- Pasif portal hesabı giriş yapamıyor; açık oturumu kapanıyor.

**Sorunlar süreç tarafında:**
- sipariş girdisi doğrulanmıyor;
- sipariş numarası çakışabiliyor;
- durum, sevkiyat ve faturaya çevirme kuralsız;
- "Siparişler" izni API'de denetlenmiyor;
- telefonda tablolar taşıyor.

## Güvenlik ve yetki

| # | Bulgu | Nasıl tekrar edilir | Etki | Çözüm | Büyüklük |
|---|---|---|---|---|---|
| P-G1 | **"Siparişler" izni olmayan kullanıcı siparişleri okuyup değiştirebiliyor** | Yalnızca "Ürünler" izni olan EDITOR, `/api/orders` uçlarına 200 alıyor (`/api/orders/uretim` ve `/api/portal/orders` de aynı). Sayfa kapalı, veri açık. | İzin sistemi aşılıyor | Sipariş API'leri "orders" iznine bağlansın (`lib/access.ts`, fasondaki gibi) | S |

## Hatalar

| # | Bulgu | Nasıl tekrar edilir | Etki | Çözüm | Büyüklük |
|---|---|---|---|---|---|
| P-H1 | **Tek ürünlü siparişte beden adetleri doğrulanmıyor** | `{39: -5, 40: 10}` → 5 çift olarak kabul ediliyor. `{40: 2.5}` → 2,5 çift. | Hatalı sipariş, üretim emri ve sevkiyat | Paket siparişteki doğrulama tek ürün yoluna da uygulansın (pozitif tam sayı) | S |
| P-H2 | **Geçersiz termin tarihi sunucu hatası veriyor** | `requestedDeliveryDate: "yarın"` → 500 | Sipariş gönderilemiyor, anlaşılır mesaj yok | Tarih doğrulansın: 400 ve mesaj. Geçmiş tarih de reddedilsin (P-H10). | S |
| P-H3 | **Portal sipariş numarası çakışabiliyor** | Numara `ORD-YYYYMMDD-` + rastgele 4 hane. Aynı gün aynı numara çıkarsa veritabanı kısıtı nedeniyle 500 → sipariş kaybolur. Günde 50 siparişte bir çakışma ihtimali yaklaşık %13. | Müşterinin siparişi kaydedilmiyor | Firma siparişleriyle aynı sıralı numara (`SIP-2026-0143`, `nextDocumentNumber`) | S |
| P-H4 | **Firma tarafında durum geçişleri kuralsız** | İptal edilen sipariş "Üretimde" yapılabiliyor; sevk edilen sipariş "Sipariş Alındı"ya geri alınabiliyor. Her değişiklik müşteriye bildirim gönderiyor. | Müşteri yanlış ve çelişkili bildirim alıyor | Geçiş kuralları: iptal ve sevk son adım (iptal yalnızca "geri al" ile açılır). Bildirim yalnızca ileri adımda gitsin. | S |
| P-H5 | **İptal edilmiş siparişe sevkiyat girilebiliyor** | İptal edilmiş siparişe sevkiyat kaydı → durum "Sevk Edildi" oluyor, müşteriye bildirim gidiyor | Çelişkili kayıt | İptal edilmiş siparişte sevkiyat kapalı | S |
| P-H6 | **Satışa çevirme kuralsız** | Sipariş başka müşterinin faturasına bağlanabiliyor. İki kez çevrilebiliyor (bağlı fatura değişiyor). İptal edilmiş sipariş çevrilebiliyor. | Satış ve cari kayıtları karışıyor | Fatura aynı müşteriye ait olmalı; bir kez bağlanmalı; iptal edilmiş sipariş çevrilmemeli | S |
| P-H7 | Numarasız ürün (kg, metre) beden dağılımıyla sipariş edilebiliyor; birim boş kalıyor | kg birimli ürün tek ürün olarak `{40: 3}` ile sipariş ediliyor → birim yok, "çift" gibi görünüyor | Yanlış miktar | Tek ürün yolunda da ürün birimine göre doğrulama (paket yolundaki gibi) | S |
| P-H8 | Not, renk ve malzeme alanlarında uzunluk sınırı yok | 100.000 karakterlik not ve 5.000 karakterlik renk kabul ediliyor; `colorPartials` yapısı doğrulanmıyor | E-posta ve çıktıların bozulması, şişen kayıtlar | Sınırlar (not 1.000, renk/malzeme 100) ve yapı doğrulaması | S |
| P-H9 | Aynı sipariş arka arkaya iki kez gönderilebiliyor | Aynı içerikle iki istek → iki sipariş | Mükerrer üretim emri | Kısa sürede gelen aynı içerikli siparişte uyarı; ekranda düğme kilidi | S |
| P-H10 | Geçmiş tarihli "istenen termin" kabul ediliyor | `requestedDeliveryDate: 2000-01-01` → 201 | Anlamsız termin | Bugünden önceki tarih reddedilsin | S |
| P-H11 | Sevk adedi sipariş adedini aşabiliyor | 5 çiftlik siparişe 999 çift sevk girilebiliyor (fark notu düşülüyor) | Hatalı irsaliye | Belirgin bir üst sınır ya da onay istensin | S |

## Kullanım kolaylığı

| # | Bulgu | Öneri | Büyüklük |
|---|---|---|---|
| P-K1 | Telefonda firma **Gelen Siparişler** ve **Müşteri Portalı Yönetimi** tabloları taşıyor; müşteri adı tek harfe iniyor | Telefonda kart görünümü | M |
| P-K2 | Portal **Siparişlerim** tablosu telefonda yatay taşıyor; durum filtresi 9 haptan oluşuyor | Telefonda kart listesi; filtrede 4 ana grup (Bekleyen, Üretimde, Sevk edilen, İptal) | S |
| P-K3 | Portal sipariş durum çizelgesi telefonda kesiliyor | Telefonda dikey zaman çizelgesi | S |
| P-K4 | Firmanın müşteri adına açtığı siparişler (telefonla alınan) portalda görünmüyor | "Siparişlerim" listesinde müşterinin tüm siparişleri, kaynağı belirtilerek | S |
| P-K5 | Yeni sipariş formunda müşteriye "Malzeme" soruluyor; katalog dışı serbest model kodu yazılabiliyor | Malzeme alanı kaldırılsın ya da firma ayarıyla açılsın; serbest model kodu "Katalogda olmayan bir model mi?" diye ayrıca sorulsun | S |
| P-K6 | Tarayıcı dili İngilizce olunca portal İngilizce açılıyor ama bazı bölümler ("Şifre değiştir") Türkçe kalıyor | Eksik çeviriler tamamlansın; dil seçimi hesaba kaydedilsin | S |
| P-K7 | Firma sipariş detayındaki "Durum Güncelle" listesi tüm durumları (geri adımlar dahil) gösteriyor | Yalnızca geçerli sonraki adımlar (P-H4 ile birlikte) | S |

## Geliştirme önerileri

| # | Öneri | Neden | Büyüklük |
|---|---|---|---|
| P-Ö1 | Müşterinin siparişi iptal etmesi ya da değişiklik talebi (onaydan önce doğrudan, sonra talep olarak) | Telefonla düzeltme ihtiyacı azalır | M |
| P-Ö2 | Sipariş başına mesajlaşma (müşteri ↔ firma) | WhatsApp'ta kaybolan konuşmalar siparişin içinde kalır | M |
| P-Ö3 | Müşteriye özel fiyatın portalda gösterilmesi ve sipariş tutarı (firma ayarıyla) | Müşteri sipariş verirken tutarı görür | M |
| P-Ö4 | Birden fazla (kısmi) sevkiyat | Şu an siparişte tek sevkiyat kaydı var | M |
| P-Ö5 | Sevkiyatta irsaliye PDF'inin portaldan indirilmesi | Müşteri teslimatı belgeyle kontrol eder | S |
| P-Ö6 | Portal ana sayfasında termini yaklaşan ve sevke hazır siparişler | Müşteri ne zaman teslim alacağını bilir | S |

## Önerilen düzeltme sırası
1. **Hemen:** P-G1, P-H1 – P-H6.
2. **Sonra:** P-H7 – P-H11, P-K1 – P-K7.
3. **Planlanacak:** P-Ö1 – P-Ö6.
