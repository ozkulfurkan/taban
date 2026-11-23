# App Store incelemesi: Guideline 2.1 bilgi talebine cevap

Apple, ilk gönderimde (1.0.0) "Guideline 2.1 – Information Needed" ile ek bilgi istedi. Bu bir ret değil; aşağıdaki iki şeyi hazırlayıp yeniden göndermek yeterli:

1. **Ekran kaydı** (gerçek iPhone'da, güncel iOS ile): aşağıdaki senaryo.
2. **Notes metni** (İngilizce): App Store Connect → uygulama → 1.0.0 → App Review Information → **Notes** alanına aynen yapıştırın. `<…>` yazan yerleri doldurun.

---

## 1. Ekran kaydı senaryosu (yaklaşık 3 dakika)

**Hazırlık**
- iPhone: Ayarlar → Denetim Merkezi → **Ekran Kaydı** ekli olsun.
- TestFlight'taki **son derlemeyi** (Apple'a gönderilen derlemeyle aynı) kurun.
- Kayıt için yeni bir e-posta adresi hazırlayın, örneğin `solecost.review2@gmail.com`. Kayıttan sonra gelen doğrulama e-postasındaki bağlantıya, kaydı durdurmadan telefondan tıklayacaksınız.
- Firma demo hesabında birkaç müşteri ve ürün bulunsun. Müşteri portalı demo hesabı da hazır olsun.

**Kayıt sırası** (kaydı başlatın; uygulama kapalıyken başlayın)
1. Ana ekrandan **SoleCost'u açın** (açılış ekranı görünsün).
2. **Kayıt:** Giriş ekranı → "Kayıt olun" → ad soyad, firma adı, yeni e-posta, şifre → Kayıt ol. "Doğrulama bağlantısı gönderdik" ekranını gösterin. Mail uygulamasına geçip bağlantıya dokunun, uygulamaya geri dönün.
3. **Giriş:** Yeni hesapla giriş yapın, ana sayfayı gösterin.
4. **Ana akış** (firma demo hesabıyla daha dolu görünür; isterseniz çıkış yapıp demo firma hesabıyla girin):
   - Müşteriler → bir müşteri → **Tahsilat** girin (kasa seçin, tutar yazın, kaydedin);
   - **Satış:** Yeni satış → ürün seçin → adet → kaydet;
   - **Ekstre** → PDF → paylaşım menüsünü gösterin;
   - **Siparişler** ve zil simgesiyle **Bildirimler**;
   - Ürünler, Çekler ekranlarını kısaca gezin.
5. **Müşteri portalı:** Ayarlar → Çıkış → giriş ekranında "Müşteri portalı" sekmesi → portal demo hesabıyla giriş → **Yeni sipariş** → katalogdan ürün → beden adetleri → sepete ekle → siparişi gönder → Siparişlerim.
6. **Hesap silme** (2. adımda açtığınız yeni hesapla; demo hesapları silmeyin): Çıkış → yeni hesapla giriş → **Ayarlar → Hesabımı sil** → "Onay kodu gönder" → e-postadaki 6 haneli kodu girin → silmeyi onaylayın → uygulamanın oturumu kapattığını gösterin.
7. Kaydı durdurun.

**Videoyu paylaşma:** Video büyükse Google Drive ya da iCloud'a yükleyip "bağlantıya sahip herkes görüntüleyebilir" paylaşım linkini Notes'taki `<VIDEO LINK>` yerine yazın. App Review Information'da "Attachment" alanı varsa dosyayı oraya da yükleyebilirsiniz.

**Sign-In Information:** Aynı sayfadaki "Sign-in required" bölümüne firma demo hesabının e-posta ve şifresini yazın. Portal hesabının bilgileri Notes'ta.

**Yeniden gönderme:** Notes'u kaydedin → App Review'daki **Resolution Center** mesajına kısa bir cevap yazın ("We added the requested information and screen recording to the App Review notes.") → **Submit for Review**.

