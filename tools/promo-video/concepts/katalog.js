// Konsept 6 · "Kataloğunuz WhatsApp'ta"
// Akış: ürünü fotoğrafıyla ekle → Katalog ekranında seç → PDF hazırla → WhatsApp'tan müşteriye gönder → sipariş cevabı.
// Ekranlar: capture-katalog.ts (k-*.png). WhatsApp sohbeti HTML ile çizilir.

const CUSTOMER = 'Ayakkabı Dünyası A.Ş.';
const PDF_NAME = 'Yaz 2027 Taban Kataloğu.pdf';

// Sohbet balonu (gönderilen sağda, gelen solda)
function bubble(html, out, s) {
  return el('div', '', html, {
    alignSelf: out ? 'flex-end' : 'flex-start', maxWidth: '82%', background: out ? '#D9FDD3' : '#fff', color: '#111B21',
    borderRadius: out ? `${18 * s}px ${4 * s}px ${18 * s}px ${18 * s}px` : `${4 * s}px ${18 * s}px ${18 * s}px ${18 * s}px`,
    padding: `${10 * s}px ${14 * s}px`, font: `400 ${17 * s}px/1.35 Geist`, boxShadow: '0 1px 1px rgba(0,0,0,.08)',
  });
}
const time = (txt, s, ticks) => `<div style="text-align:right;font:400 ${12 * s}px/1 Geist;color:#667781;margin-top:${4 * s}px">${txt}${ticks ? ` <span style="color:#53BDEB">✓✓</span>` : ''}</div>`;

// Telefon içinde WhatsApp benzeri sohbet ekranı (ekran görüntüsünün üstüne çizilir)
function chatScreen(ph, w) {
  const s = w / 390; // 390 pt genişliğe göre ölçek
  const scr = ph.querySelector('.screen');
  ph.img.style.display = 'none';
  const wrap = el('div', '', null, { position: 'absolute', left: 0, right: 0, top: w * .118 + 'px', bottom: 0, background: '#EFE7DE', display: 'flex', flexDirection: 'column' });
  const head = el('div', '', `<div style="font-size:${26 * s}px;line-height:1">‹</div>
    <div style="width:${40 * s}px;height:${40 * s}px;border-radius:50%;background:#C66E7E;color:#fff;display:grid;place-items:center;font:600 ${16 * s}px/1 Geist">AD</div>
    <div><div style="font:600 ${18 * s}px/1.2 Geist">${CUSTOMER}</div><div style="font:400 ${13 * s}px/1.2 Geist;opacity:.8">çevrimiçi</div></div>`,
    { display: 'flex', alignItems: 'center', gap: 10 * s + 'px', padding: `${10 * s}px ${14 * s}px`, background: '#F6F5F3', color: '#111B21', borderBottom: '1px solid #E2DED8' });
  const body = el('div', '', null, { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8 * s + 'px', padding: `${14 * s}px ${12 * s}px` });
  const input = el('div', '', `<div style="flex:1;background:#fff;border-radius:${22 * s}px;padding:${11 * s}px ${16 * s}px;color:#8696A0;font:400 ${16 * s}px/1 Geist">Mesaj</div>
    <div style="width:${44 * s}px;height:${44 * s}px;border-radius:50%;background:#25D366"></div>`,
    { display: 'flex', gap: 8 * s + 'px', alignItems: 'center', padding: `${8 * s}px ${10 * s}px ${30 * s}px` });
  wrap.append(head, body, input); scr.append(wrap);

  // PDF belge balonu: katalogun ilk sayfasından önizleme
  const doc = bubble(`<div style="border-radius:${10 * s}px;overflow:hidden;background:#fff;border:1px solid #E5E0DA">
      <div style="height:${150 * s}px;overflow:hidden"><img src="${SHOTS}k-pdf.png" style="position:static;width:100%;display:block"></div>
      <div style="display:flex;gap:${10 * s}px;align-items:center;padding:${10 * s}px;background:#F5F6F6">
        <div style="width:${30 * s}px;height:${36 * s}px;border-radius:${4 * s}px;background:#E5484D;color:#fff;display:grid;place-items:center;font:700 ${9 * s}px/1 Geist">PDF</div>
        <div><div style="font:600 ${15 * s}px/1.2 Geist">${PDF_NAME}</div><div style="font:400 ${12 * s}px/1.3 Geist;color:#667781">1 sayfa · PDF · 1,2 MB</div></div>
      </div></div>` + time('10:24', s, true), true, s);
  doc.style.width = '76%'; doc.style.padding = `${5 * s}px`;
  const msg = bubble(`Merhaba, yeni sezon kataloğumuz ekte. Fiyatlar çift başınadır 👋${time('10:24', s, true)}`, true, s);
  const typing = bubble(`<span style="letter-spacing:${3 * s}px;color:#667781">● ● ●</span>`, false, s);
  const reply = bubble(`Elinize sağlık 👍 TBN-011 espadrilden <b>1.200 çift</b> alalım, termin ne olur?${time('10:31', s)}`, false, s);
  [doc, msg, typing, reply].forEach(b => { b.style.opacity = 0; body.append(b); });
  return { doc, msg, typing, reply };
}

