'use client';

// Ayarlar → Yazdırma Ayarları: sevk fişinin kâğıt ölçüsü (A4 / A5 / sürekli form / özel), kenar boşlukları, yazı,
// matbu form alan konumları, fiyat gösterimi, kopya sayısı; canlı önizleme ve kalibrasyon sayfası.
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import BackLink from '@/app/components/back-link';
import { CheckCircle, Loader2, Printer, Save } from '@/app/components/icons';
import { printHtml } from '@/app/components/print-html';
import {
  DEFAULT_FIELDS, FIELD_LABELS, PAPERS, calibrationHtml, dispatchPrintHtml, normalizePrintConfig,
  type FieldKey, type PrintConfig, type DispatchPrintInput,
} from '@/lib/dispatch-print-html';

const SAMPLE: DispatchPrintInput = {
  company: { name: 'Firma Adınız', address: 'Adres satırı', phone: '0212 000 00 00', taxId: '1234567890' },
  customer: { name: 'Örnek Müşteri Ltd.', address: 'Müşteri adresi, İstanbul', taxId: '9876543210' },
  no: 'SVK-2026-0001', date: new Date(), carrier: 'Kendi aracımız', vehiclePlate: '34 ABC 123', driverName: 'Ali Veli', notes: 'Örnek not',
  currency: 'TRY', vatRate: 20,
  lines: [
    { code: 'TBN-001', name: 'Campus Taban Siyah', unit: 'çift', qty: 120, unitPrice: 95 },
    { code: 'TBN-004', name: 'Bot Tabanı Heavy', unit: 'çift', qty: 60, unitPrice: 140 },
    { code: 'HM-EVA', name: 'EVA Granül', unit: 'kg', qty: 250.5, unitPrice: 42.5 },
  ],
};

type Settings = PrintConfig & { postByDefault: boolean; fieldPositions: Record<FieldKey, { x: number; y: number }> };