---

## 2. Notes metni (kopyalayın)

```
Thank you for the review. Below is the requested information.

1) SCREEN RECORDING (iPhone, latest iOS, starts from app launch)
<VIDEO LINK>
It shows: app launch, account registration + email verification, login, main business flow (customers, collection/payment entry, sales invoice, account statement PDF share, orders, notifications), customer-portal login and ordering, and account deletion (Settings > Delete my account, confirmed with an emailed code).

2) PURPOSE AND AUDIENCE
SoleCost is a business management app for companies in the footwear industry (shoe makers, sole manufacturers, raw-material suppliers, wholesalers, subcontract workshops). It replaces paper ledgers and phone/WhatsApp ordering: product cost calculation, customer/supplier accounts (receivables, payments, statements), sales and purchase documents, stock, cheque portfolio with due-date tracking, orders, and a customer portal where a company's customers place orders and follow their status. The same account works on the web (solecost.com) and in this app.

3) HOW TO ACCESS (two account types)
The app interface is in Turkish. Login screen has two tabs: "Firma girişi" (company) and "Müşteri portalı" (customer portal).
- Company demo account ("Firma girişi"): <E-POSTA> / <ŞİFRE>
- Customer portal demo account ("Müşteri portalı" tab): <PORTAL E-POSTA> / <PORTAL ŞİFRE>
Main screens (Turkish -> English): Müşteriler = Customers, Tedarikçiler = Suppliers, Ürünler = Products, Satışlar = Sales, Alışlar = Purchases, Çekler = Cheques, Siparişler = Orders, Tahsilat = Collection (record a payment received), Ekstre = Account statement, Bildirimler (bell icon) = Notifications, Ayarlar = Settings.
Account deletion: Ayarlar (Settings) > Hesabımı sil (Delete my account) > a 6-digit code is emailed > confirm. The account is deactivated immediately and permanently deleted after 15 days (signing in within 15 days cancels the deletion; this is shown to the user). Customer-portal accounts are created and managed by the seller company; portal users can request deletion via the support page linked in Settings.
No sample files are needed. New accounts can also be created in the app ("Kayıt olun") after email verification.

4) EXTERNAL SERVICES
- Vercel: hosting of the web app and API used by the app
- Neon: PostgreSQL database
- Expo Push Notification Service + Apple Push Notification service: order notifications
- Google (Gmail SMTP): transactional emails (verification, password reset, deletion code, order emails)
- Central Bank of the Republic of Turkey (TCMB) public exchange rates: USD/EUR rates for cost and currency conversion
No payment processor, no in-app purchases, no ads, no analytics/tracking, no AI services, no location data.

5) REGIONAL DIFFERENCES
The app works the same in all regions. It is designed for businesses operating in Turkey (Turkish interface, TRY/USD/EUR currencies, TCMB exchange rates); there is no region-specific feature or content.

6) REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not applicable. SoleCost is a record-keeping tool for a company's own business data. It does not provide banking, payment, lending, investment or tax-filing services, does not move money, and contains no protected third-party content.

Other notes: The app has no public user-generated content (no social feed, chat or comments); each company only sees its own data. There is no paid content or in-app purchase in the app. Registration is open to any footwear-industry business; it is not a private/custom app for a single organization.
```

---

## Notlar
- Demo şifrelerini bu dosyaya ya da repoya yazmayın; yalnızca App Store Connect'e girin.
- Hesap silme kodunun e-postayla gelmesi için canlı ortamda SMTP ayarları (`SMTP_USER`, `SMTP_PASS`) doğru olmalı. Kayıttan önce kendi adresinizle bir kez deneyin.
- Kayıtta Apple'ın özellikle istediği üç şey: uygulamanın **açılıştan** başlaması, **kayıt ve giriş**, **hesap silme**. Bunlar eksikse inceleme yine geri döner.
