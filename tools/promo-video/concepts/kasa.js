// Konsept · "Kasa ve banka": TL/USD/EUR hesaplar, hareketler, mobil para girişi/çıkışı/transfer
window.CONCEPT = {
  scenes: [
    hookScene({ eyebrow: 'Kasa & banka', title: 'Kasada ne kadar,<br>bankada <em>ne kadar?</em>', items: ['Ana kasa?', 'Dolar hesabı?', 'Şube kasası?', 'Dün ne tahsil ettik?'] }),
    webScene({ eyebrow: '1 · Hesaplar', title: 'TL, dolar, euro:<br><em>tüm kasalarınız</em> tek ekranda.', src: 'e-hesaplar', zoom: [1, 1.4], origin: [.45, .3], headSize: SQ ? 58 : 76 }),
    webScene({ eyebrow: '2 · Hareketler', title: 'Her giriş ve çıkış,<br><em>kaynağıyla.</em>', sub: 'Tahsilat, ödeme, çek, transfer.', src: 'e-hesap-detay', zoom: [1, 1.5], origin: [.5, .45] }),
    phoneScene({ eyebrow: '3 · Cebinizde', title: 'Para girişi, çıkışı,<br><em>transfer.</em>', src: 'em-hesaplar', swaps: [[2.1, 'em-hesap']] }),
    closingScene({ tagline: 'Paranız<br><em>gözünüzün önünde.</em>' }),
  ],
};
