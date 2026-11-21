# Hatalar

Bildirilen hatalar burada toplanır. Durum: **Bekliyor** → **Yapılıyor** → **Düzeltildi** (PR linkiyle).
Öncelik: **Acil** (iş durduruyor) · **Normal** · **Düşük**.

| No | Başlık | Öncelik | Durum |
| --- | --- | --- | --- |
| H-1 | Mobil portalda "Yeni sipariş" açılmıyor, ürünler gelmiyor | Acil | Bekliyor |
| H-2 | Bir e-posta yalnızca tek firmanın portal kullanıcısı olabiliyor | Normal | Bekliyor |
| H-3 | Mobilde portal hesabı açınca "Paylaş" hiçbir şey yapmıyor | Acil | Bekliyor |
| H-4 | Bazı e-postalar gönderilmeden kesiliyor (portal hesabı, doğrulama, yeni sipariş) | Acil | Bekliyor |

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

---

## H-2 · Bir e-posta yalnızca tek firmanın portal kullanıcısı olabiliyor
- **Tarih:** 21.11.2026
- **Öncelik:** Normal (aynı müşteri birden fazla tedarikçiyle çalışınca portal hesabı açılamıyor)
- **Durum:** Bekliyor
- **Beklenen kural:**
  - **Firma hesabı** (personel kullanıcısı): bir e-posta sistemde yalnızca bir kez kullanılabilir (bugünkü gibi).
  - **Portal kullanıcısı:** aynı e-posta birden fazla firmanın portal müşterisi olabilir (her firmada ayrı hesap). Aynı firmada aynı e-posta yine tek olmalı.
- **Belirti:** A firması bir müşterisine `ornek@…` ile portal hesabı açtıktan sonra, B firması aynı e-postayla kendi müşterisine portal hesabı açmaya çalışınca "Bu e-posta ile zaten bir portal hesabı var" hatası alıyor.
- **Kök neden:**
  - Veritabanında `PortalCustomer.email` tüm sistemde benzersiz (`prisma/schema.prisma`, `email String @unique`).
  - Hesap açma uçları e-postayı tüm firmalarda arıyor:
    - `app/api/portal/auth/register/route.ts:35`
    - `app/api/subcontractors/[id]/portal-register/route.ts:29` (fason portalı)
  - Giriş de e-postayla tek hesap arıyor: `lib/auth-options.ts` → `authorizePortalCustomer` (`findUnique({ where: { email } })`).
- **Önerilen düzeltme:**
  1. **Veritabanı:** `PortalCustomer`'a `companyId` alanı eklenir.
     - Mevcut kayıtlar bağlı oldukları müşteri ya da fasoncudan doldurulur.
     - E-postanın tek başına benzersizliği kaldırılır; yerine "firma + e-posta" benzersizliği gelir.
     - İdempotent migration yazılır; SQL'i PR'da verilir.
  2. **Hesap açma:** Yalnızca aynı firmada aynı e-posta reddedilir; başka firmadaki hesap engel olmaz.
  3. **Giriş (web ve mobil):**
     - Aynı e-posta ve şifreye uyan hesaplar bulunur.
     - Tek hesap varsa doğrudan girilir.
     - Birden fazla varsa "Hangi firmanın portalına girmek istiyorsunuz?" seçimi gösterilir; firma adları ve logolarıyla.
     - Oturum seçilen hesaba açılır. Portal içinde "Firma değiştir" seçeneği olur.
     - Şifreler her firmadaki hesap için ayrıdır.
  4. **E-posta ile çalışan akışlar firmaya göre ayrılır:**
     - doğrulama e-postası;
     - şifre sıfırlama;
     - sipariş bildirimleri (zaten hesap kimliğiyle gidiyor, değişmeyecek);
     - mobil bildirim kaydı (zaten hesap kimliğiyle).
  5. **Testler:**
     - iki firmada aynı e-postayla hesap açılabiliyor;
     - aynı firmada ikinci hesap reddediliyor;
     - girişte firma seçimi çalışıyor;
     - her hesap yalnızca kendi firmasının verisini görüyor (firma ayrımı testi).
- **Etkilenen dosyalar:**
  - `prisma/schema.prisma` ve yeni migration
  - `lib/auth-options.ts` (`authorizePortalCustomer`)
  - `app/api/portal/auth/register/route.ts`, `app/api/subcontractors/[id]/portal-register/route.ts`
  - `app/api/mobile/auth/login/route.ts`
  - web portal girişi: `app/portal/login/page.tsx`, `app/portal/fason/login/page.tsx`
  - mobil giriş: `mobile/src/app/login.tsx`, `mobile/src/core/auth.tsx`
