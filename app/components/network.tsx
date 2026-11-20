'use client';

// Firma ağı (firmalar arası bağlantı): firma kodu kartı, tedarikçi bağlantı kartı ve gelen istekler.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Check, Copy, FileText, Link2, Loader2, RefreshCw, ShoppingCart, X, Network } from 'lucide-react';

type BuyerLink = { id: string; status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED'; buyerSupplierId: string | null; sellerCompany: { name: string } };
type SellerLink = {
  id: string; status: 'PENDING' | 'ACTIVE'; createdAt: string; sellerCustomerId: string | null;
  buyerCompany: { name: string; taxId: string | null; phone: string | null; address: string | null };
  sellerCustomer: { id: string; name: string } | null;
};

function useRole() {
  const { data } = useSession() || {};
  const role = (data?.user as any)?.role as string | undefined;
  return { canWrite: !!role && role !== 'VIEWER', isOwner: role === 'COMPANY_OWNER' || role === 'ADMIN' };
}

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'İşlem yapılamadı');
  return data;
}

/** Ayarlar: firma kodu (kopyala, yenile) */
export function CompanyCodeCard() {
  const canEdit = useRole().isOwner;
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { call('/api/network/code').then(d => setCode(d.code)).catch(() => {}); }, []);

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const regenerate = async () => {
    if (!confirm('Yeni kod oluşturulsun mu? Eski kod ile yeni istek gönderilemez; kurulmuş bağlantılar etkilenmez.')) return;
    setBusy(true);
    try { setCode((await call('/api/network/code', { method: 'POST' })).code); } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-3" data-testid="company-code-card">
      <div className="flex items-center gap-3 pb-3 border-b">
        <Network className="w-5 h-5 text-blue-600" />
        <h2 className="font-semibold text-slate-700">SoleCost firma kodu</h2>
      </div>
      <p className="text-sm text-slate-500">
        Size SoleCost üzerinden sipariş vermek isteyen firmalar bu kodla sizi tedarikçi olarak ekler. İstek size gelir; onaylarsanız sipariş verebilirler.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-lg font-bold tracking-wider px-3 py-1.5 bg-slate-100 rounded-lg" data-testid="company-code">{code ?? '…'}</span>
        <button onClick={copy} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
        {canEdit && (
          <button onClick={regenerate} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Yeni kod
          </button>
        )}
      </div>
    </div>
  );
}

const STATUS_TEXT: Record<BuyerLink['status'], string> = {
  PENDING: 'Onay bekleniyor', ACTIVE: 'Bağlı', REJECTED: 'İstek reddedildi', REVOKED: 'Bağlantı kaldırıldı',
};

