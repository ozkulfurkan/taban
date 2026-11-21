# Hatalar

Bildirilen hatalar burada toplanır. Durum: **Bekliyor** → **Yapılıyor** → **Düzeltildi** (PR linkiyle).
Öncelik: **Acil** (iş durduruyor) · **Normal** · **Düşük**.

| No | Başlık | Öncelik | Durum |
| --- | --- | --- | --- |
| H-1 | Mobil portalda "Yeni sipariş" açılmıyor, ürünler gelmiyor | Acil | Bekliyor |

---

## H-1 · Mobil portalda "Yeni sipariş" açılmıyor, ürünler gelmiyor
- **Tarih:** 21.11.2026
- **Öncelik:** Acil (portal müşterisi mobilden sipariş veremiyor)
- **Durum:** Bekliyor
- **Belirti:** Portal müşterisi mobil uygulamada "Yeni sipariş"e dokununca ekran değişmiyor, katalog ve ürünler gelmiyor. Ürünler portalda tüm müşterilere açık, yani sorun veride değil.
- **Nasıl tekrar edilir:** Mobilde portal müşterisi olarak giriş yapın → ana sayfada "Yeni sipariş"e dokunun → hiçbir şey olmaz.
- **Kök neden:**
  - Firma kullanıcıları için eklenen katalog ekranı (`mobile/src/app/(app)/katalog/index.tsx`, commit `b038941`) ile portalın sipariş kataloğu (`mobile/src/app/(portal)/katalog.tsx`) aynı adresi (`/katalog`) kullanıyor.
  - Portaldaki buton (`mobile/src/app/(portal)/portal.tsx:57`, `router.push('/katalog')`) firma tarafındaki ekrana gidiyor. O ekran portal kullanıcısına kapalı olduğu için geçiş sessizce reddediliyor.
- **Önerilen düzeltme:**
  - Portal ekranının adı `portal-katalog.tsx` olur, buton `/portal-katalog`'a gider (portal ayarları zaten `portal-ayarlar` adıyla ayrılmış).
  - `mobile/tests/routes.test.ts` eklenir: firma ve portal ekranlarının adreslerini karşılaştırır, çakışma olursa test başarısız olur. Böylece aynı hata bir daha sessizce gelemez.
- **Etkilenen dosyalar:** `mobile/src/app/(portal)/katalog.tsx`, `mobile/src/app/(portal)/portal.tsx`, yeni `mobile/tests/routes.test.ts`
- **Not:** Düzeltmeden sonra yeni TestFlight derlemesi gerekir.