// Paylaşım menüsü (telefon altından açılır)
function shareSheet(ph, w) {
  const s = w / 390;
  const apps = [['WhatsApp', '#25D366'], ['Mail', '#6B1A2C'], ['Mesajlar', '#34C759'], ['Dosyalara kaydet', '#776D62']];
  const sheet = el('div', '', `<div style="width:${36 * s}px;height:${5 * s}px;border-radius:3px;background:#D4CBC0;margin:0 auto ${14 * s}px"></div>
    <div style="display:flex;gap:${12 * s}px;align-items:center;margin-bottom:${16 * s}px">
      <div style="width:${40 * s}px;height:${48 * s}px;border-radius:${6 * s}px;background:#E5484D;color:#fff;display:grid;place-items:center;font:700 ${11 * s}px/1 Geist">PDF</div>
      <div><div style="font:600 ${15 * s}px/1.2 Geist;color:#231E19">${PDF_NAME}</div><div style="font:400 ${12 * s}px/1.3 Geist;color:#776D62">PDF belgesi · 1,2 MB</div></div></div>
    <div style="display:flex;gap:${14 * s}px">${apps.map(([n, c], i) => `<div class="app${i}" style="width:${70 * s}px;text-align:center;font:500 ${11 * s}px/1.2 Geist;color:#5E554C"><div style="width:${58 * s}px;height:${58 * s}px;border-radius:${15 * s}px;background:${c};margin:0 auto ${6 * s}px"></div>${n}</div>`).join('')}</div>`,
    { position: 'absolute', left: 0, right: 0, bottom: 0, background: '#fff', padding: `${12 * s}px ${18 * s}px ${36 * s}px`, borderRadius: `${22 * s}px ${22 * s}px 0 0`, boxShadow: '0 -10px 30px rgba(0,0,0,.18)', zIndex: 4 });
  const dim = el('div', '', null, { position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 3 });
  ph.querySelector('.screen').append(dim, sheet);
  return { sheet, dim, wa: sheet.querySelector('.app0 > div') };
}

// Telefon + başlık yerleşimi (story: başlık üstte, telefon altta; kare: başlık solda, telefon sağda)
const layout = {
  head: (size = 76) => (SQ ? { x: 70, y: 250, w: 480, size: 58 } : { y: 170, size }),
  phone: () => (SQ ? { w: 430, x: 590, y: 100 } : { w: 640, x: 220, y: 600 }),
};
function enter(ph, t, a = .15) {
  const p = easeOut(seg(t, a, a + .65));
  ph.style.opacity = p; ph.style.transform = `translateY(${(1 - p) * 90}px) rotate(${(1 - p) * 3}deg)`;
}
// Dokunma halkası
function tap(root) {
  const d = el('div', '', null, { position: 'absolute', width: '70px', height: '70px', marginLeft: '-35px', marginTop: '-35px', borderRadius: '50%', border: '5px solid rgba(255,255,255,.9)', background: 'rgba(107,26,44,.35)', opacity: 0, zIndex: 6 });
  root.append(d);
  d.at = (t, a, x, y) => { const p = seg(t, a, a + .45); d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.opacity = p > 0 && p < 1 ? 1 - p : 0; d.style.transform = `scale(${.6 + p * .8})`; };
  return d;
}