/** Tedarikçi detayı: SoleCost bağlantısı (kod ile bağla, durum, sipariş ver) */
export function SupplierNetworkCard({ supplierId }: { supplierId: string }) {
  const { canWrite } = useRole();
  const [link, setLink] = useState<BuyerLink | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    call(`/api/network/links?supplierId=${supplierId}`).then(d => setLink((d.asBuyer as BuyerLink[])[0] ?? null)).catch(() => setLink(null));
  }, [supplierId]);
  useEffect(load, [load]);

  const connect = async () => {
    setError(''); setBusy(true);
    try { await call('/api/network/links', { method: 'POST', body: JSON.stringify({ code, supplierId }) }); setOpen(false); setCode(''); load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  if (link === undefined) return null;
  const active = link?.status === 'ACTIVE';
  const canRequest = !link || link.status === 'REJECTED' || link.status === 'REVOKED';

  return (
    <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-3 ${active ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`} data-testid="supplier-network">
      <Link2 className={`w-5 h-5 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-semibold text-slate-700">
          {link ? `SoleCost · ${link.sellerCompany.name}` : 'SoleCost bağlantısı yok'}
        </p>
        <p className="text-xs text-slate-500" data-testid="supplier-network-status">
          {link ? STATUS_TEXT[link.status] : 'Tedarikçi SoleCost kullanıyorsa firma koduyla bağlanıp doğrudan sipariş verebilirsiniz.'}
        </p>
      </div>
      {active && (
        <>
          <Link href={`/suppliers/${supplierId}/karsi-ekstre`} data-testid="supplier-link-statement"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-white rounded-lg">
            <FileText className="w-4 h-4" /> Karşı ekstre
          </Link>
          <Link href={`/verilen-siparisler?linkId=${link!.id}`} className="px-3 py-2 text-sm text-slate-600 hover:bg-white rounded-lg">Siparişlerim</Link>
          {canWrite && (
            <Link href={`/suppliers/${supplierId}/siparis`} data-testid="supplier-order"
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
              <ShoppingCart className="w-4 h-4" /> Sipariş ver
            </Link>
          )}
        </>
      )}
      {canWrite && canRequest && !open && (
        <button onClick={() => setOpen(true)} className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium" data-testid="supplier-connect">
          Firma koduyla bağla
        </button>
      )}
      {open && (
        <div className="w-full flex flex-wrap items-center gap-2">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="SC-XXXXXX" autoFocus data-testid="supplier-code"
            className="flex-1 min-w-[160px] px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none" />
          <button onClick={connect} disabled={busy || !code.trim()} data-testid="supplier-code-send"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} İstek gönder
          </button>
          <button onClick={() => { setOpen(false); setError(''); }} className="p-2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          {error && <p className="w-full text-sm text-red-600" data-testid="supplier-code-error">{error}</p>}
          <p className="w-full text-xs text-slate-400">Kodu tedarikçinizden isteyin (SoleCost → Ayarlar → Firma kodu). İstek onaylanınca sipariş verebilirsiniz.</p>
        </div>
      )}
    </div>
  );
}

/** Müşteri detayı (satıcı tarafı): müşteri SoleCost'ta bağlıysa bilgi ve karşı ekstre bağlantısı */
export function CustomerNetworkCard({ customerId }: { customerId: string }) {
  const [link, setLink] = useState<SellerLink | null>(null);
  useEffect(() => {
    call(`/api/network/links?customerId=${customerId}`)
      .then(d => setLink((d.asSeller as SellerLink[]).find(l => l.status === 'ACTIVE') ?? null))
      .catch(() => setLink(null));
  }, [customerId]);
  if (!link) return null;
  return (
    <div className="rounded-xl border p-4 flex flex-wrap items-center gap-3 bg-emerald-50 border-emerald-200" data-testid="customer-network">
      <Link2 className="w-5 h-5 text-emerald-600" />
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-semibold text-slate-700">SoleCost · {link.buyerCompany.name}</p>
        <p className="text-xs text-slate-500">Bağlı firma: siparişleri doğrudan size gelir, ekstrenizi karşılıklı görebilirsiniz.</p>
      </div>
      <Link href={`/customers/${customerId}/karsi-ekstre`} data-testid="customer-link-statement"
        className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-white rounded-lg">
        <FileText className="w-4 h-4" /> Karşı ekstre
      </Link>
    </div>
  );
}

/** Satıcı tarafı: gelen bağlantı istekleri (yalnızca firma yöneticisi yanıtlar) */
export function LinkRequests() {
  const canApprove = useRole().isOwner;
  const [items, setItems] = useState<SellerLink[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[] | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    call('/api/network/links').then(d => setItems((d.asSeller as SellerLink[]).filter(l => l.status === 'PENDING'))).catch(() => {});
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!items.length || customers || !canApprove) return;
    call('/api/customers?minimal=true').then(d => setCustomers(Array.isArray(d) ? d : (d.customers ?? []))).catch(() => setCustomers([]));
  }, [items.length, customers, canApprove]);

  const respond = async (l: SellerLink, approve: boolean) => {
    setBusy(l.id);
    try {
      if (approve) {
        const pick = choice[l.id] || 'new';
        await call(`/api/network/links/${l.id}/approve`, { method: 'POST', body: JSON.stringify(pick === 'new' ? { createCustomer: true } : { customerId: pick }) });
      } else {
        if (!confirm(`${l.buyerCompany.name} firmasının isteği reddedilsin mi?`)) return;
        await call(`/api/network/links/${l.id}/reject`, { method: 'POST' });
      }
      load();
    } catch (e: any) { alert(e.message); } finally { setBusy(null); }
  };

  if (!items.length) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3" data-testid="link-requests">
      <p className="text-sm font-semibold text-amber-800">SoleCost bağlantı istekleri ({items.length})</p>
      {items.map(l => (
        <div key={l.id} className="bg-white rounded-lg p-3 flex flex-wrap items-center gap-3" data-testid={`link-request-${l.id}`}>
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-semibold text-slate-700">{l.buyerCompany.name}</p>
            <p className="text-xs text-slate-500">
              Sizi tedarikçi olarak eklemek ve size sipariş vermek istiyor{l.buyerCompany.taxId ? ` · VKN ${l.buyerCompany.taxId}` : ''}
            </p>
          </div>
          {canApprove ? (
            <>
              <select value={choice[l.id] ?? 'new'} onChange={e => setChoice(c => ({ ...c, [l.id]: e.target.value }))} data-testid={`link-customer-${l.id}`}
                className="px-2 py-2 border border-slate-200 rounded-lg text-sm max-w-[240px]">
                <option value="new">Yeni müşteri olarak aç</option>
                {(customers ?? []).map(c => <option key={c.id} value={c.id}>Mevcut: {c.name}</option>)}
              </select>
              <button onClick={() => respond(l, true)} disabled={busy === l.id} data-testid={`link-approve-${l.id}`}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">Onayla</button>
              <button onClick={() => respond(l, false)} disabled={busy === l.id}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Reddet</button>
            </>
          ) : <span className="text-xs text-slate-500">Firma yöneticisi onaylayabilir</span>}
        </div>
      ))}
    </div>
  );
}
