// Konsept 2 · "Çek vadesi kaçmasın"
// Tema: defterden zaman çizelgesine; vadeler sırayla belirir, toplu işlem tek dokunuşla.
const CEKLER = [
  { kim: 'Ayakkabı Dünyası A.Ş.', banka: 'Ziraat', tutar: 5000, gun: -3 },
  { kim: 'Moda Adım Ltd.', banka: 'Garanti', tutar: 3500, gun: 2 },
  { kim: 'Yıldız Spor', banka: 'İş Bankası', tutar: 8000, gun: 5 },
  { kim: 'Comfort Walk', banka: 'Yapı Kredi', tutar: 6500, gun: 9 },
  { kim: 'Ayakkabı Dünyası A.Ş.', banka: 'Akbank', tutar: 12000, gun: 16 },
];
const durumu = g => g < 0 ? { t: `${-g} gün geçti`, c: '#C0362C' } : g <= 7 ? { t: `${g} gün kaldı`, c: '#D97706' } : { t: `${g} gün kaldı`, c: '#0F9F6E' };

window.CONCEPT = {
  scenes: [
    // 1 · Kanca: karalanmış defter
    {
      dur: 3.6, bg: 'krem',
      build(root) {
        this.hd = headline('Çek takibi', 'Bu hafta hangi çekin<br><em>vadesi geliyor?</em>', null, { y: SQ ? 130 : 300, size: SQ ? 88 : 108 });
        root.append(this.hd);
        const notes = ['Ziraat 5.000 → 20 Kas?', 'Garanti 3.500 — kime verdik?', 'İş Bnk. 8.000 ??'];
        this.notes = notes.map((n, i) => {
          const d = el('div', 'h', n, { position: 'absolute', left: (120 + i * 30) + 'px', top: ((SQ ? 640 : 1120) + i * (SQ ? 110 : 150)) + 'px', fontStyle: 'italic', fontSize: (SQ ? 50 : 60) + 'px', color: '#5E554C', transform: `rotate(${[-3, 2, -2][i]}deg)` });
          root.append(d); return d;
        });
      },
      update(t) {
        animHead(this.hd, t, 0);
        this.notes.forEach((n, i) => { n.style.opacity = easeOut(seg(t, 1 + i * .35, 1.4 + i * .35)) * (1 - seg(t, 3.1, 3.6)); });
      },
    },
    // 2 · Zaman çizelgesi
    {
      dur: 5.6, bg: 'bordo',
      build(root) {
        this.hd = headline('Vade takvimi', 'Her çek, <em>vadesiyle</em><br>gözünüzün önünde.', null, { y: SQ ? 70 : 200, size: SQ ? 64 : 82 });
        root.append(this.hd);
        const top = SQ ? 330 : 600, step = SQ ? 138 : 210;
        this.line = el('div', 'x', null, { left: '150px', top: top + 'px', width: '4px', height: (step * (CEKLER.length - 1) + 40) + 'px', background: 'rgba(246,237,228,.18)', borderRadius: '2px' });
        root.append(this.line);
        this.rows = CEKLER.map((c, i) => {
          const d = durumu(c.gun);
          const r = el('div', 'x', null, { left: '130px', top: (top + i * step) + 'px', width: (W - 220) + 'px', display: 'flex', alignItems: 'center', gap: '40px' });
          r.append(el('div', '', null, { width: '44px', height: '44px', borderRadius: '50%', background: d.c, boxShadow: `0 0 0 10px ${d.c}33`, flex: 'none' }));
          const card = el('div', '', `<div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font:600 ${SQ ? 30 : 36}px/1.2 Geist">${c.kim}</div><div class="h" style="font-size:${SQ ? 44 : 54}px">${fmtTL(c.tutar, 0)} ₺</div></div>
            <div style="display:flex;justify-content:space-between;margin-top:10px;font:500 ${SQ ? 24 : 28}px/1 Geist"><span style="color:rgba(246,237,228,.65)">${c.banka}</span><span style="color:${d.c};background:#fff;padding:8px 16px;border-radius:999px">${d.t}</span></div>`,
            { flex: 1, background: 'rgba(246,237,228,.07)', border: '2px solid rgba(246,237,228,.14)', borderRadius: '26px', padding: SQ ? '20px 28px' : '28px 34px' });
          r.append(card); root.append(r); return r;
        });
      },
      update(t) {
        animHead(this.hd, t, 0);
        this.line.style.transformOrigin = 'top'; this.line.style.transform = `scaleY(${easeOut(seg(t, .5, 2.8))})`;
        this.rows.forEach((r, i) => {
          const p = easeOut(seg(t, .8 + i * .45, 1.3 + i * .45));
          r.style.opacity = p; r.style.transform = `translateX(${(1 - p) * 60}px)`;
        });
      },
    },
    // 3 · Çek portföyü ekranı
    {
      dur: 4.4, bg: 'bordo',
      build(root) {
        this.hd = headline('Çek portföyü', 'Portföy, banka, tedarikçi:<br><em>hepsi tek ekranda.</em>', 'Vadesi geçen <b>kırmızı</b>, yaklaşan <b>turuncu</b>.', { y: SQ ? 70 : 200, size: SQ ? 62 : 78 });
        root.append(this.hd);
        const bw = SQ ? 920 : 980, bh = SQ ? 520 : 760;
        this.br = browser('w-cekler', { w: bw, h: bh, x: (W - bw) / 2, y: SQ ? 450 : 760 });
        root.append(this.br);
      },
      update(t) {
        animHead(this.hd, t, 0);
        show(this.br, t, .4, 1.1, 80);
        this.br.img.style.transformOrigin = '55% 45%';
        this.br.img.style.transform = `scale(${lerp(1, 1.45, easeInOut(seg(t, 1.4, 4.2)))})`;
      },
    },
    // 4 · Toplu işlem
    {
      dur: 5, bg: 'bordo',
      build(root) {
        this.hd = headline('Toplu işlem', 'Seç, <em>bankaya ver.</em><br>Tek dokunuş.', null, { y: SQ ? 80 : 220, size: SQ ? 68 : 86 });
        root.append(this.hd);
        const list = el('div', 'x', null, { left: '90px', width: (W - 180) + 'px', top: (SQ ? 360 : 640) + 'px', background: '#fff', color: 'var(--ink)', borderRadius: '28px', overflow: 'hidden', boxShadow: '0 40px 80px -30px rgba(0,0,0,.5)' });
        this.checks = CEKLER.slice(1, 5).map(c => {
          const r = el('div', '', null, { display: 'flex', alignItems: 'center', gap: '24px', padding: SQ ? '20px 30px' : '28px 34px', borderBottom: '1px solid #E7E1D9' });
          const box = el('div', '', null, { width: '42px', height: '42px', borderRadius: '12px', border: '3px solid #D4CBC0', display: 'grid', placeItems: 'center', flex: 'none' });
          r.append(box, el('div', '', `<div style="font:600 ${SQ ? 28 : 32}px/1.2 Geist">${c.kim}</div><div style="font:400 ${SQ ? 22 : 26}px/1.3 Geist;color:#776D62">${c.banka} · ${durumu(c.gun).t}</div>`, { flex: 1 }),
            el('div', 'mono', fmtTL(c.tutar, 0) + ' ₺', { fontSize: (SQ ? 30 : 34) + 'px', fontWeight: 500 }));
          list.append(r); r.box = box; return r;
        });
        this.btn = el('div', '', 'Bankaya ver · 3 çek', { margin: SQ ? '20px 30px' : '28px 34px', textAlign: 'center', background: 'var(--bordo)', color: '#fff', font: `600 ${SQ ? 30 : 34}px/1 Geist`, padding: SQ ? '24px' : '30px', borderRadius: '20px' });
        list.append(this.btn); root.append(list); this.list = list;
        this.toast = el('div', 'toast', `<div class="ic" style="background:#0F9F6E">${ICON.check}</div><div><div class="t1">3 çek bankaya verildi</div><div class="t2">Toplam 17.000 ₺ · Akbank hesabı</div></div>`, { left: '90px', width: (W - 180) + 'px', top: (SQ ? 900 : 1480) + 'px' });
        root.append(this.toast);
      },
      update(t) {
        animHead(this.hd, t, 0);
        show(this.list, t, .4, 1);
        this.checks.forEach((r, i) => {
          const on = i < 3 && t > 1.3 + i * .4;
          r.box.style.background = on ? 'var(--bordo)' : '#fff'; r.box.style.borderColor = on ? 'var(--bordo)' : '#D4CBC0';
          r.box.innerHTML = on ? ICON.check.replace('34', '24').replace('34', '24') : '';
          r.style.background = on ? '#FBF4F5' : '#fff';
        });
        const press = Math.sin(seg(t, 2.8, 3.1) * Math.PI);
        this.btn.style.transform = `scale(${1 - press * .05})`;
        const p = easeOut(seg(t, 3.2, 3.7));
        this.toast.style.opacity = p; this.toast.style.transform = `translateY(${(1 - p) * 60}px)`;
      },
    },
    // 5 · Mobil
    {
      dur: 4.2, bg: 'bordo',
      build(root) {
        this.hd = headline('Mobil', 'Bankadayken de<br><em>cebinizde.</em>', null, SQ ? { x: 70, y: 300, w: 500, size: 60 } : { y: 200, size: 86 });
        root.append(this.hd);
        this.ph = SQ ? phone('m-cekler', { w: 420, x: 580, y: 120 }) : phone('m-cekler', { w: 600, x: 240, y: 560 });
        root.append(this.ph);
      },
      update(t) {
        animHead(this.hd, t, 0);
        const p = easeOut(seg(t, .3, 1.1));
        this.ph.style.opacity = p; this.ph.style.transform = `translateY(${(1 - p) * 140}px)`;
        this.ph.img.style.transform = `translateY(${-easeInOut(seg(t, 1.6, 4)) * (SQ ? 120 : 200)}px)`;
      },
    },
    // 6 · Ana sayfa uyarısı
    {
      dur: 3.8, bg: 'bordo',
      build(root) {
        this.hd = headline('Ana sayfa', 'Vadesi yaklaşanlar<br><em>her sabah ilk ekranda.</em>', null, { y: SQ ? 80 : 240, size: SQ ? 64 : 80 });
        root.append(this.hd);
        const bw = SQ ? 920 : 980, bh = SQ ? 560 : 700;
        this.br = browser('w-dashboard', { w: bw, h: bh, x: (W - bw) / 2, y: SQ ? 400 : 700 });
        root.append(this.br);
      },
      update(t) {
        animHead(this.hd, t, 0);
        show(this.br, t, .4, 1.1, 80);
        this.br.img.style.transformOrigin = '85% 48%';
        this.br.img.style.transform = `scale(${lerp(1, 1.9, easeInOut(seg(t, 1.2, 3.4)))})`;
      },
    },
    closingScene({ tagline: 'Çekleriniz<br><em>vadesinde, kayıtta.</em>' }),
  ],
};
