# Yeni geliştirmeler

"Yeni geliştirme" olarak istenenler burada toplanır. Liste gözden geçirilip "başla" denince seçilen maddeler yapılır.
Durum: **Bekliyor** → **Yapılıyor** → **Tamamlandı** (PR linkiyle). Büyüklük: **S** (birkaç saat) · **M** (bir gün) · **L** (birkaç gün).

| No | Başlık | Alan | Büyüklük | Durum |
| --- | --- | --- | --- | --- |
| G-1 | Mobil uygulamada dil seçimi (Türkçe / İngilizce) | Mobil | L | Bekliyor |
| G-2 | Portal müşterisi kendi şifresini değiştirebilsin (web portal) | Web | S | Bekliyor |
| G-3 | Hammadde siparişinde renk yerine shore seçimi (Yumuşak / Standart / Sert) | Web + mobil + API | M | Bekliyor |
| G-4 | Shore değeri elle girilebilsin (örn. 65), "±2 shore oynayabilir" notu | Web + mobil + API | S | Bekliyor |
| G-5 | Portal müşterisinin daha önce aldığı ürünler üstte listelensin | Web + mobil | S | Bekliyor |

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
- **Önerilen çözüm:**
  - Web portalına "Hesabım / Şifre değiştir" sayfası ya da kartı eklenir (`app/portal/...`, mevcut `ChangePasswordCard` `portal-credentials` ile).
  - Portal üst menüsüne bağlantı eklenir.
  - Türkçe/İngilizce metinler `lib/i18n/portal.ts`'e eklenir.
- **Etkilenen alanlar:** web portal
- **Büyüklük:** S
- **Durum:** Bekliyor

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
- **Açık nokta:** Renk tamamen mi kalksın, yoksa isteğe bağlı mı dursun? Varsayılan öneri: hammaddede gizli, tabanda zorunlu.
- **Etkilenen alanlar:** web, mobil, API (veritabanı değişikliği yok; kalemler JSON)
- **Büyüklük:** M
- **Durum:** Bekliyor

---

## G-4 · Shore değeri elle girilebilsin
- **Tarih:** 21.11.2026
- **İstek:** "Shore değerini manuel giriş yeri olsun; oraya 65 yazsın ama not olarak ±2 shore oynar gibi bir yazı gözüksün."
- **Önerilen çözüm:**
  - G-3'teki seçimin yanında sayı alanı: **Shore (elle)**.
  - Örnek / yer tutucu "65". Değer girilirse Yumuşak/Standart/Sert yerine bu kullanılır.
  - Alanın altında her zaman küçük not: "Shore değeri ±2 oynayabilir."
  - Not, sipariş detayında ve PDF'te de gösterilir.
  - Doğrulama: 0–100 arası tam sayı.
- **Açık nokta:** "65" varsayılan değer olarak mı gelsin, yoksa yalnızca örnek (silik yazı) mı olsun? Öneri: örnek yazı.
- **Etkilenen alanlar:** web, mobil, API (G-3 ile birlikte yapılır)
- **Büyüklük:** S
- **Durum:** Bekliyor

---

## G-5 · Portal müşterisinin daha önce aldığı ürünler üstte listelensin
- **Tarih:** 21.11.2026
- **İstek:** "Her portal müşterisinin hesabında daha önce aldığı ürünler üstte listelensin."
- **Mevcut durum:**
  - Portal **sipariş kataloğunda** (web ve mobil) bu zaten var: daha önce sipariş verilen ya da faturalanan ürünler üstte, "Daha önce aldınız" etiketiyle (commit `a540054`).
  - Ama sıralama müşterinin bu firmadaki sipariş ve fatura geçmişine bakıyor.
- **Önerilen çözüm:**
  - Kontrol edilecek:
    - müşteride görünmüyorsa nedeni (ör. geçmiş siparişler farklı cari kaydına bağlı);
    - mobil portal ana sayfasında da "Son aldıklarınız" bölümü isteniyor mu.
  - Gerekirse portal ana sayfasına (web + mobil) "Daha önce aldıklarınız" kısa listesi eklenir; dokununca katalogda o ürün açılır.
- **Açık nokta:** Listenin görünmesi istenen yer katalog mu, portal ana sayfası mı?
- **Etkilenen alanlar:** web portal, mobil portal
- **Büyüklük:** S
- **Durum:** Bekliyor

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
