# Fasoncu ve fason portalı denetimi (24.11.2026)

Kapsam:
- **Firma tarafı:** Fasoncular, Fason Siparişleri, yeni fason sipariş, sipariş detayı (hammadde gönder, gereksinim, fire, teslim al, e-posta).
- **Fasoncunun kendi portalı:** giriş, ana sayfa, siparişlerim, sipariş detayı, hammadde stoğum.
- **Mobil uygulamadaki fasoncu ekranı.**

Yöntem:
- **API güvenlik testi:** iki firma (A, B), A'da iki fasoncu ve B'de bir fasoncu (her birinin portal hesabı) ve bir müşteri portalı hesabıyla.
- **Senaryo testleri:** gerçek istekler gönderildi, veritabanı sonuçları kontrol edildi.
- **Ekran incelemesi:** tüm ekranlar masaüstü ve telefon genişliğinde ekran görüntüsüyle.
- **Kod incelemesi:** fason API'leri.

Kalıcı test dosyası `tests/security/fason.spec.ts`. Açık bulgular orada `test.fixme` olarak duruyor; düzeltilince açılacak.

## Durum (25.11.2026)
Güvenlik (G1–G6), hata (H1–H15) ve kullanım kolaylığı (K1–K7) maddeleri düzeltildi. Kullanıcı kararıyla iki madde farklı uygulandı:
- **H6:** depoda olandan fazla hammadde gönderimi **engellenmiyor**; ekranda önceden ve gönderimden sonra uyarı çıkıyor.
- **H8:** fasoncu zimmetinden fazla fire **giremiyor**.

Geliştirme önerileri (Ö1–Ö8) ayrıca planlanacak. Testler: `tests/security/fason.spec.ts` (10 test, hepsi açık).

## Özet

**Başka firmanın verisi görünüyor mu? Hayır.** Aşağıdaki denemelerin hepsi engellendi:
- A firması, B'nin fasoncusunu, fason siparişini, zimmetini ve gereksinimini okuyamadı. Değiştirme, hammadde gönderme, teslim alma, e-posta gönderme, portal hesabı açma ve B'nin fasoncusuna sipariş açma denemeleri de engellendi.
- A'nın 1. fasoncusu, A'nın 2. fasoncusunun ve B'nin siparişlerini, stoğunu ve ekstresini göremedi. Bu siparişlerde durum değiştirme, fire ve sevk denemeleri engellendi.
- Müşteri portalı kullanıcısı fason portalı uçlarına giremedi.
- Fasoncu, firmanın ürün, müşteri, hammadde ve fason sipariş listelerine ve firma bilgilerine giremedi.
- Oturumsuz erişim yok.

**Ancak aynı firmanın içinde önemli açıklar var.** En önemlileri:
- **G1:** Fasoncu, firmanın satış fiyatını ve maliyetini görebiliyor.
- **H1:** Fasoncu portal hesapları e-posta doğrulama linki bozuk olduğu için hiç kullanılamıyor.
- **H3–H6:** Stok ve zimmet hesapları bozulabiliyor.

## Güvenlik ve yetki

| # | Bulgu | Nasıl tekrar edilir | Etki | Çözüm | Büyüklük |
|---|---|---|---|---|---|
| G1 | **Fasoncu, firmanın ticari bilgilerini görüyor** | Fasoncu portalında sipariş detayı yanıtı (`/api/portal/fason/orders/[id]`) ürünün tüm alanlarını döndürüyor: satış fiyatı (`unitPrice`), çift başı işçilik maliyeti, koli fiyatı, ürünün iç notları. | Ticari sır fasoncuya açık | Yanıtta yalnızca ürün kodu/adı ve reçete (parça, hammadde adı, gram, fire %) dönsün | S |
| G2 | **Pasif yapılan fasoncu portala girmeye devam ediyor** | Fasoncuyu pasif yap; portal hesabıyla giriş başarılı oluyor, siparişlerde işlem yapabiliyor | Ayrılan atölye veriyi görmeye ve değiştirmeye devam eder | Girişte ve her istekte fasoncunun aktifliği kontrol edilsin | S |
| G3 | **Fason izni olmayan kullanıcı fason verisini okuyabiliyor** | Yalnızca "Ürünler" izni olan EDITOR, `/api/subcontractor-orders` ve `/api/subcontractors` uçlarını okuyabiliyor (sayfa kapalı ama veri açık) | İzin sistemi aşılıyor | Bu API'ler `fason` iznine bağlansın (`lib/access.ts`) | S |
| G4 | Fasoncu, müşteri portalının kataloğunu görebiliyor | Fasoncu oturumuyla `/api/portal/me/catalog` 200 dönüyor (fiyat yok) | Düşük | Müşteri portalı uçları yalnızca müşteri portalı türüne açık olsun | S |
| G5 | Fason sipariş e-postasında HTML kaçışı yok | Atölye, ürün ya da parça adına veya nota HTML yazılırsa e-postaya olduğu gibi giriyor | E-postada sahte bağlantı ya da biçim bozulması | Tüm değerler kaçışlansın | S |
| G6 | Portal hesabı için şifre kuralı yok; şifre e-postayla düz metin gidiyor | Firma, fasoncuya "1" şifresiyle hesap açabiliyor | Zayıf hesaplar | Şifre kuralı uygulansın (diğer hesaplarla aynı). Şifre e-postada gönderilmesin; "şifreni belirle" bağlantısı gönderilsin | M |

