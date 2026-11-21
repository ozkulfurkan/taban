'use client';

// Ayarlar: günlük özet e-postası (her sabah 10:00, firma sahibi ve yöneticilere) aç / kapat.
import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';

export function DailySummaryCard() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/company').then(r => r.json()).then(d => setOn(d?.dailySummaryEmail !== false)).catch(() => setOn(null));
  }, []);

  const toggle = async () => {
    if (on === null) return;
    const next = !on;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/company', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dailySummaryEmail: next }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Kaydedilemedi');
      setOn(next);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4" data-testid="daily-summary-card">
      <Mail className="w-5 h-5 text-blue-600 shrink-0" />
      <div className="flex-1">
        <h2 className="font-semibold text-slate-700">Günlük özet e-postası</h2>
        <p className="text-sm text-slate-500">Her sabah 10:00&apos;da bekleyen siparişler ve kasa/banka detayı firma sahibi ve yöneticilere gönderilir.</p>
        {error ? <p className="text-sm text-red-600 mt-1">{error}</p> : null}
      </div>
      <button type="button" role="switch" aria-checked={!!on} aria-label="Günlük özet e-postası" onClick={toggle} disabled={busy || on === null}
        data-testid="daily-summary-toggle"
        className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
