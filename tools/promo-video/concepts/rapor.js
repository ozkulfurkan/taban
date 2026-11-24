// Konsept · "İşletmenin nabzı": ana sayfa, raporlar, web paneli ve her sabah gelen özet e-postası
function emailScene() {
  return {
    dur: 5, bg: 'krem',
    build(root) {
      this.hd = headline('4 · Günlük özet', 'Her sabah<br><em>e-postanızda.</em>', 'Bekleyen siparişler, kasa ve banka, dünkü satış.', SQ ? { x: 70, y: 300, w: 420, size: 62 } : { y: 170, size: 84 });
      root.append(this.hd);
      this.toast = el('div', 'toast', `<div class="ic">${ICON.bell}</div><div><div class="t1">SoleCost · Günlük özet</div><div class="t2">5 bekleyen sipariş · Dünkü tahsilat 20.000 TL</div></div>`,
        SQ ? { left: '520px', width: '500px', top: '70px', zIndex: 5 } : { left: '80px', width: (W - 160) + 'px', top: '560px', zIndex: 5 });
      const w = SQ ? 470 : 820;
      this.mail = el('div', '', `<img src="${SHOTS}e-gunluk-ozet.png" style="width:100%;display:block">`, {
        position: 'absolute', width: w + 'px', left: (SQ ? 535 : (W - w) / 2) + 'px', top: (SQ ? 230 : 760) + 'px', height: (SQ ? 800 : 1100) + 'px',
        overflow: 'hidden', borderRadius: '24px', background: '#F6F3EF', boxShadow: '0 50px 90px -30px rgba(60,30,20,.5)',
      });
      root.append(this.mail, this.toast);
    },
    update(t) {
      animHead(this.hd, t, 0);
      show(this.toast, t, .4, .9, -40);
      show(this.mail, t, 1.2, 1.9, 120);
      this.mail.querySelector('img').style.transform = `translateY(${-easeInOut(seg(t, 2.4, 4.8)) * (SQ ? 260 : 300)}px)`;
    },
  };
}
window.CONCEPT = {
  scenes: [
    hookScene({ eyebrow: 'Raporlar', title: 'Bugün işler<br><em>nasıl gidiyor?</em>', items: ['Kasada ne var?', 'Kimden alacağım var?', 'Bu ay ne sattık?', 'Hangi çekin vadesi geldi?'] }),
    phoneScene({ eyebrow: '1 · Ana sayfa', title: 'Kur, kısayollar,<br><em>tek bakışta.</em>', src: 'em-ana' }),
    phoneScene({ eyebrow: '2 · Raporlar', title: 'Alacak, borç, satış,<br><em>çekler.</em>', sub: 'Döviz bakiyeleri TL karşılığıyla.', src: 'em-raporlar', scroll: 120 }),
    webScene({ eyebrow: '3 · Web paneli', title: 'Tüm işletme<br><em>tek panelde.</em>', src: 'w-dashboard', zoom: [1, 1.3], origin: [.5, .3] }),
    emailScene(),
    closingScene({ tagline: 'İşletmenizin nabzı<br><em>elinizde.</em>' }),
  ],
};