## Hatalar (işlev)

| # | Bulgu | Nasıl tekrar edilir | Etki | Çözüm | Büyüklük |
|---|---|---|---|---|---|
| H1 | **Fasoncu e-posta doğrulama linki çalışmıyor** | Portal hesabı oluşturulunca giden linkteki `/portal/fason/verify-email` sayfası yok; giriş ekranına atıyor. Doğrulanmamış hesap giriş yapamıyor. | **Firmanın açtığı fasoncu portal hesapları kullanılamıyor** | Link mevcut `/portal/verify-email` sayfasına gitsin, sonra fason girişine dönsün. Firma açtığı hesabı "doğrulanmış" sayabilir. | S |
| H2 | **Fasoncular listesinde herkes "Pasif" görünüyor** | Fasoncular sayfası: aktif atölyeler "Pasif" rozetiyle listeleniyor | Yanıltıcı | Liste yanıtına `isActive` eklensin | S |
| H3 | **"Teslim Al" iki kez basılınca ürün stoğu iki kez artıyor** | Teslim al (100 çift) → tekrar teslim al → stok +200 | Stok hatalı | Teslim alınmış siparişte tekrar teslim alma kapansın; kısmi teslim ayrı tasarlansın (Ö1) | S |
| H4 | **"Teslim Al", fasoncu zimmetinden hammadde tüketimini düşmüyor** | Hammadde gönder (10 kg) → Teslim Al → zimmet yine 10 kg | Fasoncu zimmeti sürekli şişiyor | Teslim almada reçeteye göre tüketim zimmetten düşülsün; durumu elle "Teslim Alındı" yapma ile aynı kural | S |
| H5 | Durum elle değiştirilince tüketim tekrar düşüyor; geçersiz durum sunucu hatası veriyor | Teslim Alındı → Bekliyor → Teslim Alındı: zimmet iki kez düşüyor. `status: "FOO"` 500 dönüyor. | Zimmet hatalı | Firma tarafında durum geçiş kuralları; tüketim bir kez yapılsın | S |
| H6 | Depoda olandan fazla hammadde gönderilebiliyor | 5 kg stok varken 50 kg gönder → depo −45 kg | Stok eksiye düşüyor | Yetersiz stokta uyarı/engel | S |
| H7 | Teslim alınmış ya da iptal edilmiş siparişe hammadde gönderilebiliyor | Teslim alınmış sipariş → hammadde gönder → 200 | Kayıt karmaşası | Kapanmış siparişte hammadde gönderme kapalı | S |
| H8 | Fasoncu zimmetinden fazla fire girebiliyor | Zimmet 10 kg, fire 9999 kg → kabul; zimmet eksiye düşüyor. Siparişle ilgisiz hammaddeye ve kapanmış siparişe de fire girilebiliyor. | Zimmet hatalı | Fire ≤ zimmet; yalnızca siparişin hammaddeleri; yalnızca açık siparişte | S |
| H9 | Üretilen adet doğrulanmıyor; portalda üretilen adet girme alanı yok | API negatif ya da sipariş adedinden fazla adet kabul ediyor. Portal ekranı yalnızca durum düğmesi gösteriyor. | Firma üretim ilerlemesini göremiyor | Portala "bugün üretilen" girişi; 0 ≤ toplam ≤ sipariş adedi | M |
| H10 | "Sevk et" durumu değiştirmiyor, tekrar tekrar basılabiliyor | Tamamlanan siparişte iki kez sevk → iki aynı kayıt, durum hâlâ "Tamamlandı" | Firma sevk edildiğini ayırt edemiyor | Sevk ayrı bir durum ya da tek seferlik kayıt olsun; firma tarafında "Sevk edildi, teslim bekleniyor" görünsün | S |
| H11 | Negatif ya da sayı olmayan numara dağılımıyla sipariş açılabiliyor | `{40: -50, 41: "abc"}` → toplam −50 çift | Hatalı sipariş | Numara dağılımı doğrulansın (pozitif tam sayı, toplam > 0) | S |
| H12 | Zimmeti olan fasoncuyu silmek sunucu hatası veriyor; başka firmanın fasoncusunda "başarılı" dönüyor | Silme → 500. Başka firmanın kimliğiyle → `ok: true` (silmiyor) | Kafa karıştırıcı | Zimmet/transfer varsa anlaşılır mesaj ya da pasife alma; bulunamazsa 404 | S |
| H13 | Hammadde gönderme hatası ekranda görünmüyor | API hata dönse de form sessizce boşalıyor | Kullanıcı gönderdiğini sanıyor | Hata mesajı gösterilsin | S |
| H14 | Mobil uygulama fasoncuyu yanlış adrese yönlendiriyor | Mobil portalda "solecost.com/portal" yazıyor; fason girişi `/portal/fason/login` | Fasoncu kayboluyor | Doğru adres ve dokununca açılan bağlantı | S |
| H15 | Fason e-postaları eski turuncu renkte | Sipariş ve hesap e-postalarında `#d97706` | Marka tutarsızlığı | Bordo tema | S |