- **Büyüklük:** M–L (giriş akışı ve veritabanı değişikliği içerdiği için dikkatli test gerekir)

---

## H-3 · Mobilde portal hesabı açınca "Paylaş" hiçbir şey yapmıyor
- **Tarih:** 21.11.2026
- **Öncelik:** Acil (müşteriye davet ve şifre iletilemiyor)
- **Durum:** Bekliyor
- **Belirti:** Mobilde müşteri → Portal / davet → "Portal hesabı aç" sonrası çıkan pencerede **Paylaş**'a basınca paylaşım ekranı açılmıyor. Şifre sıfırladıktan sonraki "Paylaş" da aynı.
- **Kök neden:**
  - Onay penceresi (`mobile/src/components/dialog-host.tsx`, React Native `Modal`) kapanırken paylaşım ekranı (`Share.share`) hemen açılmaya çalışılıyor.
  - iOS kapanmakta olan bir pencerenin üstüne yeni ekran açmayı sessizce reddediyor. Aynı sorun fotoğraf seçicide de vardı; orada 400 ms beklemeyle çözülmüştü.
  - Yer: `mobile/src/app/(app)/cariler/[kind]/[id]/portal.tsx`, `create` ve `update` içindeki `confirm(...)` ardından `invite(...)` çağrıları.
- **Önerilen düzeltme:**
  - Paylaşım, onay penceresi tamamen kapandıktan sonra açılır (kısa bekleme ya da pencerenin kapanma olayından sonra).
  - Ortak bir `shareAfterDialog` yardımcısı yazılır; bu desen başka yerlerde de kullanılabilir.
  - `Share.share` hatası yakalanıp kullanıcıya gösterilir.
  - Doğrudan "Davet gönder" butonu (pencere yok) zaten çalışıyor; ona dokunulmaz.
- **Etkilenen dosyalar:** `mobile/src/app/(app)/cariler/[kind]/[id]/portal.tsx`, `mobile/src/core/dialog.ts` (yardımcı)
- **Büyüklük:** S

---

## H-4 · Bazı e-postalar gönderilmeden kesiliyor
- **Tarih:** 21.11.2026
- **Öncelik:** Acil (müşteri doğrulama e-postası almazsa portala giremez)
- **Durum:** Bekliyor
- **Belirti:** Portal hesabı açıldığında müşteriye doğrulama ve geçici şifre e-postası gitmiyor olabilir.
- **Kök neden:**
  - Birçok yerde e-posta gönderimi **beklenmeden** başlatılıyor ve yanıt hemen dönüyor (`sendMail(...).catch(() => {})`).
  - Vercel'de istek yanıtlanınca işlem durdurulabildiği için e-posta yarıda kalabiliyor. Hata da yutulduğu için iz bırakmıyor.
  - Etkilenen yerler:
    - `app/api/portal/auth/register/route.ts`: portal hesabı açılınca doğrulama ve geçici şifre;
    - `app/api/subcontractors/[id]/portal-register/route.ts`: fason portal hesabı;
    - `lib/auth-options.ts` (iki yer) ve `lib/portal-auth-options.ts`: doğrulanmamış hesaba yeniden doğrulama e-postası;
    - `lib/orders.ts`: yeni siparişte üretim emri e-postası (firma yöneticilerine) ve müşteriye "siparişiniz alındı".
  - Sipariş durum, onay ve sevk e-postaları zaten bekleniyor; onlar etkilenmiyor.
- **Önerilen düzeltme:**
  - Bu çağrılar `await` ile beklenir. Hata durumunda işlem bozulmaz ama hata loglanır (`console.error`).
  - Portal hesabı açma yanıtına `emailSent: true/false` eklenir. Mobil ve web, e-posta gitmediyse "E-posta gönderilemedi, davet mesajını paylaşın" uyarısı gösterir.
  - Test bildirim kutusuyla (`NOTIFY_OUTBOX`) her akışta e-postanın gerçekten gönderildiği doğrulanır.
- **Ayrıca kontrol edilecek (sizin tarafınızda):** Vercel → Settings → Environment Variables'da `SMTP_USER`, `SMTP_PASS` (Gmail uygulama şifresi) ve `SMTP_FROM` tanımlı mı. Değilse hiçbir e-posta gitmez. Vercel → Logs'ta "Mail gönderildi" ya da SMTP hatası satırları görülür.
- **Etkilenen dosyalar:** yukarıdaki API ve lib dosyaları; `mobile/src/app/(app)/cariler/[kind]/[id]/portal.tsx` ve `app/portal-admin/page.tsx` (uyarı)
- **Büyüklük:** S–M
