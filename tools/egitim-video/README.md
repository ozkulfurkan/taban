# Eğitim videoları

Her modül için demo ortamında gerçek işlemleri yapan, ekranda adım adım açıklama yazan kullanım videoları.

- Modüller: `modules/*.mjs` (`{ slug, title, summary, recap, prepare?, as?, run(h) }`)
- Kayıt: `node tools/egitim-video/record.mjs [slug,...]` → `out/<slug>.mp4` (1920×1080)
  - Ön koşul: demo veritabanıyla web `:3001` (bkz. `.claude/skills/verify`), mobil video için mobil web çıktısı `:8090`
  - `STEPS=1` adımları yazdırır; hata olursa `out/_hata_<slug>.png`
- YouTube başlık/açıklama: `node tools/egitim-video/youtube.mjs > tools/egitim-video/youtube.json`
- Yayın: dosyalar `public/egitim/` altında (solecost.com/egitim/<slug>.mp4); YouTube'a bu adresten yüklenir
