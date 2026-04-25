'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/app-shell';
import { ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';

const ENTITIES = ['Invoice', 'ReturnInvoice', 'Payment', 'Cek', 'Customer', 'Supplier', 'Material', 'Stock', 'Purchase'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'ERROR'];

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Oluşturma',
  UPDATE: 'Güncelleme',
  DELETE: 'Silme',
  ERROR: 'Hata',
};

const ENTITY_LABELS: Record<string, string> = {
  Invoice: 'Fatura',
  ReturnInvoice: 'İade Faturası',
  Payment: 'Ödeme',
  Cek: 'Çek',
  Customer: 'Müşteri',
  Supplier: 'Tedarikçi',
  Material: 'Hammadde',
  Stock: 'Stok',
  Purchase: 'Alış',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  ERROR: 'bg-orange-100 text-orange-800',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [companyId, setCompanyId] = useState('');

  const load = async (p = page) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (entity) params.set('entity', entity);
    if (action) params.set('action', action);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (companyId) params.set('companyId', companyId);
    try {
      const res = await fetch(`/api/logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        setPage(p);
        setIsSuperAdmin(data.isSuperAdmin ?? false);
        if (data.companies?.length) setCompanies(data.companies);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [entity, action, from, to, companyId]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Başlık */}
        <div className="flex items-center gap-3 mb-6">
          <ClipboardList className="w-6 h-6 text-gray-600" />
          <h1 className="text-xl font-bold text-gray-900">Log Kayıtları</h1>
          <span className="ml-auto text-sm text-gray-500">{total} kayıt</span>
        </div>

        {/* Filtreler */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3">
          {isSuperAdmin && companies.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Şirket</label>
              <select
                value={companyId}
                onChange={e => setCompanyId(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tümü</option>
                {companies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Varlık</label>
            <select
              value={entity}
              onChange={e => setEntity(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tümü</option>
              {ENTITIES.map(e => <option key={e} value={e}>{ENTITY_LABELS[e] ?? e}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">İşlem</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tümü</option>
              {ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Başlangıç</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Bitiş</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tablo */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Yükleniyor…</div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Kayıt bulunamadı</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Tarih</th>
                    {isSuperAdmin && (
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Şirket</th>
                    )}
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Kullanıcı</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">İşlem</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Varlık</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Detay</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-gray-600 text-xs font-medium whitespace-nowrap">
                          {log.company?.name ?? '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-700 font-medium">{log.userName ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{ENTITY_LABELS[log.entity] ?? log.entity}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{log.detail ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sayfalama */}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-500">{page} / {pages} sayfa</span>
            <div className="flex gap-2">
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= pages}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
