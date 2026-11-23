// Konsept 4 · "İşletmeniz cebinizde"
// Tema: tek büyük iPhone; ekranlar hızlı geçişle değişir, üstte kısa etiket.
const STEPS = [
  { src: 'm-ana', eyebrow: 'Ana sayfa', title: 'Kur, bildirim, kısayollar:<br><em>hepsi bir bakışta.</em>' },
  { src: 'm-cari', eyebrow: 'Cari hesap', title: 'Müşteri bakiyesi<br><em>sahada bile elinizde.</em>' },
  { src: 'm-ekstre', eyebrow: 'Ekstre', title: 'Ekstreyi PDF yapın,<br><em>WhatsApp\'tan gönderin.</em>', share: true },
  { src: 'm-tahsilat', eyebrow: 'Tahsilat', title: 'Tahsilatı<br><em>ödeme anında</em> girin.', amount: true },
  { src: 'm-bildirimler', eyebrow: 'Bildirimler', title: 'Yeni sipariş geldi mi?<br><em>Zil haber verir.</em>' },
];

function stepScene(s) {
  return {
    dur: 3.6, bg: 'bordo',
    build(root) {
      this.hd = headline(s.eyebrow, s.title, null, SQ ? { x: 70, y: 300, w: 480, size: 58 } : { y: 170, size: 76 });
      root.append(this.hd);
      this.ph = SQ ? phone(s.src, { w: 430, x: 590, y: 100 }) : phone(s.src, { w: 640, x: 220, y: 560 });
      root.append(this.ph);
      if (s.share) {
        const sheet = el('div', '', `<div style="width:80px;height:8px;border-radius:4px;background:#D4CBC0;margin:0 auto 26px"></div>
          <div style="font:600 30px/1 Geist;color:#231E19;margin-bottom:26px">Ekstre_AyakkabiDunyasi.pdf</div>
          <div style="display:flex;gap:26px">${[['WhatsApp', '#25D366'], ['Mail', '#6B1A2C'], ['Kaydet', '#776D62']].map(([n, c]) => `<div style="text-align:center;font:500 22px/1 Geist;color:#5E554C"><div style="width:96px;height:96px;border-radius:26px;background:${c};margin-bottom:12px"></div>${n}</div>`).join('')}</div>`,
          { position: 'absolute', left: 0, right: 0, bottom: 0, background: '#fff', padding: '26px 40px 60px', borderRadius: '40px 40px 0 0', boxShadow: '0 -20px 40px rgba(0,0,0,.15)' });
        this.ph.querySelector('.screen').append(sheet); this.sheet = sheet;
        if (SQ) { sheet.style.transform = 'scale(.66)'; sheet.style.transformOrigin = 'bottom center'; }
      }
      if (s.amount) {
        const a = el('div', '', '', { position: 'absolute', left: '7.5%', top: '37.6%', font: `500 ${SQ ? 22 : 34}px/1.4 Geist`, color: '#231E19', background: '#fff', padding: '2px 6px' });
        this.ph.querySelector('.screen').append(a); this.amt = a;
      }
    },
    update(t) {
      animHead(this.hd, t, 0);
      const p = easeOut(seg(t, .15, .8));
      this.ph.style.opacity = p; this.ph.style.transform = `translateY(${(1 - p) * 90}px) rotate(${(1 - p) * 3}deg)`;
      if (this.sheet) { const q = easeOut(seg(t, 1.5, 2)); this.sheet.style.translate = `0 ${(1 - q) * 110}%`; }
      if (this.amt) { const full = '12.000,00 ₺'; const n = Math.floor(seg(t, 1.3, 2.6) * full.length); this.amt.textContent = full.slice(0, n); this.amt.style.opacity = n ? 1 : 0; }
      this.ph.img.style.transform = `translateY(${-easeInOut(seg(t, 1.8, 3.6)) * (s.src === 'm-ekstre' ? 160 : 60)}px)`;
    },
  };
}

window.CONCEPT = {
  scenes: [
    // 1 · Kanca
    {
      dur: 3.4, bg: 'krem',
      build(root) {
        this.hd = headline('SoleCost mobil', 'Bilgisayar başında<br>değilken de,<br><em>işletmeniz yanınızda.</em>', null, { y: SQ ? 170 : 420, size: SQ ? 86 : 104 });
        root.append(this.hd);
        this.chips = ['iOS', 'Android', 'Web ile aynı veriler'].map((c, i) => {
          const d = el('div', 'pill', c, { position: 'absolute', left: (80 + [0, 130, 330][i]) + 'px', top: (SQ ? 760 : 1280) + 'px', background: 'var(--bordo)', color: '#fff', fontSize: '28px', padding: '16px 26px' });
          root.append(d); return d;
        });
      },
      update(t) {
        animHead(this.hd, t, 0);
        this.chips.forEach((c, i) => show(c, t, 1.2 + i * .2, 1.6 + i * .2, 20));
      },
    },
    ...STEPS.map(stepScene),
    closingScene({ tagline: 'İşletmeniz<br><em>cebinizde.</em>' }),
  ],
};
