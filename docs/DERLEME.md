# Mobil derleme takibi

Expo'nun ücretsiz planındaki derleme hakkını korumak için mobil uygulama **toplu** derlenir:
mobil uygulamayı etkileyen **10 iş** (hata düzeltmesi ya da yeni geliştirme) birikince bir kez derlenir
(GitHub → Actions → **Mağazaya gönder (TestFlight / Play)** → platform **all**).

- Uygulamayı kullanılamaz yapan **acil** bir hata varsa beklemeden derlenir.
- Yalnızca web'i etkileyen işler sayılmaz; onlar Vercel'e anında gider.
- Her derlemeden sonra sayaç sıfırlanır ve aşağıya not edilir.

## Derleme bekleyen mobil işler: 1 / 10

| İş | Açıklama | PR |
| --- | --- | --- |
| G-12 | Usta/nakliyeci izinleri: panelde Siparişler kutucuğu, kullanıcı formunda yeni izinler | [#76](https://github.com/ozkulfurkan/taban/pull/76) |

Not: İlk Android derlemesi (Google Play dahili test, [#42](https://github.com/ozkulfurkan/taban/pull/42)) sayaçtan bağımsız yapılır; o derleme yukarıdaki işleri de Android'e getirir.

## Mağaza durumu

- **iOS:** App Store'da yayında (27.11.2026) — https://apps.apple.com/tr/app/solecost/id6836669345?l=tr
- **Android:** Google Play'de henüz yayında değil.

## Derleme geçmişi

| Tarih | Platform | İçerik |
| --- | --- | --- |
| 21.11.2026 | iOS | H-1…H-4, G-2…G-5 (#37–#40) |
| 25.11.2026 | iOS | **Acil:** App Store 3.1.1 reddi, uygulama içi kayıt kaldırıldı ([#63](https://github.com/ozkulfurkan/taban/pull/63)). Bekleyen işler de dahil: G-6 bildirim kutusu (#41), giriş alt yazısı (#43), Android ayarları (#44), fason portal düğmesi (#56), bildirim yoklaması 2 dk ve fotoğraf 1000 px (#62) |