## Kullanım kolaylığı

| # | Bulgu | Öneri | Büyüklük |
|---|---|---|---|
| K1 | Fason sipariş listesinde üretim ilerlemesi ve geciken termin uyarısı yok | "560 / 1.000 çift" ilerleme çubuğu; termini geçenler kırmızı | S |
| K2 | Portal ana sayfası farklı hammaddeleri toplayıp tek sayı gösteriyor ("213.5 kg"); sayılar nokta ondalıklı (213.5, 12.00) | Hammadde bazında kısa liste; Türkçe sayı biçimi (213,5) | S |
| K3 | Portal giriş ekranında etiketler sarı ve okunması zor | Marka renkleri ve yeterli kontrast | S |
| K4 | Gereksinim tablosu "eksik" değerini fasoncunun tüm zimmetine göre hesaplıyor; bu siparişe ne gönderildiği görünmüyor | Sütunlar: gereken / bu siparişe gönderilen / kalan | M |
| K5 | Fason sipariş detayında "İptal Et" en üstte ve çok belirgin | Daha fazla menüsüne alınsın | S |
| K6 | Portal sipariş detayında durum düğmeleri açıklamasız; üretim geçmişinde aynı başlık tekrarlanıyor | Düğme altında kısa açıklama; geçmişte üretilen adet ve kişi | S |
| K7 | Telefonda firma fason detayındaki numara tablosu sıkışık, yatay kayıyor | Telefonda numara/adet kartları (portaldaki gibi) | S |

## Geliştirme önerileri

| # | Öneri | Neden | Büyüklük |
|---|---|---|---|
| Ö1 | **Kısmi teslim alma** (parti parti), teslim alınan ile sipariş farkı | Atölyeler genelde parça parça teslim eder | M |
| Ö2 | **Fason işçilik ücreti ve fasoncu cari hesabı**: çift başı ücret, teslimde borç, ödeme, fasoncu ekstresi | Fasoncuya ne kadar borçlu olunduğu şu an takip edilemiyor | L |
| Ö3 | Sipariş ekranından **hammadde iadesi alma** (API var, ekranda yok) | Artan hammadde depoya döner | S |
| Ö4 | Fasoncu portalında numara bazında günlük üretim girişi ve fotoğraf | Firma ilerlemeyi gerçek zamanlı görür | M |
| Ö5 | Mobil uygulamada fasoncu ekranları (şu an web'e yönlendiriyor) | Atölyeler telefonla çalışır | L |
| Ö6 | Fason durum değişikliklerinde firmaya bildirim (push ve bildirim kutusu) | "Üretime başladı", "Tamamlandı", "Sevk edildi" anında görünsün | S |
| Ö7 | Fason siparişe koli etiketi ve irsaliye çıktısı | Teslimatta kontrol kolaylaşır | M |
| Ö8 | Termini yaklaşan ve geciken fason siparişler ana sayfada ve günlük özet e-postasında | Gecikmeler kaçmasın | S |

## Önerilen düzeltme sırası
1. **Hemen (tek PR):** G1, G2, G3, H1, H2, H3, H4.
2. **Sonra:** H5–H13, G4–G6, K1–K3.
3. **Planlanacak:** Ö1, Ö2, Ö4, Ö5 (daha büyük işler).
