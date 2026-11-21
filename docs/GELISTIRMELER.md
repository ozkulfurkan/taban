# Yeni geliştirmeler

"Yeni geliştirme" olarak istenenler burada toplanır. Liste gözden geçirilip "başla" denince seçilen maddeler yapılır.
Durum: **Bekliyor** → **Yapılıyor** → **Tamamlandı** (PR linkiyle). Büyüklük: **S** (birkaç saat) · **M** (bir gün) · **L** (birkaç gün).

| No | Başlık | Alan | Büyüklük | Durum |
| --- | --- | --- | --- | --- |
| G-1 | Mobil uygulamada dil seçimi (Türkçe / İngilizce) | Mobil | L | Bekliyor |

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
