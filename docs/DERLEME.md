# Mobil derleme takibi

Expo'nun ücretsiz planındaki derleme hakkını korumak için mobil uygulama **toplu** derlenir:
mobil uygulamayı etkileyen **10 iş** (hata düzeltmesi ya da yeni geliştirme) birikince bir kez derlenir
(GitHub → Actions → **Mağazaya gönder (TestFlight / Play)** → platform **all**).

- Uygulamayı kullanılamaz yapan **acil** bir hata varsa beklemeden derlenir.
- Yalnızca web'i etkileyen işler sayılmaz; onlar Vercel'e anında gider.
- Her derlemeden sonra sayaç sıfırlanır ve aşağıya not edilir.

## Derleme bekleyen mobil işler: 3 / 10

| İş | Açıklama | PR |
| --- | --- | --- |
| G-6 | Bildirim kutusu (zil, Bildirimler ekranı) | [#41](https://github.com/ozkulfurkan/taban/pull/41) |
| — | Giriş/karşılama alt yazısı: ayakkabı sektörü | [#43](https://github.com/ozkulfurkan/taban/pull/43) |
| — | Android: ekran yönü ve Wi-Fi donanım özellikleri isteğe bağlı (Play uyarısı) | [#44](https://github.com/ozkulfurkan/taban/pull/44) |

Not: İlk Android derlemesi (Google Play dahili test, [#42](https://github.com/ozkulfurkan/taban/pull/42)) sayaçtan bağımsız yapılır; o derleme yukarıdaki işleri de Android'e getirir.

## Derleme geçmişi

| Tarih | Platform | İçerik |
| --- | --- | --- |
| 21.11.2026 | iOS | H-1…H-4, G-2…G-5 (#37–#40) |
