// Konsept · "Firma ağı": SoleCost kullanan firmalar birbirine bağlanır; sipariş doğrudan tedarikçinin sistemine düşer
window.CONCEPT = {
  scenes: [
    hookScene({ eyebrow: 'Firma ağı', title: 'Siparişi hâlâ<br><em>mesajla</em> mı yazıyorsunuz?', items: ['"Siyah, 40 numaradan 120 çift…"', 'Yanlış yazılan numara', 'Kaybolan mesaj', '"Siparişim ne durumda?"'] }),
    phoneScene({ eyebrow: '1 · Bağlanın', title: 'Firma kodunuzla<br><em>tek adımda</em> bağlanın.', sub: 'Müşteriniz kodu girer, siz onaylarsınız.', src: 'em-baglantilar' }),
    webScene({ eyebrow: '2 · Sipariş', title: 'Müşteriniz kataloğunuzdan<br><em>kendi panelinden</em> sipariş verir.', src: 'e-ag-siparis-ver', zoom: [1, 1.35], origin: [.5, .35], headSize: SQ ? 56 : 72 }),
    webScene({ eyebrow: '3 · Gelen sipariş', title: 'Sipariş <em>doğrudan</em><br>sisteminize düşer.', sub: 'Yeniden yazmak yok, numara hatası yok.', src: 'e-ag-gelen', zoom: [1, 1.8], origin: [.3, .42], zoomAt: [1.1, 3.4] }),
    webScene({ eyebrow: '4 · Takip', title: 'Müşteriniz durumu<br><em>anlık</em> görür.', sub: 'Onay, üretim, sevkiyat: her adım iki tarafta da.', src: 'e-ag-verilen-detay', zoom: [1, 1.45], origin: [.45, .35] }),
    closingScene({ tagline: 'Siparişler<br><em>yazışmadan, hatasız.</em>' }),
  ],
};
