// Konsept · "Ekstre linki": müşteri güncel ekstresini linkten görür
window.CONCEPT = {
  scenes: [
    hookScene({ eyebrow: 'Ekstre', title: '"Bakiyemi atar mısınız?"<br><em>Her gün aynı soru.</em>', size: SQ ? 72 : 88, items: ['Ekstre Excel\'de…', 'Hangi mailde göndermiştik?', 'Bu güncel mi?'] }),
    webScene({ eyebrow: '1 · Cari ekstre', title: 'Tüm hareketler,<br><em>bakiyesiyle</em> tek sayfada.', sub: 'Excel ve PDF bir tık uzakta.', src: 'e-musteri-ekstre', zoom: [1, 1.5], origin: [.4, .32] }),
    phoneScene({ eyebrow: '2 · Link gönder', title: 'Ekstreyi <em>link</em> olarak<br>gönderin.', sub: 'WhatsApp, SMS ya da e-posta.', src: 'em-cari-ekstre' }),
    phoneScene({ eyebrow: '3 · Müşteriniz', title: 'Güncel ekstre<br><em>her an</em> elinde.', sub: 'Giriş gerekmez; linki istediğiniz an kapatırsınız.', src: 'e-ekstre-link-m', scroll: 260 }),
    closingScene({ tagline: 'Bakiye sorusu<br><em>tarihe karıştı.</em>' }),
  ],
};
