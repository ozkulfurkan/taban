# App Store yayını (iOS)

Uygulama: **SoleCost** · bundle id `com.solecost.app` · EAS `@ozkulfurkan/solecost` · Apple Team `9PQ3CYV264`

## 1. Derleme ve TestFlight
```bash
cd mobile
npx eas-cli build -p ios --profile production --auto-submit
```
- Yeni bir yetenek (ör. Push Notifications) eklenince ilk derleme **etkileşimli** çalıştırılır: Apple ile giriş yapılır, imzalama profili yeni yetenekle yeniden üretilir. Sonraki derlemeler etkileşimsiz çalışabilir.
- Build numarası EAS'ta tutulur ve her üretim derlemesinde artar; sürüm (`version`) `app.json`'dadır.
- Anlık bildirim için Apple Push Key EAS'a kayıtlı olmalı: `npx eas-cli credentials -p ios` → production → Push Notifications.

## 2. Mağaza bilgileri (otomatik)
Açıklama, alt başlık, anahtar kelimeler, kategori, yaş derecelendirmesi ve bağlantılar `store.config.json`'dadır:
```bash
npx eas-cli metadata:lint   # denetle
npx eas-cli metadata:push   # App Store Connect'e gönder (Apple girişi ister)
```

## 3. App Store Connect'te elle girilecekler
**App Review Information** (git'e konmaz):
- Demo hesap: test firması kullanıcı adı ve şifresi ("Sign-in required" işaretli)
- İletişim: ad, soyad, telefon (+90 …), e-posta
- Not önerisi: "SoleCost is a B2B management app for shoe-sole manufacturers and material suppliers. Accounts are created by companies on solecost.com; the app has no in-app purchases or sign-up. The demo account contains sample customers, orders, cheques and cash accounts."

**Fiyat ve bulunabilirlik:** Ücretsiz; ülkeler: Türkiye (gerekirse diğerleri).

**Ekran görüntüleri:** iPhone 6.9" (1320 × 2868) ya da 6.5" (1284 × 2778), en az 3 adet. iPad desteği kapalı (`supportsTablet: false`), iPad görüntüsü gerekmez.
Önerilen ekranlar: ana menü · cari detay (bakiye, satışlar) · sipariş listesi / sipariş föyü · çek portföyü · kasa & banka.

## 4. App Privacy (Uygulama Gizliliği) cevapları
Uygulamada reklam, analitik, konum, rehber, kamera ya da üçüncü taraf takip SDK'sı yoktur.

| Veri türü (Apple) | Toplanıyor mu | Amaç | Kullanıcıyla ilişkili | İzleme (tracking) |
|---|---|---|---|---|
| Contact Info → Name | Evet (hesap adı) | App Functionality | Evet | Hayır |
| Contact Info → Email Address | Evet (giriş) | App Functionality | Evet | Hayır |
| Contact Info → Phone Number | Evet (cari kartlarındaki telefonlar) | App Functionality | Evet | Hayır |
| Financial Info → Other Financial Info | Evet (bakiye, fatura, çek, personel maaşı) | App Functionality | Evet | Hayır |
| User Content → Other User Content | Evet (sipariş, not, belge) | App Functionality | Evet | Hayır |
| Identifiers → User ID | Evet (hesap kimliği) | App Functionality | Evet | Hayır |
| Diğer tüm türler (Location, Health, Browsing, Search, Diagnostics, Usage Data, Contacts, Photos…) | Hayır | — | — | — |

Notlar:
- Face ID / parmak izi cihazda doğrulanır, uygulamaya ya da sunucuya biyometrik veri gelmez.
- Bildirim için Expo push token'ı hesapla birlikte saklanır (yalnızca bildirim göndermek için); reklam kimliği (IDFA) kullanılmaz, App Tracking Transparency istemi gerekmez.
- Gizlilik politikası: https://www.solecost.com/gizlilik · Destek: https://www.solecost.com/destek

## 5. İnceleme riskleri (kontrol edildi)
- Uygulama içinde kayıt / satın alma yok; giriş ekranında web kayıt bağlantısı kaldırıldı (Kural 3.1.1).
- Hesap uygulamada açılmadığı için hesap silme zorunluluğu (5.1.1(v)) doğrudan uygulanmaz; Ayarlar'da "Hesap ve veri silme talebi" bağlantısı vardır.
- Şifreleme beyanı: `usesNonExemptEncryption: false` (yalnızca HTTPS).
- İzin metinleri: Face ID (`app.json`). Kamera kullanılmıyor, izin istenmiyor.
