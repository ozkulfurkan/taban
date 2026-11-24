// Konsept · "Personel defteri cebinizde": maaş, avans, prim, mesai, izin
window.CONCEPT = {
  scenes: [
    hookScene({ eyebrow: 'Personel', title: 'Maaş, avans, izin…<br>hâlâ <em>defterde mi?</em>', items: ['Ahmet\'e bu ay ne kadar avans verdik?', 'Kaç gün izni kaldı?', 'Mesai parası ödendi mi?'] }),
    webScene({ eyebrow: '1 · Personel listesi', title: 'Tüm ekibiniz,<br><em>bakiyesiyle</em> tek listede.', sub: 'Maaş günü yaklaşanlar bir bakışta.', src: 'e-personel-liste', zoom: [1, 1.35], origin: [.5, .45] }),
    webScene({ eyebrow: '2 · Personel cari', title: 'Hakediş, avans, prim, mesai:<br><em>her kuruş kayıtlı.</em>', sub: 'Ödemeler kasanıza da işlenir.', src: 'e-personel-detay', zoom: [1, 1.55], origin: [.45, .5], headSize: SQ ? 56 : 74 }),
    phoneScene({ eyebrow: '3 · Cebinizde', title: 'Avansı<br><em>verdiğiniz an</em> girin.', src: 'em-personel', swaps: [[2, 'em-personel-detay']] }),
    closingScene({ tagline: 'Ekibinizin hesabı<br><em>her an net.</em>' }),
  ],
};
