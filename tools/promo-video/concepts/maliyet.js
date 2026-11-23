// Konsept 1 · "Maliyet kuruşu kuruşuna"
// Tema: krem hesap kâğıdı; hammadde satırları tek tek yazılır, toplam sayaç gibi yükselir.
const LINES = [
  { ad: 'TPR dış taban', det: '280 g × 2,10 $/kg', v: 0.588 },
  { ad: 'Termo ara taban', det: '180 g × 1,85 $/kg', v: 0.333 },
  { ad: 'Renk masterbatch', det: '15 g × 3,40 $/kg', v: 0.051 },
  { ad: 'Fire', det: '%7', v: 0.068 },
  { ad: 'İşçilik', det: 'çift başı', v: 0.85 },
  { ad: 'Genel gider', det: 'çift başı', v: 0.12 },
];
const TOTAL = LINES.reduce((s, l) => s + l.v, 0); // 2,010 $
const KUR1 = 38.5, KUR2 = 39.2;

window.CONCEPT = {
  scenes: [
    // 1 · Kanca
    {
      dur: 3.4, bg: 'krem',
      build(root) {
        this.hd = headline('Maliyet', 'Fiyat verirken<br><em>tahmin mi</em><br>ediyorsunuz?', null, { y: SQ ? 150 : 330, size: SQ ? 96 : 118 });
        root.append(this.hd);
        this.guesses = ['≈ 3 ₺?', '3,50?', 'geçen sefer 2,80…'].map((g, i) => {
          const n = el('div', 'h', g, { position: 'absolute', fontStyle: 'italic', color: 'var(--ink-5)', fontSize: (SQ ? 54 : 66) + 'px',
            left: [120, 560, 240][i] + 'px', top: (SQ ? [700, 790, 900] : [1180, 1330, 1500])[i] + 'px', transform: `rotate(${[-6, 4, -3][i]}deg)` });
          const strike = el('div', '', null, { position: 'absolute', left: '-6%', top: '52%', height: '6px', background: 'var(--bordo)', borderRadius: '3px' });
          n.append(strike); n.strike = strike; root.append(n); return n;
        });
      },
      update(t) {
        animHead(this.hd, t, 0);
        this.guesses.forEach((g, i) => {
          g.style.opacity = easeOut(seg(t, .9 + i * .35, 1.3 + i * .35)) * (1 - seg(t, 3, 3.4) * .5);
          g.strike.style.width = easeOut(seg(t, 2.2 + i * .15, 2.6 + i * .15)) * 112 + '%';
        });
      },
    },
    // 2 · Hesap fişi: satırlar yazılır, toplam yükselir
    {
      dur: 6.4, bg: 'krem',
      build(root) {
        this.hd = headline('Bir çift taban', 'Gerçek maliyet,<br><em>kuruşu kuruşuna.</em>', null, { y: SQ ? 80 : 210, size: SQ ? 68 : 84 });
        root.append(this.hd);
        const card = el('div', 'x', null, { left: '90px', width: (W - 180) + 'px', top: (SQ ? 328 : 620) + 'px', background: '#fff', borderRadius: '28px',
          padding: SQ ? '22px 40px' : '44px 52px', color: 'var(--ink)', boxShadow: '0 40px 80px -30px rgba(35,30,25,.35)', border: '1px solid #E7E1D9' });
        this.rows = LINES.map(l => {
          const r = el('div', '', `<div><div style="font:600 ${SQ ? 30 : 36}px/1.2 Geist">${l.ad}</div><div class="mono" style="font-size:${SQ ? 22 : 26}px;color:#776D62;margin-top:6px">${l.det}</div></div><div class="mono" style="font:500 ${SQ ? 32 : 38}px/1 'Geist Mono'">${l.v.toFixed(3).replace('.', ',')} $</div>`,
            { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: (SQ ? 7 : 18) + 'px 0', borderBottom: '2px dashed #E7E1D9' });
          card.append(r); return r;
        });
        const tot = el('div', '', null, { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: (SQ ? 18 : 28) + 'px' });
        tot.append(el('div', '', 'Birim maliyet', { font: `600 ${SQ ? 30 : 36}px/1 Geist`, color: 'var(--bordo)' }));
        this.total = el('div', 'h', '0,000 $', { fontSize: (SQ ? 64 : 96) + 'px', color: 'var(--bordo)' });
        tot.append(this.total); card.append(tot);
        this.tl = el('div', 'mono', '', { textAlign: 'right', fontSize: (SQ ? 26 : 32) + 'px', color: '#776D62', marginTop: '8px' });
        card.append(this.tl);
        root.append(card); this.card = card;
      },
      update(t) {
        animHead(this.hd, t, 0);
        show(this.card, t, .4, 1);
        let sum = 0;
        this.rows.forEach((r, i) => {
          const a = 1 + i * .55; const p = show(r, t, a, a + .4, 20);
          sum += LINES[i].v * easeOut(seg(t, a, a + .5));
          r.style.opacity = Math.max(.0, p);
        });
        this.total.textContent = sum.toFixed(3).replace('.', ',') + ' $';
        const pt = seg(t, 4.6, 5.2);
        this.tl.style.opacity = pt;
        this.tl.textContent = `= ${fmtTL(TOTAL * KUR1)} ₺  ·  1 $ = ${fmtTL(KUR1)} ₺`;
        this.total.style.transform = `scale(${1 + Math.sin(seg(t, 4.3, 4.9) * Math.PI) * .06})`;
        this.total.style.transformOrigin = 'right center';
      },
    },
    // 3 · Gerçek ekran: ürün kartında maliyet özeti
    {
      dur: 4.6, bg: 'bordo',
      build(root) {
        this.hd = headline('Ürün kartı', 'Hammadde, fire, işçilik:<br><em>otomatik hesap.</em>', 'Reçeteyi bir kez girin; <b>her siparişte</b> hazır.', { y: SQ ? 80 : 200, size: SQ ? 62 : 80 });
        root.append(this.hd);
        const bw = SQ ? 900 : 960, bh = SQ ? 520 : 900;
        this.br = browser('w-urun-maliyet', { w: bw, h: bh, x: (W - bw) / 2, y: SQ ? 470 : 760 });
        root.append(this.br);
      },
      update(t) {
        animHead(this.hd, t, 0);
        show(this.br, t, .4, 1.1, 80);
        const ih = this.br.img.getBoundingClientRect().height, vh = SQ ? 520 : 900;
        this.br.img.style.transform = `translateY(${-Math.max(0, ih - vh) * easeInOut(seg(t, 1.4, 4.2)) * .55}px)`;
      },
    },
    // 4 · Kur değişince maliyet güncellenir
    {
      dur: 4.4, bg: 'bordo',
      build(root) {
        this.hd = headline('Döviz', 'Kur değişti mi?<br><em>Maliyet de değişir.</em>', 'Merkez Bankası kuru her gün <b>otomatik</b> gelir.', { y: SQ ? 90 : 260, size: SQ ? 70 : 88 });
        root.append(this.hd);
        const box = el('div', 'x', null, { left: '90px', width: (W - 180) + 'px', top: (SQ ? 560 : 1000) + 'px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' });
        const mk = (lbl) => {
          const c = el('div', '', `<div style="font:600 24px/1 Geist;letter-spacing:.14em;text-transform:uppercase;color:var(--pembe)">${lbl}</div>`, { background: 'rgba(246,237,228,.08)', border: '2px solid rgba(246,237,228,.18)', borderRadius: '30px', padding: '34px 36px' });
          const v = el('div', 'h', '', { fontSize: (SQ ? 64 : 76) + 'px', marginTop: '18px', color: '#fff' }); c.append(v); c.v = v; return c;
        };
        this.kur = mk('1 USD'); this.mal = mk('Birim maliyet');
        box.append(this.kur, this.mal); root.append(box); this.box = box;
      },
      update(t) {
        animHead(this.hd, t, 0);
        show(this.box, t, .5, 1.1);
        const p = easeInOut(seg(t, 1.7, 3.2));
        const k = lerp(KUR1, KUR2, p);
        this.kur.v.textContent = fmtTL(k) + ' ₺';
        this.mal.v.textContent = fmtTL(TOTAL * k) + ' ₺';
        const glow = Math.sin(seg(t, 1.7, 3.4) * Math.PI);
        this.mal.style.borderColor = `rgba(235,200,206,${.18 + glow * .6})`;
      },
    },
    // 5 · Zarar uyarısı
    {
      dur: 3.8, bg: 'bordo',
      build(root) {
        this.hd = headline('Güvence', 'Maliyetin altında fiyat?<br><em>Önce siz görürsünüz.</em>', null, { y: SQ ? 110 : 330, size: SQ ? 70 : 86 });
        root.append(this.hd);
        this.toast = el('div', 'toast', `<div class="ic" style="background:#D97706">${ICON.bell}</div><div><div class="t1">Fiyat maliyetin altında</div><div class="t2">Bot Tabanı Heavy · Fiyat 1,80 $ · Maliyet 2,01 $</div></div>`,
          { left: '80px', width: (W - 160) + 'px', top: (SQ ? 560 : 1040) + 'px' });
        this.fix = el('div', 'pill', 'Önerilen fiyat: 2,10 $', { position: 'absolute', left: '80px', top: (SQ ? 760 : 1260) + 'px', background: 'var(--krem)', color: 'var(--bordo)', fontSize: '30px', padding: '18px 30px' });
        root.append(this.toast, this.fix);
      },
      update(t) {
        animHead(this.hd, t, 0);
        const p = easeOut(seg(t, .7, 1.2));
        this.toast.style.opacity = p; this.toast.style.transform = `translateY(${(1 - p) * -60}px) scale(${lerp(.94, 1, p)})`;
        show(this.fix, t, 1.8, 2.3);
      },
    },
    // 6 · Ürün listesi
    {
      dur: 3.8, bg: 'bordo',
      build(root) {
        this.hd = headline('Ürünler', 'Fiyat, maliyet ve stok<br><em>tek listede.</em>', null, { y: SQ ? 90 : 240, size: SQ ? 68 : 84 });
        root.append(this.hd);
        const bw = SQ ? 920 : 980, bh = SQ ? 560 : 620;
        this.br = browser('w-urunler', { w: bw, h: bh, x: (W - bw) / 2, y: SQ ? 400 : 700 });
        root.append(this.br);
      },
      update(t) {
        animHead(this.hd, t, 0);
        show(this.br, t, .4, 1.1, 80);
        this.br.img.style.transform = `scale(${lerp(1, 1.12, easeInOut(seg(t, 1.2, 3.8)))})`;
        this.br.img.style.transformOrigin = '60% 30%';
      },
    },
    closingScene({ tagline: 'Fiyatınızı<br><em>hesapla verin.</em>' }),
  ],
};
