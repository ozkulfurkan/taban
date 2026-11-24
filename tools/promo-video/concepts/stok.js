// Konsept · "Stoğunuz her an doğru": ürün ve hammadde stoğu, giriş/çıkış, barkod
window.CONCEPT = {
  scenes: [
    hookScene({ eyebrow: 'Stok', title: 'Depoda <em>kaç çift</em><br>kaldı?', items: ['Sayım yine tutmadı', 'Hammadde bitmiş, kimse fark etmemiş', '"Var sanıyordum…"'] }),
    phoneScene({ eyebrow: '1 · Ürün stoğu', title: 'Stok<br><em>cebinizde.</em>', sub: 'Satışla düşer, alışla artar.', src: 'em-stok' }),
    phoneScene({ eyebrow: '2 · Giriş / çıkış', title: 'Sayım farkını<br><em>tek dokunuşla</em> düzeltin.', src: 'em-stok-urun' }),
    webScene({ eyebrow: '3 · Hammadde', title: 'Hammadde stoğu<br><em>kilogramına kadar.</em>', sub: 'Fiyat ve stok aynı ekranda.', src: 'e-hammadde', zoom: [1, 1.5], origin: [.6, .3] }),
    webScene({ eyebrow: '4 · Barkod', title: 'Barkod etiketini<br><em>sistemden</em> yazdırın.', sub: 'Maliyet, reçete ve stok ürün sayfasında.', src: 'e-urun-detay', zoom: [1, 1.4], origin: [.35, .5] }),
    closingScene({ tagline: 'Stoğunuz<br><em>her an doğru.</em>' }),
  ],
};