window.CONCEPT = {
  scenes: [
    // 1 · Kanca: tek tek atılan fotoğraflar, gelen sorular
    {
      dur: 3.6, bg: 'krem',
      build(root) {
        this.hd = headline('Katalog', 'Ürünleri hâlâ<br><em>fotoğraf fotoğraf</em><br>mı atıyorsunuz?', null, { y: SQ ? 110 : 300, size: SQ ? 84 : 100 });
        root.append(this.hd);
        const qs = [['📷 Fotoğraf', true], ['📷 Fotoğraf', true], ['Fiyatı ne bunun?', false], ['📷 Fotoğraf', true], ['Bu hangi kodlu?', false], ['Toptan fiyat?', false]];
        this.qs = qs.map(([txt, out], i) => {
          const b = el('div', '', txt, {
            position: 'absolute', font: `500 ${SQ ? 30 : 36}px/1 Geist`, padding: SQ ? '20px 28px' : '24px 34px', borderRadius: '28px',
            background: out ? '#D9FDD3' : '#fff', color: '#111B21', boxShadow: '0 16px 34px -14px rgba(60,30,20,.35)',
            left: (out ? (SQ ? 560 : 520) : 90) + (i % 2) * 40 + 'px', top: (SQ ? 560 : 1040) + i * (SQ ? 78 : 112) + 'px',
          });
          root.append(b); return b;
        });
      },
      update(t) {
        animHead(this.hd, t, 0);
        this.qs.forEach((b, i) => { const p = show(b, t, 1 + i * .25, 1.35 + i * .25, 24); b.style.transform += ` rotate(${[-2, 1.5, -1, 2, -1.5, 1][i]}deg)`; b.style.opacity = p * (1 - seg(t, 3.2, 3.6)); });
      },
    },
    // 2 · Ürünü fotoğrafıyla ekle
    {
      dur: 5, bg: 'bordo',
      build(root) {
        this.hd = headline('1 · Ürün ekle', 'Ürünü <em>fotoğrafıyla</em><br>bir kez ekleyin.', 'Ad, kod, fiyat ve fotoğraf. Hepsi telefondan.', layout.head());
        root.append(this.hd);
        const L = layout.phone();
        this.ph = phone('k-urun-bos', L); root.append(this.ph);
        this.tap = tap(root);
        // Fotoğraf alanının ekrandaki yeri (390x844 ekran görüntüsünde ~ (70, 115))
        const s = (L.w - L.w * 16 / 520 * 2) / 390, pad = L.w * 16 / 520;
        this.tapXY = [L.x + pad + 70 * s, L.y + pad + L.w * .118 + 130 * s];
        this.libXY = [L.x + pad + 110 * s, L.y + pad + L.w * .118 + 745 * s];
      },
      update(t) {
        animHead(this.hd, t, 0); enter(this.ph, t);
        this.ph.swap(t < 1.6 ? 'k-urun-bos' : t < 2.6 ? 'k-urun-sheet' : 'k-urun-dolu');
        this.tap.at(t, 1.2, ...this.tapXY);
        if (t > 2 && t < 2.6) this.tap.at(t, 2.1, ...this.libXY);
      },
    },
    // 3 · Fotoğraflı ürün listesi
    {
      dur: 3.4, bg: 'bordo',
      build(root) {
        this.hd = headline('Ürünler', 'Tüm ürünleriniz<br><em>fotoğraflı</em> ve düzenli.', null, layout.head());
        root.append(this.hd);
        this.ph = phone('k-urunler', layout.phone()); root.append(this.ph);
      },
      update(t) { animHead(this.hd, t, 0); enter(this.ph, t); },
    },
    // 4 · Katalog: seç
    {
      dur: 5, bg: 'bordo',
      build(root) {
        this.hd = headline('2 · Katalog', 'Göndereceğiniz ürünleri<br><em>işaretleyin.</em>', 'Başlık, müşteri adı; fiyatlı ya da fiyatsız.', layout.head(70));
        root.append(this.hd);
        this.ph = phone('k-katalog', layout.phone()); root.append(this.ph);
      },
      update(t) {
        animHead(this.hd, t, 0); enter(this.ph, t);
        this.ph.swap(t < 2.3 ? 'k-katalog' : 'k-katalog-secili');
        this.ph.img.style.transform = `translateY(${-easeInOut(seg(t, .9, 2)) * 40}px)`;
        if (t >= 2.3) this.ph.img.style.transform = 'none';
      },
    },
    // 5 · PDF hazır
    {
      dur: 4.4, bg: 'krem',
      build(root) {
        this.hd = headline('3 · PDF', 'Tek dokunuşla<br><em>şık bir katalog.</em>', 'Logonuz, fotoğraflar, kodlar ve fiyatlar.', SQ ? { x: 70, y: 300, w: 420, size: 60 } : { y: 150, size: 84 });
        root.append(this.hd);
        const w = SQ ? 500 : 820;
        this.pdf = el('div', '', `<img src="${SHOTS}k-pdf.png" style="width:100%;display:block">`, {
          position: 'absolute', width: w + 'px', left: (SQ ? 520 : (W - w) / 2) + 'px', top: (SQ ? 90 : 720) + 'px',
          background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 50px 90px -30px rgba(60,30,20,.5), 0 0 0 1px rgba(0,0,0,.05)',
        });
        root.append(this.pdf);
      },
      update(t) {
        animHead(this.hd, t, 0);
        const p = easeOut(seg(t, .3, 1.1));
        this.pdf.style.opacity = p;
        this.pdf.style.transform = `translateY(${(1 - p) * 200}px) rotate(${lerp(4, -1.5, p)}deg) scale(${1 + seg(t, 1.1, 4.4) * .04})`;
      },
    },
    // 6 · WhatsApp'tan gönder ve sipariş al
    {
      dur: 7.2, bg: 'bordo',
      build(root) {
        this.hd = headline('4 · Paylaş', 'WhatsApp\'tan<br><em>saniyeler içinde.</em>', null, layout.head(80));
        root.append(this.hd);
        const L = layout.phone();
        this.share = phone('k-katalog-secili', L);
        this.chat = phone('k-katalog-secili', L);
        this.sh = shareSheet(this.share, L.w);
        this.c = chatScreen(this.chat, L.w);
        root.append(this.share, this.chat);
        this.order = el('div', 'toast', `<div class="ic">${ICON.check}</div><div><div class="t1">Sipariş geldi</div><div class="t2">TBN-011 · 1.200 çift</div></div>`,
          SQ ? { left: '70px', width: '470px', top: '700px' } : { left: '120px', width: (W - 240) + 'px', top: '470px', zIndex: 5 });
        root.append(this.order);
      },
      update(t) {
        animHead(this.hd, t, 0);
        enter(this.share, t, 0);
        const sp = easeOut(seg(t, .5, 1));
        this.sh.sheet.style.translate = `0 ${(1 - sp) * 110}%`; this.sh.dim.style.opacity = sp;
        const press = seg(t, 1.5, 1.8);
        this.sh.wa.style.transform = `scale(${1 - Math.sin(press * Math.PI) * .12})`;
        // Sohbete geçiş
        const cp = easeOut(seg(t, 1.9, 2.3));
        this.share.style.opacity = t < 1.9 ? this.share.style.opacity : 1 - cp;
        this.chat.style.opacity = cp; this.chat.style.transform = `translateX(${(1 - cp) * 60}px)`;
        const { doc, msg, typing, reply } = this.c;
        show(doc, t, 2.5, 2.9, 30); show(msg, t, 3.1, 3.5, 30);
        typing.style.display = t < 5 ? '' : 'none'; typing.style.opacity = seg(t, 3.9, 4.1) * (t < 5 ? 1 : 0);
        reply.style.display = t >= 5 ? '' : 'none'; show(reply, t, 5, 5.4, 30);
        show(this.order, t, 5.8, 6.3, 30);
      },
    },
    closingScene({ tagline: 'Kataloğunuz<br><em>müşterinizin cebinde.</em>' }),
  ],
};
