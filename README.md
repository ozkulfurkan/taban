# SoleCost (taban)

Taban üreticileri için maliyet hesaplama ve işletme yönetimi: maliyet, satış/alış, ödemeler, çekler, siparişler, fason, personel, müşteri ve fasoncu portalı.

Next.js 14 (App Router) · Prisma 6 · PostgreSQL (Neon) · NextAuth · Vercel

## Yerelde çalıştırma

```bash
npm ci
cp .env.example .env          # DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
npm run db:deploy             # migration'ları uygular (boş veritabanında da çalışır)
npm run db:seed:test          # örnek firma, ürün, müşteri, fatura...
npm run dev
```

Test kullanıcısı: `test@solecost.com` / `Test123456` (`TEST_EMAIL` ve `TEST_PASSWORD` ile değiştirilebilir).

## Testler

| Komut | Ne test eder | Gereken |
|---|---|---|
| `npm run test:unit` | Para hesapları, sayı okuma, tarih, doğrulama | — |
| `npm run test:api` | Fatura, ödeme, belge numarası, stok, sayfalama | çalışan uygulama + veritabanı |
| `npm run test:security` | Firmalar arası veri ayrımı, roller, oturum, deneme sınırı | çalışan uygulama + veritabanı |
| `npm test` | Hepsi + tarayıcıda uçtan uca testler | çalışan uygulama + veritabanı |

Uygulama `http://localhost:3000` adresinde çalışırken (`npm run build && npm run start`) testler o adrese bağlanır; farklı adres için `BASE_URL`. API ve güvenlik testleri kendi test firmalarını oluşturur, mevcut veriye dokunmaz. **Canlı veritabanına karşı çalıştırmayın.**

Önceden kurulu bir Chromium kullanmak için: `PW_CHROMIUM_PATH=/yol/chromium npx playwright test`.

GitHub Actions (`.github/workflows/ci.yml`) her PR'da bunların hepsini boş bir Postgres üzerinde çalıştırır.

## Veritabanı değişiklikleri

1. `prisma/schema.prisma`'yı değiştir.
2. `npx prisma migrate dev --name aciklama` ile migration oluştur.
3. Canlıya almadan önce migration'ı Neon'da uygula: `DATABASE_URL=<canlı> npm run db:deploy` ya da SQL dosyasını Neon SQL Editor'de çalıştır.

`prisma db push` kullanmayın: değişiklik migration geçmişine yazılmaz ve yeni ortamlar kurulamaz hale gelir (bkz. `20260513000000_catch_up_schema`). CI, şema ile migration'lar uyuşmazsa hata verir.

## Kod düzeni

- `lib/access.ts`: rol, sayfa izni ve portal erişim kuralları (middleware ve menü aynı kuralı kullanır)
- `lib/tenant.ts`: istekle gelen kimliklerin aynı firmaya ait olduğunu doğrular (`rejectForeignRefs`)
- `lib/money.ts`: tutar okuma, yuvarlama, fatura toplamı, müşteri bakiyesi
- `lib/doc-number.ts`: fatura, sipariş vb. belge numaraları (sayaç tablosu)
- `lib/pagination.ts`: liste API'lerinde sayfalama
