# SoleCost mobil uygulaması (Expo / React Native)

iOS ve Android için yerel uygulama. solecost.com API'lerini `Authorization: Bearer` token ile kullanır
(sunucu tarafı: `app/api/mobile/auth/*`, `middleware.ts`). İş kuralları, roller ve firma ayrımı sunucudadır.

## Yapı
- `src/app/` — ekranlar (expo-router). `(app)` firma kullanıcısı sekmeleri, `(portal)` müşteri portalı, `login`.
- `src/core/` — API istemcisi, oturum (güvenli depo), Face ID / parmak izi kilidi, ekstre PDF ve link paylaşımı.
- `src/components/` — ortak arayüz bileşenleri.
- `@shared/*` → kök dizindeki `../lib/*` saf modülleri (para, ekstre satırları, çek vadesi, kur). Web ile aynı hesap.

## Geliştirme
```bash
npm install
npx expo start            # Expo Go / geliştirme derlemesi
```
Yerel sunucuya bağlanmak için: `EXPO_PUBLIC_API_URL=http://<bilgisayar-ip>:3000 npx expo start`

Kontroller: `npm run typecheck`, `npx expo lint`, `npm test`.

## Derleme ve mağaza (EAS)
EAS projesi: `@ozkulfurkan/solecost` (bundle id: `com.solecost.app`). Build numarası EAS'ta tutulur, her üretim derlemesinde artar.

```bash
npx eas-cli build -p ios --profile production --auto-submit   # derle + TestFlight'a gönder
npx eas-cli build -p ios --profile preview                    # kayıtlı cihazlara iç dağıtım
```
İlk derlemede Apple ID girişi ve imzalama sertifikası sorulur (etkileşimli). Sürüm (`version`) `app.json`'dadır.

### GitHub'dan TestFlight'a gönderme (önerilen)
1. Bir kez: expo.dev → Account settings → **Access tokens** → yeni token. GitHub → depo **Settings → Secrets and variables → Actions → New repository secret**: adı `EXPO_TOKEN`.
2. Her güncellemede: GitHub → **Actions → "TestFlight'a gönder" → Run workflow** (platform: ios).
3. Derleme EAS'ta biter ve TestFlight'a otomatik gönderilir; durum expo.dev → Builds / Submissions'ta görünür. Build numarası otomatik artar.

Otomatik gönderim App Store Connect API anahtarı ister. Daha önce `--auto-submit` ile etkileşimli gönderim yapıldıysa EAS anahtarı saklamıştır. Gönderim adımı "ascAppId" isterse App Store Connect → Uygulama → Genel → **Apple ID** değerini `eas.json` → `submit.production.ios.ascAppId` alanına yazın.

