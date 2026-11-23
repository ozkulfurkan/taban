# SoleCost tanıtım videoları

Gerçek uygulama ekran görüntülerinden, marka diliyle (bordo–krem, Fraunces/Geist) **kare (1080×1080)** ve **story (1080×1920)** tanıtım videoları üretir. Videolar sessizdir; ekrandaki metinler alt yazı görevi görür. Seslendirme metinleri `seslendirme.md` dosyasındadır.

## Nasıl çalışır
- Her video `compose.html` içinde HTML olarak çizilir. Tüm animasyonlar zamana (`t`) bağlıdır.
- `render.mjs`, Playwright ile her kareyi (30 fps) alır ve `ffmpeg` ile H.264 MP4'e çevirir (Instagram/TikTok uyumlu, `yuv420p`, `+faststart`).
- Konseptler `concepts/*.js` dosyalarındadır. Her biri sahne listesinden oluşur: `dur` (süre), `bg` (`bordo` | `krem`), `build(root)` ve `update(t)`.

## Kullanım
1. **Demo verisi:** canlı veritabanında ÇALIŞTIRMAYIN.
   `DATABASE_URL=postgresql://…/taban_demo npx tsx tools/promo-video/demo-data.ts`
2. **Uygulamaları başlatın:**
   - demo veritabanıyla web uygulaması: `npx next start -p 3001`;
   - mobil uygulamanın web çıktısı: `cd mobile && EXPO_PUBLIC_API_URL=http://localhost:8090 npx expo export -p web`. Bu çıktıyı 8090 portunda sunan, `/api` isteklerini 3001'e ileten basit bir sunucu kurun.
3. **Ekran görüntüleri:** `npm run video:capture` (`shots/` klasörüne).
   - Katalog videosu için: `npx tsx tools/promo-video/capture-katalog.ts <ürün-fotoğrafı.jpg>`. Mobilde fotoğraflı ürün ekler, Katalog ekranında ürün seçer ve uygulamanın ürettiği gerçek katalog PDF'ini görüntüler (`k-*.png`). Önceki çalıştırmanın ürününü siler; tekrar çalıştırılabilir.
   - Süreç videosu için gerçek ekran kaydı: `DATABASE_URL=…/taban_demo npm run video:record`. Ürün → müşteri → satış → tahsilat → ekstre akışını uygulamada gerçekten yapar ve `shots/flow-web.webm` dosyasına kaydeder. İmleç izi `flow-web.js` dosyasına yazılır. Önceki kaydın ürün, müşteri, fatura ve tahsilatını siler; tekrar çalıştırılabilir.
4. **Videolar:** `npm run video:render`. Çıktı `out/` klasörüne gider: her konsept için `-story.mp4`, `-square.mp4` ve kapak PNG'si.
   - Tek video: `node tools/promo-video/render.mjs maliyet story`.
   - Hızlı kontrol (her saniyeden bir kare): `PREVIEW=1 node tools/promo-video/render.mjs maliyet story`.

Gereksinimler: `ffmpeg` ve Playwright ile Chromium. Playwright'ın kendi Chromium'u yoksa `PW_CHROMIUM_PATH` ile tarayıcı yolunu verin.

## Yeni konsept eklemek
`concepts/` altına yeni bir dosya ekleyin ve `window.CONCEPT = { scenes: [...] }` tanımlayın.

Kullanılabilecek yardımcılar:
- `headline(etiket, başlık, altMetin, {x,y,w,size})` ve `animHead(kutu, t)`;
- `phone(ekranAdı, {w,x,y})` (`.swap(ad)` ile ekran değiştirir);
- `browser(ekranAdı, {w,h,x,y})`;
- `show(öğe, t, başla, bitir)`;
- `seg`, `easeOut`, `easeInOut`, `lerp`, `fmtTL`;
- `closingScene({ tagline })`.

`SQ` değişkeni kare formatta `true` olur; yerleşimi buna göre ayarlayın. Story'de üst ve alt 250 px'i boş bırakın, çünkü Instagram arayüzü bu alanları örter.

## Konseptler
| Dosya | Konu |
|---|---|
| `maliyet.js` | Maliyet kuruşu kuruşuna: hammadde, fire ve işçilikten birim maliyete; kur etkisi; zarar uyarısı |
| `cek.js` | Çek vadesi kaçmasın: vade takvimi, çek portföyü, toplu bankaya verme, mobil |
| `portal.js` | Müşteriniz kendisi sipariş versin: katalog, bildirim, onay, sipariş takibi |
| `mobil.js` | İşletmeniz cebinizde: ana sayfa, cari, ekstre PDF paylaşımı, tahsilat, bildirimler |
| `katalog.js` | Kataloğunuz WhatsApp'ta: fotoğraflı ürün ekleme, Katalog ekranında seçim, PDF katalog, WhatsApp'tan gönderme ve gelen sipariş |
| `surec.js` | 5 adımda ilk satışınız (nasıl kullanılır): gerçek ekran kaydı. Yatay 16:9 videoda tam tarayıcı görünür; story ve karede kamera imleci takip edip yakınlaşır. Formatlar: `landscape`, `story`, `square` |

Bir konsept `formats: ['landscape', 'story', 'square']` ile hangi formatlarda üretileceğini belirleyebilir (varsayılan story + kare). Video kullanan sahnelerde `videoEl('dosya.webm')` ile oluşturulan öğenin `setTime(t)` sonucu `update` içinden döndürülür; motor karenin çözülmesini bekler.
