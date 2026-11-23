// Konsept 5 · "5 adımda ilk satışınız" (nasıl kullanılır)
// Gerçek ekran kaydı (record-flow.mjs → shots/flow-web.webm + flow-web.js) adım adım oynatılır.
// Yatay (16:9) videoda tarayıcının tamamı görünür; story ve karede kamera imleci takip edip yakınlaşır.
const STEPS = [
  { key: 'urun', no: '01', title: 'Ürün ekleyin', sub: 'Ad, kod, fiyat ve stok.', note: [12.5, 'Ürün kartı hazır'] },
  { key: 'musteri', no: '02', title: 'Müşteri ekleyin', sub: 'Unvan, vergi no ve telefon.', note: [11, 'Cari hesap açıldı'] },
  { key: 'satis', no: '03', title: 'Satış girin', sub: 'Ürünü arayın, adedi yazın.', note: [10, '300 çift × 92,50 ₺ = 27.750 ₺ · stok düştü'] },
  { key: 'tahsilat', no: '04', title: 'Tahsilat alın', sub: 'Kasa veya banka seçin, tutarı girin.', note: [8, 'Kalan bakiye: 7.750 ₺'] },
  { key: 'ekstre', no: '05', title: 'Ekstreyi görün', sub: 'Tüm hareketler ve bakiye; PDF veya link ile paylaşın.', note: [4, 'Müşteriye PDF ya da link gönderin'] },
];

// İmleç izinden yumuşak kamera: t anındaki imleç konumu (izler arası doğrusal) ve hafif gecikme
function cursorAt(track, t) {
  if (!track.length) return { x: 720, y: 450 };
  if (t <= track[0].t) return track[0];
  for (let i = 1; i < track.length; i++) {
    if (t <= track[i].t) { const a = track[i - 1], b = track[i]; const p = (t - a.t) / Math.max(.001, b.t - a.t); return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) }; }
  }
  return track[track.length - 1];
}
function camAt(track, t) {
  // Son 0,8 sn'nin ortalaması: titremeden, akıcı takip
  let x = 0, y = 0, n = 0;
  for (let k = 0; k <= 8; k++) { const c = cursorAt(track, t - k * .1); x += c.x; y += c.y; n++; }
  return { x: x / n, y: y / n };
}

function stepStrip(active) {
  const strip = el('div', 'x', null, { display: 'flex', gap: LS ? '10px' : '12px', flexDirection: LS ? 'column' : 'row', flexWrap: 'wrap' });
  STEPS.forEach((s, i) => {
    const on = i === active, done = i < active;
    strip.append(el('div', '', `<span class="mono" style="opacity:.7;margin-right:10px">${s.no}</span>${s.title.replace(/ (ekleyin|girin|alın|görün)$/, '')}`, {
      font: `600 ${LS ? 24 : SQ ? 20 : 24}px/1 Geist`, padding: LS ? '16px 20px' : SQ ? '10px 14px' : '14px 18px', borderRadius: '999px',
      background: on ? 'var(--krem)' : done ? 'rgba(246,237,228,.18)' : 'rgba(246,237,228,.06)', color: on ? 'var(--bordo)' : 'rgba(246,237,228,.8)',
      border: '1.5px solid rgba(246,237,228,.18)',
    }));
  });
  return strip;
}

function introScene() {
  return {
    dur: 3.2, bg: 'bordo',
    build(root) {
      this.hd = headline('Nasıl kullanılır', '5 adımda<br><em>ilk satışınız.</em>', 'Ürün → müşteri → satış → tahsilat → ekstre', LS ? { x: 160, y: 300, w: 1200, size: 120 } : { y: SQ ? 260 : 600, size: SQ ? 100 : 124 });
      root.append(this.hd);
    },
    update(t) { animHead(this.hd, t, 0); },
  };
}

function cardScene(s, i) {
  return {
    dur: 1.7, bg: 'bordo', frame: false,
    build(root) {
      const box = el('div', 'x', null, { left: 0, top: 0, width: W + 'px', height: H + 'px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' });
      this.no = el('div', 'h', s.no, { fontSize: (LS ? 260 : SQ ? 240 : 300) + 'px', color: 'transparent', WebkitTextStroke: '3px var(--pembe)', lineHeight: .9 });
      this.t = el('div', 'h', s.title, { fontSize: (LS ? 100 : SQ ? 84 : 100) + 'px', marginTop: '20px' });
      box.append(this.no, this.t); root.append(box);
    },
    update(t) {
      const p = easeOut(seg(t, 0, .5)); this.no.style.opacity = p; this.no.style.transform = `scale(${lerp(.85, 1, p)})`;
      show(this.t, t, .2, .7, 30);
    },
  };
}

