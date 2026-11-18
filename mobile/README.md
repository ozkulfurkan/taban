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
`eas.json` ve mağaza gönderimi ayrı adımda eklenecek (bundle id: `com.solecost.app`).
