// Konsept 3 · "Müşteriniz kendisi sipariş versin"
// Tema: iki telefon (müşteri ve firma); sipariş, bildirim ve onay karşılıklı akar.
window.CONCEPT = {
  scenes: [
    // 1 · Kanca: cevapsız aramalar
    {
      dur: 3.6, bg: 'bordo',
      build(root) {
        this.hd = headline('Sipariş', 'Siparişleri hâlâ<br><em>telefonla mı</em><br>alıyorsunuz?', null, { y: SQ ? 110 : 280, size: SQ ? 86 : 108 });
        root.append(this.hd);
        const calls = [['Cevapsız arama (3)', 'Ayakkabı Dünyası · 09:12'], ['Sesli mesaj · 0:47', 'Moda Adım · 10:05'], ['"Beyaz değil krem olacaktı"', 'Yıldız Spor · 11:40']];
        this.calls = calls.map(([a, b], i) => {
          const c = el('div', 'toast', `<div class="ic" style="background:#C0362C">${ICON.x.replace(/22/g, '30').replace('currentColor', '#fff')}</div><div><div class="t1">${a}</div><div class="t2">${b}</div></div>`,
            { left: (80 + i * 20) + 'px', width: (W - 200) + 'px', top: ((SQ ? 610 : 1140) + i * (SQ ? 130 : 170)) + 'px' });
          root.append(c); return c;
        });
      },
      update(t) {
        animHead(this.hd, t, 0);
        this.calls.forEach((c, i) => {
          const p = easeOut(seg(t, 1 + i * .4, 1.4 + i * .4));
          c.style.opacity = p * (1 - seg(t, 3.1, 3.6)); c.style.transform = `translateY(${(1 - p) * -40}px) rotate(${[-1.5, 1, -.5][i]}deg)`;
        });
      },
    },
    // 2 · Müşteri katalogdan seçer
    {
      dur: 4.4, bg: 'bordo',
      build(root) {
        this.hd = headline('Müşteri portalı', 'Müşteriniz katalogdan<br><em>kendisi seçer.</em>', 'Sadece ona açtığınız ürünler, <b>fotoğraflı</b>.', SQ ? { x: 70, y: 260, w: 470, size: 62 } : { y: 180, size: 80 });
        root.append(this.hd);
        this.ph = SQ ? phone('p-katalog', { w: 420, x: 590, y: 110 }) : phone('p-katalog', { w: 600, x: 240, y: 640 });
        root.append(this.ph);
      },
      update(t) {
        animHead(this.hd, t, 0);
        const p = easeOut(seg(t, .3, 1.1));
        this.ph.style.opacity = p; this.ph.style.transform = `translateY(${(1 - p) * 140}px)`;
        if (t > 2.6) this.ph.swap('p-urun'); else this.ph.swap('p-katalog');
      },
    },
    // 3 · Firma anında haberdar olur (iki telefon)
    {
      dur: 5, bg: 'bordo',
      build(root) {
        this.hd = headline('Bildirim', 'Sipariş düştüğü an<br><em>telefonunuzda.</em>', null, { y: SQ ? 60 : 180, size: SQ ? 62 : 80 });
        root.append(this.hd);
        const w = SQ ? 360 : 440, y = SQ ? 330 : 640;
        this.a = phone('p-siparis', { w, x: SQ ? 110 : 70, y: y + 40 });
        this.b = phone('m-bildirimler', { w, x: SQ ? 610 : 570, y });
        this.la = el('div', 'pill', 'Müşteri', { position: 'absolute', left: (SQ ? 110 : 70) + 'px', top: (y + (SQ ? 0 : 0)) + 'px', background: 'rgba(246,237,228,.14)', color: 'var(--krem)' });
        this.lb = el('div', 'pill', 'Siz', { position: 'absolute', left: (SQ ? 610 : 570) + 'px', top: (y - 40) + 'px', background: 'var(--krem)', color: 'var(--bordo)' });
        this.toast = el('div', 'toast', `<div class="ic">${ICON.bell}</div><div><div class="t1">Yeni portal siparişi</div><div class="t2">Ayakkabı Dünyası · SIP-2026-0142 · 1.200 çift</div></div>`,
          { left: '60px', width: (W - 120) + 'px', top: (SQ ? 600 : 560) + 'px', zIndex: 5 });
        root.append(this.a, this.b, this.la, this.lb, this.toast);
      },
      update(t) {
        animHead(this.hd, t, 0);
        show(this.a, t, .3, 1, 120); show(this.b, t, .5, 1.2, 120); show(this.la, t, .8, 1.2, 20); show(this.lb, t, .9, 1.3, 20);
        const p = easeOut(seg(t, 1.8, 2.3)) * (1 - easeOut(seg(t, 4.2, 4.7)));
        this.toast.style.opacity = p; this.toast.style.transform = `translateY(${(1 - p) * -80}px)`;
      },
    },
    // 4 · Onay müşteriye gider
    {
      dur: 4.6, bg: 'bordo',
      build(root) {
        this.hd = headline('Onay', 'Onaylarsınız,<br>müşteri <em>anında öğrenir.</em>', 'Termin, üretim, sevkiyat: <b>her adım</b> bildirimle.', SQ ? { x: 70, y: 250, w: 480, size: 60 } : { y: 180, size: 80 });
        root.append(this.hd);
        this.ph = SQ ? phone('p-bildirimler', { w: 420, x: 590, y: 110 }) : phone('p-bildirimler', { w: 600, x: 240, y: 700 });
        this.toast = el('div', 'toast', `<div class="ic" style="background:#0F9F6E">${ICON.check}</div><div><div class="t1">Siparişiniz onaylandı</div><div class="t2">Yılmaz Taban · Termin 04.12.2026</div></div>`,
          SQ ? { left: '60px', width: '560px', top: '760px', zIndex: 5 } : { left: '80px', width: (W - 160) + 'px', top: '600px', zIndex: 5 });
        root.append(this.ph, this.toast);
      },
      update(t) {
        animHead(this.hd, t, 0);
        show(this.ph, t, .3, 1.1, 140);
        const p = easeOut(seg(t, 1.6, 2.1));
        this.toast.style.opacity = p; this.toast.style.transform = `translateY(${(1 - p) * -60}px) scale(${lerp(.95, 1, p)})`;
      },
    },
    // 5 · Tüm siparişler web'de
    {
      dur: 4.2, bg: 'bordo',
      build(root) {
        this.hd = headline('Siparişler', 'Bekliyor, üretimde, hazır…<br><em>aşama aşama.</em>', null, { y: SQ ? 80 : 240, size: SQ ? 62 : 78 });
        root.append(this.hd);
        const bw = SQ ? 920 : 980, bh = SQ ? 560 : 680;
        this.br = browser('w-siparisler', { w: bw, h: bh, x: (W - bw) / 2, y: SQ ? 400 : 700 });
        root.append(this.br);
      },
      update(t) {
        animHead(this.hd, t, 0);
        show(this.br, t, .4, 1.1, 80);
        this.br.img.style.transformOrigin = '50% 40%';
        this.br.img.style.transform = `scale(${lerp(1, 1.35, easeInOut(seg(t, 1.3, 4)))})`;
      },
    },
    closingScene({ tagline: 'Siparişler kaybolmaz,<br><em>müşteriniz bekletilmez.</em>' }),
  ],
};