function clipScene(s, i, mark) {
  const len = mark.end - mark.start + .4;
  return {
    dur: len, bg: 'bordo',
    build(root) {
      const data = window.FLOW_DATA;
      this.track = data.track; this.offset = mark.start;
      if (LS) {
        // Sol sütun: adım listesi ve başlık; sağda tam tarayıcı
        const left = el('div', 'x', null, { left: '70px', top: '90px', width: '360px' });
        left.append(el('div', 'eyebrow', 'Adım ' + s.no), el('div', 'h', s.title, { fontSize: '62px', marginTop: '22px' }), el('div', 'sub', s.sub, { fontSize: '27px', marginTop: '16px' }));
        const strip = stepStrip(i); strip.style.position = 'static'; strip.style.marginTop = '46px'; left.append(strip);
        root.append(left);
        const b = el('div', 'browser', null, { left: '480px', top: '70px', width: '1380px' });
        b.append(el('div', 'bar', `<i></i><i></i><i></i><span>solecost.com</span>`));
        const view = el('div', 'view', null, { height: Math.round(1380 * 900 / 1440) + 'px' });
        this.v = videoEl('flow-web.webm'); Object.assign(this.v.style, { width: '100%', display: 'block' });
        view.append(this.v); b.append(view); root.append(b); this.box = b;
        this.noteBox = { left: 520, top: 940, width: 1300 };
      } else {
        this.hd = headline('Adım ' + s.no, s.title, s.sub, SQ ? { x: 60, y: 50, w: 960, size: 56 } : { y: 170, size: 80 });
        if (SQ) { this.hd.parts.s.style.fontSize = '26px'; this.hd.parts.s.style.marginTop = '10px'; this.hd.parts.e.style.display = 'none'; this.hd.parts.h.style.marginTop = 0; }
        root.append(this.hd);
        const cw = SQ ? 1000 : 960, ch = SQ ? 820 : 1150, cy = SQ ? 220 : 520;
        const card = el('div', 'x', null, { left: (W - cw) / 2 + 'px', top: cy + 'px', width: cw + 'px', height: ch + 'px', borderRadius: '34px', overflow: 'hidden', background: '#fff', boxShadow: '0 50px 100px -30px rgba(0,0,0,.6)' });
        this.v = videoEl('flow-web.webm'); Object.assign(this.v.style, { position: 'absolute', left: 0, top: 0, width: '1440px', height: '900px', transformOrigin: '0 0' });
        card.append(this.v); root.append(card); this.box = card; this.cw = cw; this.ch = ch;
        this.zoom = SQ ? 1.25 : 1.5;
        if (!SQ) { const strip = stepStrip(i); Object.assign(strip.style, { left: '60px', right: '60px', top: (cy + ch + 40) + 'px', justifyContent: 'center' }); root.append(strip); }
        this.noteBox = { left: (W - cw) / 2 + 30, top: cy + ch - (SQ ? 110 : 130), width: cw - 60 };
      }
      this.note = el('div', 'toast', `<div class="ic" style="background:#0F9F6E">${ICON.check}</div><div><div class="t1">${s.note[1]}</div></div>`,
        { left: this.noteBox.left + 'px', top: this.noteBox.top + 'px', width: 'auto', maxWidth: this.noteBox.width + 'px', zIndex: 6 });
      root.append(this.note);
    },
    update(t) {
      if (this.hd) animHead(this.hd, t, 0);
      const vt = this.offset + t;
      if (!LS) {
        // Kamera: imlece göre kırp; kenarlardan taşmaz
        const c = camAt(this.track, vt);
        const z = this.zoom, vw = this.cw / z, vh = this.ch / z;
        const x = Math.min(Math.max(c.x - vw / 2, 0), 1440 - vw), y = Math.min(Math.max(c.y - vh / 2, 0), 900 - vh);
        this.v.style.transform = `scale(${z}) translate(${-x}px, ${-y}px)`;
      }
      const p = easeOut(seg(t, s.note[0], s.note[0] + .4)) * (1 - seg(t, s.note[0] + 3, s.note[0] + 3.3));
      this.note.style.opacity = p; this.note.style.transform = `translateY(${(1 - p) * 30}px)`;
      return this.v.setTime(vt);
    },
  };
}

window.CONCEPT = {
  formats: ['landscape', 'story', 'square'],
  async prepare() {
    await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'shots/flow-web.js'; sc.onload = res; sc.onerror = rej; document.head.append(sc); });
    const marks = Object.fromEntries(window.FLOW_DATA.marks.map(m => [m.name, m]));
    this.scenes = [introScene()];
    STEPS.forEach((s, i) => { this.scenes.push(cardScene(s, i), clipScene(s, i, marks[s.key])); });
    this.scenes.push(closingScene({ tagline: 'İlk satışınızı<br><em>bugün girin.</em>' }));
  },
  scenes: [],
};
