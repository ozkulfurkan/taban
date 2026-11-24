'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Loader2, MessageSquare, Send, XCircle } from '@/app/components/icons';

type Msg = {
  id: string; kind: string; authorType: 'staff' | 'customer'; authorName: string; body: string; createdAt: string;
  resolvedAt?: string | null; resolution?: string | null;
};

const REQUEST_LABEL: Record<string, string> = { CANCEL_REQUEST: 'İptal talebi', CHANGE_REQUEST: 'Değişiklik talebi' };

// Sipariş içi mesajlaşma (portal müşterisi ↔ firma). viewer: kimin ekranı; firma tarafında açık talepler
// Onayla/Reddet ile yanıtlanır (resolveBase/{mesajId}/resolve). t: portal çevirisi.
export function OrderMessages({ endpoint, viewer, resolveBase, t = s => s, onChanged, refreshKey = 0 }: {
  endpoint: string; viewer: 'staff' | 'customer'; resolveBase?: string; t?: (s: string) => string;
  onChanged?: () => void; refreshKey?: number;
}) {
  const [list, setList] = useState<Msg[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    fetch(endpoint).then(r => r.json()).then(d => setList(Array.isArray(d) ? d : [])).catch(() => setList([]));
  }, [endpoint]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || t('Mesaj gönderilemedi'));
      setText(''); load(); onChanged?.();
    } catch (e: any) { setError(e?.message || t('Mesaj gönderilemedi')); } finally { setBusy(false); }
  };

  const resolve = async (m: Msg, resolution: 'approved' | 'rejected') => {
    if (!resolveBase) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`${resolveBase}/${m.id}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolution, note: note.trim() || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Talep yanıtlanamadı');
      setNote(''); load(); onChanged?.();
    } catch (e: any) { setError(e?.message || 'Talep yanıtlanamadı'); } finally { setBusy(false); }
  };

  const open = (list ?? []).filter(m => REQUEST_LABEL[m.kind] && !m.resolvedAt);

  return (
    <div className="bg-white rounded-xl p-5 shadow-card border border-ink-200/80 space-y-4" data-testid="order-messages">
      <h2 className="font-semibold text-ink-700 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-brand-700" /> {t('Mesajlar')}</h2>

      {viewer === 'staff' && open.map(m => (
        <div key={m.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2" data-testid="open-request">
          <p className="text-sm font-semibold text-amber-900">{REQUEST_LABEL[m.kind]} · {m.authorName}</p>
          <p className="text-sm text-amber-900 whitespace-pre-line">{m.body}</p>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Müşteriye açıklama (isteğe bağlı)"
            className="w-full px-3 py-1.5 border border-amber-200 rounded-lg text-sm bg-white" />
          <div className="flex gap-2">
            <button onClick={() => resolve(m, 'approved')} disabled={busy} data-testid="request-approve"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> {m.kind === 'CANCEL_REQUEST' ? 'Onayla ve iptal et' : 'Onayla'}
            </button>
            <button onClick={() => resolve(m, 'rejected')} disabled={busy} data-testid="request-reject"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ink-200 bg-white hover:bg-ink-50 text-sm font-medium text-ink-700">
              <XCircle className="w-4 h-4" /> Reddet
            </button>
          </div>
          {m.kind === 'CHANGE_REQUEST' && <p className="text-xs text-amber-800">Değişikliği onaylarsanız siparişi aşağıdan düzenleyin; müşteriye onay mesajı gider.</p>}
        </div>
      ))}

      {list === null ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-brand-700" /></div>
      ) : list.length === 0 ? (
        <p className="text-sm text-ink-400">{t('Henüz mesaj yok.')}</p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {list.map(m => {
            const mine = m.authorType === viewer;
            return (
              <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-brand-700 text-white rounded-br-md' : 'bg-ink-100 text-ink-800 rounded-bl-md'}`}>
                  {REQUEST_LABEL[m.kind] && (
                    <p className={`text-[11px] font-semibold uppercase tracking-wide mb-0.5 ${mine ? 'text-white/80' : 'text-amber-700'}`}>
                      {t(REQUEST_LABEL[m.kind])}{m.resolvedAt ? ` · ${m.resolution === 'approved' ? t('onaylandı') : t('reddedildi')}` : ` · ${t('yanıt bekliyor')}`}
                    </p>
                  )}
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                  <p className={`text-[11px] mt-1 ${mine ? 'text-white/70' : 'text-ink-400'}`}>{m.authorName} · {new Date(m.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2 items-end">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={2000} placeholder={t('Mesajınızı yazın…')} data-testid="message-input"
          className="flex-1 px-3 py-2 border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 outline-none resize-y" />
        <button onClick={send} disabled={busy || !text.trim()} data-testid="message-send"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white text-sm font-medium">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {t('Gönder')}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
