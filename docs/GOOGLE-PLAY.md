# Google Play'de dahili teste alma (adım adım)

Bu rehber SoleCost Android uygulamasını Google Play **dahili test** kanalına almak içindir. Dahili testte en fazla 100 kişi uygulamayı Play Store'dan indirir ve dakikalar içinde güncelleme alır. Google'ın 12 test edici / 14 gün kuralı bu aşamada geçerli değildir.

Hazır olanlar (repoda):
- Mağaza metni: `mobile/store/android/listing-tr.md`
- Uygulama simgesi (512×512), öne çıkan görsel (1024×500) ve 7 telefon ekran görüntüsü (1080×1920): `mobile/store/android/`
- Gizlilik sayfası: https://www.solecost.com/gizlilik
- Hesap silme sayfası: https://www.solecost.com/hesap-silme
- GitHub iş akışı: **Mağazaya gönder (TestFlight / Play)**

> Güvenlik: Aşağıdaki JSON anahtar dosyalarını (Firebase, Google hizmet hesabı) **asla** repoya, sohbete ya da e-postaya koymayın. Yalnızca Expo paneline yüklenirler.

---

## 1. Play Console'da uygulamayı oluşturun (10 dk)
1. https://play.google.com/console → **Uygulama oluştur**.
2. Uygulama adı: `SoleCost`, varsayılan dil: **Türkçe**, tür: **Uygulama**, ücret: **Ücretsiz**.
3. Beyanları işaretleyip oluşturun.

## 2. Firebase: Android'de anlık bildirim için (15 dk)
1. https://console.firebase.google.com → **Proje ekle** → ad `SoleCost` (Google Analytics gerekmez).
2. Proje ana sayfası → **Android simgesi** → paket adı: `com.solecost.app` → **Uygulamayı kaydet**.
3. **google-services.json** dosyasını indirin. Sonraki adımları (SDK ekleme) atlayın; Expo bunu kendisi yapar.
4. Expo paneli → https://expo.dev → `solecost` projesi → **Environment variables** → **Add variable**:
   - Name: `GOOGLE_SERVICES_JSON`
   - Type: **File** → indirdiğiniz `google-services.json`
   - Environment: **production**, Visibility: **Secret**
5. Firebase → ⚙️ **Proje ayarları** → **Hizmet hesapları** → **Yeni özel anahtar oluştur** → bir JSON dosyası iner.
6. Expo paneli → **Credentials** → **Android** → `com.solecost.app` → **FCM V1 service account key** → **Add** → bu JSON'u yükleyin.

## 3. Otomatik gönderim için Google hizmet hesabı (15 dk; ilk sürümden sonra da yapılabilir)
1. Play Console → **Ayarlar (Kurulum)** → **API erişimi** → Google Cloud projesi bağlayın (yoksa yeni oluşturun).
2. **Hizmet hesabı oluştur** bağlantısıyla Google Cloud'a gidin → hesap oluşturun → **Anahtarlar** → **Anahtar ekle** → **JSON** → dosya iner.
3. Play Console'a dönün → hizmet hesabının yanında **Erişim izni ver** → uygulama: SoleCost → izin: **Sürümleri yönet** (Sürüm yöneticisi) → kaydedin.
4. Expo paneli → **Credentials** → **Android** → **Google Service Account Key** → **Add** → JSON'u yükleyin.

## 4. İlk Android derlemesi (25 dk; 1 Expo derleme hakkı)
1. GitHub → **Actions** → **Mağazaya gönder (TestFlight / Play)** → **Run workflow**.
2. Platform: **android**, "Mağazaya otomatik gönder" kutusu: **işaretsiz** (Google ilk sürümün elle yüklenmesini şart koşar).
3. Derleme expo.dev → Builds sayfasında biter (yaklaşık 15–20 dk). **Download** ile `.aab` dosyasını indirin.
   - İlk Android derlemesinde Expo imzalama anahtarını kendisi oluşturur ve saklar; bir şey yapmanız gerekmez.

## 5. Dahili test sürümü (15 dk)
1. Play Console → **Test** → **Dahili test** → **Test ediciler** sekmesi → **E-posta listesi oluştur** → test edecek kişilerin Gmail adreslerini ekleyin → kaydedin.
2. **Sürümler** sekmesi → **Yeni sürüm oluştur**:
   - "Play Uygulama İmzalama" sorulursa **Google tarafından yönetilen anahtar** seçeneğiyle devam edin.
   - İndirdiğiniz `.aab` dosyasını yükleyin. Sürüm adı otomatik gelir.
   - Sürüm notu (tr-TR): `İlk test sürümü.`
3. **Sonraki** → **Kaydet** → **Yayınla / İncelemeye gönder**.
4. **Test ediciler** sekmesindeki **katılım bağlantısını** test edicilere gönderin. Bağlantıyı Android telefonda açıp "Test edici ol" diyenler uygulamayı Play Store'dan kurar.

