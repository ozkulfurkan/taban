'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2, Copy, Check, MessageCircle, Mail, Share2, RefreshCw, Ban, Loader2, Eye } from 'lucide-react';
import Modal from '@/app/components/modal';
import { formatDate, formatDateTime } from '@/lib/time';

type Party = { kind: 'customer' | 'supplier'; id: string; name: string; phone?: string | null; email?: string | null };
type LinkInfo = { url: string; createdAt: string; viewCount: number; lastViewedAt: string | null };

// wa.me uluslararası biçim ister: 0532… → 90532…, 532… → 90532…
export function waPhone(phone?: string | null) {
  let d = (phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10 && d.startsWith('5')) d = '90' + d;
  return d;
}

export default function StatementShareButton({ party, accent = 'blue' }: { party: Party; accent?: 'blue' | 'teal' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} disabled={!party.id}
        className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
          accent === 'teal' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
        <Link2 className="w-4 h-4" /> Link Gönder
      </button>
      {open && <ShareModal party={party} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareModal({ party, onClose }: { party: Party; onClose: () => void }) {
  const key = party.kind === 'customer' ? 'customerId' : 'supplierId';
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [busy, setBusy] = useState<'load' | 'regen' | 'close' | null>('load');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<'regen' | 'close' | null>(null);
  const [closed, setClosed] = useState(false);
  const canNativeShare = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';

  const create = useCallback(async (regenerate: boolean) => {
    const res = await fetch('/api/statement-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: party.id, regenerate }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Link oluşturulamadı');
    return j.link as LinkInfo;
  }, [key, party.id]);

  // Pencere açılınca aktif link getirilir; yoksa oluşturulur
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/statement-links?${key}=${encodeURIComponent(party.id)}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'Link alınamadı');
        const l: LinkInfo = j.link ?? await create(false);
        if (alive) setLink(l);
      } catch (e: any) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setBusy(null);
      }
    })();
    return () => { alive = false; };
  }, [key, party.id, create]);

  const regenerate = async () => {
    setConfirm(null); setBusy('regen'); setError(''); setCopied(false);
    try { setLink(await create(true)); setClosed(false); } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  const closeLink = async () => {
    setConfirm(null); setBusy('close'); setError('');
    try {
      const res = await fetch(`/api/statement-links?${key}=${encodeURIComponent(party.id)}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Link kapatılamadı');
      setLink(null); setClosed(true);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
    } catch {
      // Pano izni yoksa alanı seçili bırak, kullanıcı elle kopyalasın
      (document.getElementById('statement-share-url') as HTMLInputElement | null)?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const message = link ? `Sayın ${party.name}, güncel hesap ekstrenizi bu linkten görüntüleyebilirsiniz: ${link.url}` : '';
  const wa = link ? `https://wa.me/${waPhone(party.phone)}?text=${encodeURIComponent(message)}` : '#';
  const mail = link
    ? `mailto:${party.email || ''}?subject=${encodeURIComponent('Hesap Ekstresi')}&body=${encodeURIComponent(message)}`
    : '#';

  return (
    <Modal isOpen onClose={onClose} title="Ekstreyi Link ile Gönder">
      <div className="space-y-4" data-testid="statement-share">
        <p className="text-sm text-slate-600">
          Bu linki açan kişi <b>{party.name}</b> hesap ekstresini giriş yapmadan görür. Ekstre her açılışta günceldir.
        </p>

        {busy === 'load' ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : link ? (
          <>
            <div className="flex gap-2">
              <input id="statement-share-url" readOnly value={link.url} aria-label="Ekstre linki"
                onFocus={e => e.currentTarget.select()}
                className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700" />
              <button onClick={copy}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors ${copied ? 'bg-emerald-600' : 'bg-slate-800 hover:bg-slate-900'}`}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Kopyalandı' : 'Kopyala'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
              <a href={mail}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700">
                <Mail className="w-4 h-4" /> E-posta
              </a>
              {canNativeShare && (
                <button onClick={() => (navigator as any).share({ title: 'Hesap Ekstresi', text: message, url: link.url }).catch(() => {})}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700">
                  <Share2 className="w-4 h-4" /> Paylaş
                </button>
              )}
            </div>

            <p className="flex items-center gap-1.5 text-xs text-slate-500" data-testid="statement-share-info">
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>
                Oluşturulma: {formatDate(link.createdAt)} · {link.viewCount} kez görüntülendi
                {link.lastViewedAt ? ` · son: ${formatDateTime(link.lastViewedAt)}` : ''}
              </span>
            </p>
          </>
        ) : closed ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
            Link kapatıldı. Gönderilen link artık açılmaz. İsterseniz yeni link oluşturabilirsiniz.
          </div>
        ) : null}

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        {confirm ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
            <p className="text-sm text-amber-900">
              {confirm === 'regen'
                ? 'Yeni link oluşturulunca daha önce gönderdiğiniz link artık açılmaz. Devam edilsin mi?'
                : 'Link kapatılınca gönderdiğiniz link artık açılmaz. Devam edilsin mi?'}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-white">Vazgeç</button>
              <button onClick={confirm === 'regen' ? regenerate : closeLink}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700">
                {confirm === 'regen' ? 'Evet, yeni link oluştur' : 'Evet, linki kapat'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 justify-between border-t pt-4">
            <button onClick={() => (link ? setConfirm('regen') : regenerate())} disabled={!!busy}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              {busy === 'regen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Yeni Link Oluştur
            </button>
            {link && (
              <button onClick={() => setConfirm('close')} disabled={!!busy}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
                {busy === 'close' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                Linki Kapat
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
