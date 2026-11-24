# Yeni geliştirmeler

Mobil derleme sayacı: [DERLEME.md](DERLEME.md) (10 mobil işte bir derleme).

"Yeni geliştirme" olarak istenenler burada toplanır. Liste gözden geçirilip "başla" denince seçilen maddeler yapılır.
Durum: **Bekliyor** → **Yapılıyor** → **Tamamlandı** (PR linkiyle). Büyüklük: **S** (birkaç saat) · **M** (bir gün) · **L** (birkaç gün).

| No | Başlık | Alan | Büyüklük | Durum |
| --- | --- | --- | --- | --- |
| G-1 | Mobil uygulamada dil seçimi (Türkçe / İngilizce) | Mobil | L | Bekliyor |
| G-2 | Portal müşterisi kendi şifresini değiştirebilsin (mobilde "yetkiniz yok" hatası + web portal) | Web + mobil | S | Tamamlandı [#39](https://github.com/ozkulfurkan/taban/pull/39) |
| G-3 | Hammadde siparişinde renk yerine shore seçimi (Yumuşak / Standart / Sert) | Web + mobil + API | M | Tamamlandı [#40](https://github.com/ozkulfurkan/taban/pull/40) |
| G-4 | Shore değeri elle girilebilsin (örn. 65), "±2 shore oynayabilir" notu | Web + mobil + API | S | Tamamlandı [#40](https://github.com/ozkulfurkan/taban/pull/40) |
| G-5 | Mobilde ürünleri portalda göster/gizle (tekli ve çoklu); daha önce alınanlar üstte | Web + mobil + API | M | Tamamlandı [#39](https://github.com/ozkulfurkan/taban/pull/39) |
| G-6 | Web ve mobilde bildirim kutusu (geçmiş bildirimler) | Web + mobil + API | M | Tamamlandı [#41](https://github.com/ozkulfurkan/taban/pull/41) |

---

## G-1 · Mobil uygulamada dil seçimi (Türkçe / İngilizce)
- **Tarih:** 21.11.2026
- **İstek:** "Mobil uygulamada dil seçilmiyor. Ayarlara dil ayarı da koyalım."
- **Mevcut durum:**
  - Mobil uygulamada çeviri altyapısı yok. Ekran metinleri doğrudan Türkçe yazılmış (150'den fazla metin, onlarca ekran).
  - Web'de çeviri altyapısı var: `lib/i18n/translations.ts`, `lib/i18n/portal.ts`, `lib/i18n/language-context.tsx`.
  - Kullanıcı hesabında dil zaten tutuluyor (`User.language`, `PUT /api/settings`); mobil oturum bilgisinde de dönüyor.
- **Önerilen çözüm:**
  1. Mobilde küçük bir çeviri katmanı (`useT()` / `t('…')`). Web'in sözlükleri ortak kullanılır; mobile özgü metinler için `mobile/src/core/i18n.ts` eklenir.
  2. Ayarlar → **Dil**: Türkçe / English.
     - Firma kullanıcısında seçim hesaba kaydedilir, web ile aynı dil olur.
     - Portal kullanıcısında seçim cihazda saklanır.
     - İlk açılışta telefonun dili kullanılır.
  3. Tarih, sayı ve para biçimi seçilen dile göre (`tr-TR` / `en-US`).
  4. Metinler aşamalı çevrilir: önce giriş, ana sayfa, ayarlar ve portal (müşterinin gördüğü yerler), sonra firma ekranları.
- **Etkilenen alanlar:** mobil (ekran metinleri); portal kullanıcısının dili hesapta tutulacaksa API ve veritabanı.
- **Büyüklük:** L (birkaç gün). Yalnızca portal ve temel ekranlarla başlanırsa ilk aşama M.
- **Durum:** Bekliyor

---

## G-2 · Portal müşterisi kendi şifresini değiştirebilsin
- **Tarih:** 21.11.2026
- **İstek:** "Portal hesabında kullanıcı kendi şifresini değiştirebilsin."
- **Mevcut durum:**
  - Mobilde var: portal müşterisi Ayarlar → **Şifre değiştir** (PR #32).
  - Sunucu tarafı da hazır: `POST /api/account/password`, portal kullanıcısını da destekliyor.
  - **Web portalında yok:** şifre değiştirme kartı yalnızca firma Ayarlar sayfasında.
  - **Hata (21.11):** Mobilde portal müşterisi şifre değiştirince "Bu işlem için yetkiniz yok" uyarısı çıkıyor.
    - Neden: portal kullanıcılarının erişebildiği uçlar listesinde (`lib/access.ts` → `PORTAL_API_PREFIXES`) `/api/account/password` yok; ara katman isteği 403 ile reddediyor.
- **Önerilen çözüm:**
  - `PORTAL_API_PREFIXES` listesine `/api/account/password` eklenir.
  - Portal kullanıcısının şifre değiştirmesi API testine eklenir.
  - Web portalına "Hesabım / Şifre değiştir" sayfası ya da kartı eklenir (`app/portal/...`, mevcut `ChangePasswordCard` `portal-credentials` ile).
  - Portal üst menüsüne bağlantı eklenir.
  - Türkçe/İngilizce metinler `lib/i18n/portal.ts`'e eklenir.
- **Etkilenen alanlar:** web portal
- **Büyüklük:** S
- **Durum:** Tamamlandı [#39](https://github.com/ozkulfurkan/taban/pull/39)

---

## G-3 · Hammadde siparişinde renk yerine shore seçimi
- **Tarih:** 21.11.2026
- **İstek:** "Tabancı hammaddeciden sipariş geçtiğinde renk yazmasına gerek olmasın. Onun yerine shore değeri seçsin. Yumuşak, standart ve sert olarak seçim yapsın."
- **Mevcut durum:**
  - Sipariş kaleminde (firma ağı siparişi, portal, mobil) renk alanı her ürün için soruluyor.
  - Üründe `shore` alanı var (`Product.shore`), ama siparişte seçilmiyor.
- **Önerilen çözüm:**
  - Hammadde (çift olmayan birim: kg / metre / adet) siparişinde renk alanı gizlenir; yerine **Shore** seçimi gelir: Yumuşak / Standart / Sert.
  - Taban (çift) siparişinde renk aynen kalır.
  - Seçim sipariş kaleminde (`orderItems[].shore`) saklanır. Şunlarda gösterilir:
    - satıcının sipariş detayı;
    - üretim föyü / PDF;
    - e-postalar;
    - alıcının "verilen siparişler" ekranı.
  - Web (`app/components/order-catalog.tsx`) ve mobil (`mobile/src/components/order-catalog.tsx`) kataloglarında, `lib/orders.ts` → `normalizeOrderItems` doğrulamasında.
- **Karar (21.11):** Hammadde siparişinde renk **tamamen kalkar**. Taban (çift) siparişinde renk aynen kalır.
- **Etkilenen alanlar:** web, mobil, API (veritabanı değişikliği yok; kalemler JSON)
- **Büyüklük:** M
- **Durum:** Tamamlandı [#40](https://github.com/ozkulfurkan/taban/pull/40)

---

## G-4 · Shore değeri elle girilebilsin
- **Tarih:** 21.11.2026
- **İstek:** "Shore değerini manuel giriş yeri olsun; oraya 65 yazsın ama not olarak ±2 shore oynar gibi bir yazı gözüksün."
- **Önerilen çözüm:**
  - G-3'teki seçimin yanında sayı alanı: **Shore (elle)**.
  - Alan 65 değeriyle dolu gelir. Kullanıcı değiştirebilir; elle girilen değer Yumuşak / Standart / Sert seçimiyle birlikte kaydedilir.
  - Alanın altında her zaman küçük not: "Shore değeri ±2 oynayabilir."
  - Not, sipariş detayında ve PDF'te de gösterilir.
  - Doğrulama: 0–100 arası tam sayı.
- **Karar (21.11):** Alan **65 hazır değeriyle** gelir; kullanıcı değiştirebilir.
- **Etkilenen alanlar:** web, mobil, API (G-3 ile birlikte yapılır)
- **Büyüklük:** S
- **Durum:** Tamamlandı [#40](https://github.com/ozkulfurkan/taban/pull/40)

---

## G-5 · Portal müşterisinin daha önce aldığı ürünler üstte listelensin
- **Tarih:** 21.11.2026
- **İstek:** "Her portal müşterisinin hesabında daha önce aldığı ürünler üstte listelensin."
- **Ek istek (21.11):** "Mobilde ürünler portalda gözüksün ya da gözükmesin seçilebilsin; çoklu seçimle de portalda gözükür hale gelsin."
- **Test sonucu (21.11):**
  - Portal kataloğu daha önce alınan ürünleri doğru şekilde üstte ve "Daha önce aldınız" işaretiyle döndürüyor.
  - Bir ürün faturadan, bir ürün siparişten alınmış olarak denendi; alınmamış ürün altta kaldı.
- **Mevcut durum:**
  - Portal **sipariş kataloğunda** (web ve mobil) bu zaten var: daha önce sipariş verilen ya da faturalanan ürünler üstte, "Daha önce aldınız" etiketiyle (commit `a540054`).
  - Ama sıralama müşterinin bu firmadaki sipariş ve fatura geçmişine bakıyor.
- **Önerilen çözüm:**
  - **Mobilde portal görünürlüğü:**
    - Ürün detayında "Portalda göster" anahtarı.
    - Ürün listesinde "Seç" modu: birden çok ürün işaretlenip tek seferde "Portalda göster" ya da "Portalda gizle" yapılır.
    - Kullanılan uçlar: mevcut `PUT /api/products/[id]/portal-visibility`; toplu işlem için yeni `POST /api/products/portal-visibility { ids, visible }` (yalnızca kendi firmasının ürünleri).
  - Gerekirse portal ana sayfasına (web + mobil) "Daha önce aldıklarınız" kısa listesi eklenir; dokununca katalogda o ürün açılır.
- **Karar (21.11):** Portal ana sayfasında ayrıca liste gerekmiyor; sipariş kataloğunda üstte olması yeterli.
- **Etkilenen alanlar:** web portal, mobil portal
- **Büyüklük:** S
- **Durum:** Tamamlandı [#39](https://github.com/ozkulfurkan/taban/pull/39)

## G-6 · Web ve mobilde bildirim kutusu
- **Tarih:** 21.11.2026
- **İstek:** "Mobil ve web'e bildirimler ekleyebilir miyiz? Daha önce gelen bildirimler orada listelense?"
- **Çözüm:**
  - Telefona giden her sipariş bildirimi (yeni sipariş; onay, durum, termin ve sevk) alıcı başına saklanır. Kayıtlar süresiz tutulur, liste sayfalıdır.
  - Web: üst barda zil ve okunmamış sayısı, açılır liste, `/bildirimler` ve `/portal/bildirimler` sayfaları.
  - Mobil: ana sayfa ve portal başlığında zil ve rozet, Bildirimler ekranı.
  - Bildirime dokununca ilgili sipariş açılır ve bildirim okundu olur. "Tümünü okundu yap" seçeneği var.
- **Karar (21.11):** Kapsam şimdilik mevcut sipariş bildirimleri; saklama süresiz.
- **Etkilenen alanlar:** web, mobil, API, veritabanı
- **Büyüklük:** M
- **Durum:** Tamamlandı [#41](https://github.com/ozkulfurkan/taban/pull/41)

## G-7 · Koli etiketi (tabancı ve ayakkabıcı)
- **Tarih:** 24.11.2026
- **İstek:** "Tabancılara ve ayakkabıcılara uygun bir formata getirelim. Onlar genelde koli için barkod yazdırıyor. Kolinin içinde ne var onu yazarlar. Hangi numaradan kaç tane şeklinde. Ve müşteri adı da yazabilirler."
- **Karar (24.11):** Barkod koli kaydına bağlanır. Hammaddeci firmalarda mevcut barkod ekranı aynen kalır. Önce web, mobil sonra.
- **1. aşama (web):**
  - Ürün ve gelen sipariş detayından Koli Etiketi.
  - İki kip: tek numara koli ("37 No × 40 çift") ve asorti koli ("36×1 37×2 …").
  - Etikette müşteri, renk, sipariş no, "Koli 1/3" ve tekrar etmeyen barkod.
  - Durum: PR açıldı [#54](https://github.com/ozkulfurkan/taban/pull/54); migration Neon onayı bekliyor.
- **2. aşama (mobil, sonraki derlemeye):**
  - Ürün ve sipariş ekranından koli etiketi (PDF / AirPrint).
  - Kamerayla koli barkodunu okutup içeriği görme.
  - İleride sevkiyatta ve stok sayımında okutma.
- **Etkilenen alanlar:** web, mobil, API, veritabanı
- **Büyüklük:** M (web) + M (mobil)
- **Durum:** 1. aşama incelemede, 2. aşama bekliyor

## G-8 · Müşteri portalı geliştirmeleri (mobil karşılıkları)
- **Tarih:** 24.11.2026
- **İstek:** "Geliştirmeye başla. Webte yap ve mobilde yapılacakları not et. Sonra yapacağız onu." Kapsam: "Hepsi" (`docs/PORTAL-DENETIM.md`).
- **Web:** tümü yapıldı, PR [#59](https://github.com/ozkulfurkan/taban/pull/59) birleşti (25.11); migration Neon'da çalıştırıldı.
- **Mobil uyumluluk:** mağazadaki sürüm bozulmaz. API'ler `shipment` (son sevkiyat) alanını dönmeye devam eder; eski biçimli sevkiyat kaydı "son sevkiyat" olarak işlenir.
- **Mobil portal (müşteri):**
  - onaydan önce sipariş iptali (`POST /api/portal/me/orders/:id/cancel`);
  - iptal ve değişiklik talebi; sipariş içi mesajlaşma (`/api/portal/me/orders/:id/messages`), okunmamış rozeti;
  - fiyat ve tahmini tutar: katalogda `price`, sipariş detayında `prices`;
  - sevkiyat listesi (`shipments[]`); her sevkiyatın irsaliyesi: `@shared/delivery-note-html` + `/delivery-note?shipment=` → expo-print ile PDF / paylaş;
  - ana sayfa kartları: termini yaklaşan, sevke hazır, yanıt bekleyen mesajlar;
  - liste filtresi 4 grup (Bekleyen / Üretimde / Sevk edilen / İptal); kaynak etiketi (Portaldan / Firma tarafından);
  - kg ürünlerde miktar girişi; mükerrer gönderimde 409 mesajı.
- **Mobil firma:**
  - gelen siparişte mesajlaşma ve talepleri Onayla/Reddet (`/api/orders/:id/messages`, `…/messages/:mid/resolve`);
  - kısmi sevk girişi: kalan miktarlar ve "Son sevkiyat" anahtarı (`shipment: { mode: 'new' | shipmentId, final }`);
  - yalnızca geçerli durumların listelenmesi (`nextStatuses`, `@shared/order-status`);
  - listede okunmamış mesaj ve talep rozetleri (`unreadMessages`, `openRequest`); irsaliye çıktısı.
- **Etkilenen alanlar:** mobil
- **Büyüklük:** L
- **Durum:** Web tamam, mobil bekliyor

<!--
Kayıt şablonu:

## G-n · Başlık
- **Tarih:**
- **İstek:** (kullanıcının sözleriyle)
- **Önerilen çözüm:**
- **Etkilenen alanlar:** web / mobil / API / veritabanı
- **Büyüklük:** S / M / L
- **Durum:** Bekliyor
-->