> Dahili testin yayına girmesi için aşağıdaki **Uygulama içeriği** formlarının doldurulmuş olması gerekir. Play Console eksikleri **Kontrol paneli**nde listeler.

## 6. Uygulama içeriği formları (Politika → Uygulama içeriği) — hazır cevaplar
| Form | Cevap |
|---|---|
| Gizlilik politikası | `https://www.solecost.com/gizlilik` |
| Uygulama erişimi | "Tüm işlevler veya bazı işlevler kısıtlı" → giriş bilgisi verin: inceleme için açacağınız **demo firma hesabının** e-posta ve şifresi (gerçek müşteri verisi olmayan bir hesap açın) |
| Reklamlar | Hayır, reklam içermiyor |
| İçerik derecelendirmesi | Anket: kategori **Yardımcı programlar / Verimlilik / İletişim / Diğer**; şiddet, cinsellik, kumar vb. tüm sorulara **Hayır**; kullanıcılar arası etkileşim: **Evet** (firma–müşteri sipariş/portal) |
| Hedef kitle | **18 yaş ve üzeri**; çocuklara hitap etmiyor |
| Haber uygulaması | Hayır |
| Devlet uygulaması | Hayır |
| Finansal özellikler | "Uygulamam finansal özellik sunmuyor" (ödeme almıyor, kredi/yatırım yok; muhasebe kaydı tutmak finansal hizmet sayılmaz) |
| Sağlık | Hayır |
| Veri güvenliği | Aşağıdaki tablo |

### Veri güvenliği cevapları
- Veri topluyor ya da paylaşıyor mu? **Evet, topluyor.** Üçüncü taraflarla **paylaşmıyor** (barındırma, e-posta ve bildirim hizmet sağlayıcıları "paylaşım" sayılmaz).
- Aktarım sırasında şifreleniyor mu? **Evet.**
- Kullanıcı verilerinin silinmesini isteyebilir mi? **Evet** → `https://www.solecost.com/hesap-silme`
- Hesap oluşturma: **Kullanıcı adı ve şifreyle**; hesap silme bağlantısı: `https://www.solecost.com/hesap-silme`

| Veri türü | Toplanıyor | Amaç | Zorunlu mu |
|---|---|---|---|
| Kişisel bilgiler → Ad | Evet | Uygulama işlevleri, hesap yönetimi | Zorunlu |
| Kişisel bilgiler → E-posta adresi | Evet | Uygulama işlevleri, hesap yönetimi, iletişim | Zorunlu |
| Kişisel bilgiler → Telefon, adres | Evet (cari kartlarında) | Uygulama işlevleri | İsteğe bağlı |
| Finansal bilgiler → Diğer finansal bilgiler | Evet (fatura, ödeme, çek kayıtları) | Uygulama işlevleri | Zorunlu |
| Fotoğraflar | Evet (ürün fotoğrafları) | Uygulama işlevleri | İsteğe bağlı |
| Uygulama etkinliği → Diğer kullanıcı içeriği | Evet (sipariş, stok kayıtları) | Uygulama işlevleri | Zorunlu |
| Cihaz veya diğer kimlikler | Evet (bildirim anahtarı) | Uygulama işlevleri (bildirim) | İsteğe bağlı |

Konum, kişiler, sağlık, mesajlar, ses, takvim, web tarama geçmişi: **toplanmıyor**.

## 7. Mağaza kaydı (Büyüme → Mağazadaki varlık → Ana mağaza kaydı)
`mobile/store/android/listing-tr.md` dosyasındaki ad, kısa ve tam açıklamayı kopyalayın, görselleri yükleyin. Kategori: **İş**. Dahili test için mağaza kaydı zorunlu değil, ama kapalı teste geçerken gerekecek.

## 8. Sonraki sürümler
- Toplu derleme kuralına göre (10 mobil işte bir) GitHub → **Mağazaya gönder** → platform **all** (iOS + Android) ya da **android**, "otomatik gönder" **işaretli**.
- Android sürümü dahili teste **taslak** olarak düşer. Play Console → Dahili test → taslağı açıp **Yayınla** deyin. Uygulama henüz mağazada yayınlanmadığı için Google ilk yayına kadar taslak ister. Mağazada yayınlandıktan sonra `mobile/eas.json` içindeki `releaseStatus` `completed` yapılırsa doğrudan yayınlanır.

## 9. Herkese açık yayına geçiş (ileride)
Kişisel geliştirici hesabında üretime çıkmadan önce **kapalı testte en az 12 test edicinin 14 gün boyunca katılmış olması** gerekir. Sonra Play Console'dan **Üretime erişim başvurusu** yapılır.
