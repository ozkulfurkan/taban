---
name: verify
description: SoleCost web değişikliğini çalışan uygulamada (demo veritabanı) tarayıcıyla doğrulama tarifi.
---

# SoleCost doğrulama

## Ayağa kaldırma
```bash
service postgresql start                       # konteyner yeniden başlayınca kapanır
pkill -f "next start"; pkill -f next-server    # eski sunucu (EADDRINUSE)
npm run build
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taban_demo NEXTAUTH_URL=http://localhost:3001 npx next start -p 3001 &
```
- Yeni migration varsa önce demo veritabanına uygula:
  `PGPASSWORD=postgres psql -h localhost -U postgres -d taban_demo -f prisma/migrations/<ad>/migration.sql`
- Demo verisi `tools/promo-video/demo-data.ts` ile üretilir.

## Hesaplar (demo)
- **Firma:** `test@solecost.com` / `Test123456` (giriş: `/login` → `/dashboard`).
- **Portal müşterisi:** `portal@ayakkabidunyasi.demo` / `Demo12345` (giriş: `/portal/login`).
- İlk girişte "yenilikler" penceresi açılmasın:
  `localStorage.setItem('whats_new_v20260510', '1')` (addInitScript ile).

## Sürme
- Geçici Playwright betiklerini `tools/promo-video/_*.tmp.ts` olarak yaz, `npx tsx` ile çalıştır, işin bitince sil.
- Tarayıcı:
  - Playwright betiklerinde: `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`.
  - Playwright test paketinde: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`.
- Veritabanı kontrolü: `PGPASSWORD=postgres psql -h localhost -U postgres -d taban_demo -tAc "…"`.
- Telefon görünümü: `viewport 390x844, isMobile: true`. Firma ve müşteri için iki ayrı context aç.

## Gotchas
- `page.evaluate` içine tsx'in derlediği isimli arrow fonksiyon verme (`__name is not defined`); string ifade ver.
- `/portal/orders/new` adresi `/portal/orders/[^/]+` kalıbına uyar; gönderimden sonra beklerken `/new` dışında olmasını şart koş.
- "Aynı anda iki tıklama" probu: `btn.evaluate(el => { el.click(); el.click(); })`.
- Konsoldaki 502 / "Failed to fetch RSC payload" hataları dış kur servisinden ve prefetch'ten gelir; değişiklikle ilgisi yoktur.