export default function PrintSettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { fetch('/api/print-settings').then(r => r.json()).then(setS).catch(() => {}); }, []);
  const set = (patch: Partial<Settings>) => setS(x => (x ? { ...x, ...patch } : x));
  const preview = useMemo(() => (s ? dispatchPrintHtml(SAMPLE, s) : ''), [s]);
  const cfg = s ? normalizePrintConfig(s) : null;

  const save = async () => {
    if (!s) return;
    setBusy(true); setMsg('');
    const r = await fetch('/api/print-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? 'Kaydedildi' : j.error || 'Kaydedilemedi');
  };

  if (!s || !cfg) return <AppShell><div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand-700" /></div></AppShell>;
  const input = 'w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none';
  const numField = (label: string, key: keyof Settings, step = '1', id = String(key)) => (
    <div><label className="block text-xs font-medium text-ink-500 mb-1" htmlFor={`ps-${id}`}>{label}</label>
      <input id={`ps-${id}`} type="number" step={step} value={String(s[key] ?? '')} onChange={e => set({ [key]: Number(e.target.value) } as any)} className={input} /></div>
  );
  // Önizleme: kâğıt mm → ekranda ölçekli
  const scale = Math.min(1, 400 / (cfg.widthMm * 3.78)); // önizleme sütununa sığar

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="space-y-1"><BackLink href="/settings" label="Ayarlar" /><h1 className="page-title flex items-center gap-2"><Printer className="w-6 h-6 text-brand-700" /> Yazdırma Ayarları</h1>
          <p className="text-sm text-ink-500">Sevk fişi ve irsaliyenin kâğıt ölçüsü. Nokta vuruşlu yazıcı (sürekli form) ve normal yazıcı (A4/A5) için.</p></div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <section className="bg-white rounded-xl border border-ink-200/80 shadow-card p-4 space-y-3">
              <h2 className="font-semibold text-ink-700">Kâğıt</h2>
              <select value={s.paper} onChange={e => { const p = e.target.value as any; const pr = (PAPERS as any)[p]; set({ paper: p, ...(pr ? { widthMm: pr.w, heightMm: pr.h } : {}) }); }} className={`${input} bg-white`} data-testid="ps-paper" aria-label="Kâğıt">
                {Object.entries(PAPERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                <option value="CUSTOM">Özel ölçü</option>
              </select>
              {s.paper === 'CUSTOM' && <div className="grid grid-cols-2 gap-3">{numField('Genişlik (mm)', 'widthMm')}{numField('Yükseklik (mm)', 'heightMm')}</div>}
              <div className="grid grid-cols-4 gap-3">{numField('Üst (mm)', 'marginTopMm')}{numField('Sağ (mm)', 'marginRightMm')}{numField('Alt (mm)', 'marginBottomMm')}{numField('Sol (mm)', 'marginLeftMm')}</div>
              <div className="grid grid-cols-3 gap-3">{numField('Yazı boyu (pt)', 'fontSizePt', '0.5')}{numField('Satır yüksekliği (mm)', 'lineHeightMm', '0.5')}{numField('Sayfa başına kalem', 'maxLines')}</div>
            </section>

            <section className="bg-white rounded-xl border border-ink-200/80 shadow-card p-4 space-y-3">
              <h2 className="font-semibold text-ink-700">Biçim</h2>
              <div className="flex gap-2">
                {([['full', 'Tam fiş (boş kâğıt)'], ['preprinted', 'Matbu form (üstü basılı)']] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => set({ mode: k })} data-testid={`ps-mode-${k}`}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border ${s.mode === k ? 'bg-brand-700 text-white border-brand-700' : 'bg-white border-ink-200 text-ink-700'}`}>{l}</button>
                ))}
              </div>
              {s.mode === 'preprinted' && (
                <div className="space-y-2">
                  <p className="text-xs text-ink-500">Her alanın sol üst köşesinin kâğıdın sol üst köşesine uzaklığı (mm). Sütunlarda yalnız x kullanılır; miktar, fiyat ve tutar bu noktada sağa yaslı biter.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    {(Object.keys(FIELD_LABELS) as FieldKey[]).map(k => (
                      <div key={k} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 text-ink-600 text-xs">{FIELD_LABELS[k]}</span>
                        {(['x', 'y'] as const).map(ax => (
                          <input key={ax} type="number" step="0.5" aria-label={`${FIELD_LABELS[k]} ${ax}`} value={s.fieldPositions?.[k]?.[ax] ?? DEFAULT_FIELDS[k][ax]}
                            onChange={e => set({ fieldPositions: { ...s.fieldPositions, [k]: { ...(s.fieldPositions?.[k] ?? DEFAULT_FIELDS[k]), [ax]: Number(e.target.value) } } })}
                            className="w-16 px-2 py-1 border border-ink-200 rounded text-right" />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white rounded-xl border border-ink-200/80 shadow-card p-4 space-y-3 text-sm">
              <h2 className="font-semibold text-ink-700">Seçenekler</h2>
              <label className="flex items-center gap-2"><input type="checkbox" checked={s.showPrices} onChange={e => set({ showPrices: e.target.checked })} data-testid="ps-prices" /> Fişte birim fiyat, tutar ve toplam göster</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={s.postByDefault} onChange={e => set({ postByDefault: e.target.checked })} /> Sevk fişinde &quot;Cari hesaba işle&quot; varsayılan olarak işaretli</label>
              <div className="w-40">{numField('Kopya sayısı', 'copies')}</div>
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" data-submit onClick={() => void save()} disabled={busy} data-testid="ps-save" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white rounded-lg text-sm font-semibold">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet</button>
              <button type="button" onClick={() => void printHtml(dispatchPrintHtml(SAMPLE, s))} className="inline-flex items-center gap-2 px-4 py-2.5 border border-ink-200 bg-white rounded-lg text-sm font-medium"><Printer className="w-4 h-4" /> Örnek fiş yazdır</button>
              <button type="button" onClick={() => void printHtml(calibrationHtml(s))} data-testid="ps-calibration" className="inline-flex items-center gap-2 px-4 py-2.5 border border-ink-200 bg-white rounded-lg text-sm font-medium"><Printer className="w-4 h-4" /> Kalibrasyon sayfası</button>
              {msg && <span className="text-sm text-emerald-700 flex items-center gap-1" role="status"><CheckCircle className="w-4 h-4" />{msg}</span>}
            </div>

            <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-1.5">
              <h2 className="font-semibold">Nokta vuruşlu yazıcı için ipuçları</h2>
              <p>1. Windows: Denetim Masası → Yazıcılar → yazıcınızı seçin → <b>Yazıcı sunucusu özellikleri → Formlar</b> ile kâğıdınızın ölçüsünü (ör. 240 × 140 mm) yeni form olarak ekleyin ve yazıcı tercihlerinde seçin.</p>
              <p>2. Yazdırma penceresinde: <b>Kâğıt boyutu: eklediğiniz form</b> (ör. 240 × 140), <b>Yön: Dikey</b>, <b>Kenar boşlukları: Yok</b>, <b>Ölçek: %100</b>, <b>Üst bilgi ve alt bilgi: kapalı</b>. Fiş yan basılıyorsa yön ayarı veya kâğıt boyutu yanlıştır.</p>
              <p>3. Matbu formda önce <b>Kalibrasyon sayfası</b>nı yazdırın; ızgaradaki mm değerlerine bakıp alan konumlarını düzeltin.</p>
            </section>
          </div>

          <section className="bg-white rounded-xl border border-ink-200/80 shadow-card p-4">
            <h2 className="font-semibold text-ink-700 mb-2">Önizleme · {cfg.widthMm} × {cfg.heightMm} mm</h2>
            <div className="overflow-auto bg-ink-100 rounded-lg p-3" style={{ maxHeight: 720 }}>
              <div style={{ width: cfg.widthMm * 3.78 * scale, height: cfg.heightMm * 3.78 * scale * (cfg.copies > 1 ? 1 : 1) }}>
                <iframe title="Önizleme" srcDoc={preview} data-testid="ps-preview"
                  style={{ width: `${cfg.widthMm}mm`, height: `${cfg.heightMm}mm`, border: 0, background: '#fff', transform: `scale(${scale})`, transformOrigin: '0 0', boxShadow: '0 4px 16px rgba(0,0,0,.12)' }} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
