// Konsept · "Fasonunuz kontrol altında": fason sipariş, gönderilen hammadde, fire ve üretim takibi
function statScene() {
  const stats = [['Üretilen', 560, 1000, 'çift'], ['Atölyedeki hammadde', 196, null, 'kg TPR'], ['Bildirilen fire', 8.5, null, 'kg']];
  return {
    dur: 4.4, bg: 'krem',
    build(root) {
      this.hd = headline('3 · Üretim takibi', 'Kaç çift bitti,<br><em>ne kadar fire</em> verdi?', 'Atölye üretimi ve fireyi bildirir; siz anında görürsünüz.', { y: SQ ? 70 : 220, size: SQ ? 64 : 84 });
      root.append(this.hd);
      this.rows = stats.map(([label, v, of, unit], i) => {
        const r = el('div', '', `<div style="font:500 ${SQ ? 26 : 32}px/1 Geist;color:var(--ink-5)">${label}</div>
          <div style="display:flex;align-items:baseline;gap:14px;margin-top:14px"><span class="mono n" style="font:600 ${SQ ? 72 : 96}px/1 'Geist Mono';color:var(--bordo)">0</span>
          <span style="font:500 ${SQ ? 28 : 36}px/1 Geist;color:var(--ink)">${of ? `/ ${of.toLocaleString('tr-TR')} ` : ''}${unit}</span></div>
          ${of ? `<div style="height:14px;border-radius:7px;background:var(--ink-2);margin-top:20px;overflow:hidden"><div class="bar" style="height:100%;width:0;background:var(--bordo);border-radius:7px"></div></div>` : ''}`,
          { position: 'absolute', left: '80px', width: (W - 160) + 'px', top: (SQ ? 420 : 820) + i * (SQ ? 200 : 290) + 'px', background: '#fff', borderRadius: '30px', padding: SQ ? '28px 36px' : '40px 48px', boxShadow: '0 20px 40px -24px rgba(60,30,20,.35)' });
        root.append(r); r.v = v; r.of = of; return r;
      });
    },
    update(t) {
      animHead(this.hd, t, 0);
      this.rows.forEach((r, i) => {
        show(r, t, .7 + i * .3, 1.2 + i * .3, 40);
        const p = easeOut(seg(t, 1 + i * .3, 2.6 + i * .3));
        r.querySelector('.n').textContent = fmtTL(r.v * p, Number.isInteger(r.v) ? 0 : 1);
        const b = r.querySelector('.bar'); if (b) b.style.width = (r.v / r.of * 100 * p) + '%';
      });
    },
  };
}
window.CONCEPT = {
  scenes: [
    hookScene({ eyebrow: 'Fason üretim', title: 'Atölyeye giden<br>hammadde <em>nerede?</em>', items: ['420 kg TPR gönderildi… ya sonra?', 'Kaç çift bitti?', 'Fire ne kadar?', 'Termin ne zaman?'] }),
    webScene({ eyebrow: '1 · Fason sipariş', title: 'Her atölyeye<br><em>numara numara</em> sipariş.', sub: 'Durum ve termin tek listede.', src: 'e-fason-liste', zoom: [1, 1.45], origin: [.45, .22] }),
    webScene({ eyebrow: '2 · Hammadde', title: 'Gönderilen hammadde<br><em>kilogramıyla</em> kayıtlı.', sub: 'Gereken, gönderilen, kalan: hepsi hesaplı.', src: 'e-fason-detay', zoom: [1, 1.7], origin: [.42, .5], zoomAt: [1.1, 3.6] }),
    statScene(),
    closingScene({ tagline: 'Fasonunuz<br><em>kontrol altında.</em>' }),
  ],
};
