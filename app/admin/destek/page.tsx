'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LifeBuoy, Bug, Lightbulb, Clock, CheckCircle2,
  AlertTriangle, Filter, Loader2, MessageSquare, ChevronRight, X
} from '@/app/components/icons';
import Link from 'next/link';
import AppShell from '@/app/components/app-shell';
import { matchesText } from '@/lib/search';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Ticket {
  id: string;
  ticketNo: string;
  type: string;
  title: string;
  status: 'YENI' | 'INCELENIYOR' | 'CEVAPLANDI' | 'COZULDU';
  priority: 'DUSUK' | 'ORTA' | 'KRITIK';
  module?: string;
  createdAt: string;
  user: { name?: string; email: string };
  company: { id: string; name: string };
  _count: { messages: number };
}

interface Stats {
  yeni: number;
  inceleniyor: number;
  cevaplandi: number;
  cozuldu: number;
  kritik: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_MAP = {
  YENI:        { label: 'Yeni',        color: 'bg-brand-100 text-brand-800 border-brand-200' },
  INCELENIYOR: { label: 'İnceleniyor', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  CEVAPLANDI:  { label: 'Cevaplandı',  color: 'bg-brand-100 text-brand-800 border-brand-200' },
  COZULDU:     { label: 'Çözüldü',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const PRIORITY_MAP = {
  DUSUK:  { label: 'Düşük',  color: 'text-ink-600',  dot: 'bg-ink-400' },
  ORTA:   { label: 'Orta',   color: 'text-amber-700',  dot: 'bg-amber-400' },
  KRITIK: { label: 'Kritik', color: 'text-red-700',    dot: 'bg-red-500' },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, onClick, active }: {
  label: string; value: number; icon: any; color: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`bg-white border rounded-xl p-4 text-left w-full transition-all shadow-sm ${
        active ? 'border-brand-500 ring-2 ring-brand-200' : 'border-ink-200 hover:border-brand-300'
      }`}
      whileHover={{ y: -1 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-2xl font-bold text-ink-800">{value}</span>
      </div>
      <p className="text-xs font-medium text-ink-500">{label}</p>
    </motion.button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDestekPage() {
  const [data, setData] = useState<{ stats: Stats; tickets: Ticket[]; companies: { id: string; name: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/support/admin')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const hasFilters = filterStatus || filterPriority || filterCompany || filterModule || search;
  const clearFilters = () => { setFilterStatus(''); setFilterPriority(''); setFilterCompany(''); setFilterModule(''); setSearch(''); };

  const filtered = (data?.tickets ?? []).filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterCompany && t.company.id !== filterCompany) return false;
    if (filterModule && t.module !== filterModule) return false;
    if (search && !matchesText(t.title, search.toLowerCase()) &&
        !matchesText(t.ticketNo, search.toLowerCase()) &&
        !matchesText((t.user.name ?? ''), search.toLowerCase())) return false;
    return true;
  });

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    </AppShell>
  );

  const stats = data?.stats ?? { yeni: 0, inceleniyor: 0, cevaplandi: 0, cozuldu: 0, kritik: 0 };

  const MODULES = ['Ön Muhasebe', 'Maliyet', 'Personel', 'Sipariş', 'Stok', 'Diğer'];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-700 rounded-xl flex items-center justify-center">
            <LifeBuoy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="page-title">Destek Yönetimi</h1>
            <p className="text-sm text-ink-500">Tüm müşteri talepleri ve hata bildirimleri</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Yeni Talepler" value={stats.yeni} icon={Clock}
            color="bg-brand-100 text-brand-700"
            onClick={() => setFilterStatus(filterStatus === 'YENI' ? '' : 'YENI')}
            active={filterStatus === 'YENI'}
          />
          <StatCard
            label="İnceleniyor" value={stats.inceleniyor} icon={Loader2}
            color="bg-amber-100 text-amber-600"
            onClick={() => setFilterStatus(filterStatus === 'INCELENIYOR' ? '' : 'INCELENIYOR')}
            active={filterStatus === 'INCELENIYOR'}
          />
          <StatCard
            label="Cevap Bekliyor" value={stats.cevaplandi} icon={MessageSquare}
            color="bg-brand-100 text-brand-700"
            onClick={() => setFilterStatus(filterStatus === 'CEVAPLANDI' ? '' : 'CEVAPLANDI')}
            active={filterStatus === 'CEVAPLANDI'}
          />
          <StatCard
            label="Çözüldü" value={stats.cozuldu} icon={CheckCircle2}
            color="bg-emerald-100 text-emerald-600"
            onClick={() => setFilterStatus(filterStatus === 'COZULDU' ? '' : 'COZULDU')}
            active={filterStatus === 'COZULDU'}
          />
          <StatCard
            label="Kritik Aktif" value={stats.kritik} icon={AlertTriangle}
            color="bg-red-100 text-red-600"
            onClick={() => setFilterPriority(filterPriority === 'KRITIK' ? '' : 'KRITIK')}
            active={filterPriority === 'KRITIK'}
          />
        </div>

        {/* Filters */}
        <div className="bg-white border border-ink-200 rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-ink-400" />
            <span className="text-sm font-medium text-ink-700">Filtreler</span>
            {hasFilters && (
              <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-ink-500 hover:text-red-500 transition-colors">
                <X className="w-3.5 h-3.5" /> Temizle
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Ara..."
              className="col-span-2 sm:col-span-1 px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-600 bg-white"
            >
              <option value="">Tüm Durumlar</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-600 bg-white"
            >
              <option value="">Tüm Öncelikler</option>
              {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select
              value={filterCompany}
              onChange={e => setFilterCompany(e.target.value)}
              className="px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-600 bg-white"
            >
              <option value="">Tüm Firmalar</option>
              {(data?.companies ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={filterModule}
              onChange={e => setFilterModule(e.target.value)}
              className="px-3 py-2 border border-ink-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-600 bg-white"
            >
              <option value="">Tüm Modüller</option>
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Ticket Table */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-ink-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-700">
              {filtered.length} talep
              {hasFilters && <span className="text-ink-400 font-normal"> (filtrelenmiş)</span>}
            </h2>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <LifeBuoy className="w-8 h-8 text-ink-300 mx-auto mb-2" />
              <p className="text-ink-500 text-sm">Talep bulunamadı</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {filtered.map((t, i) => {
                const statusInfo = STATUS_MAP[t.status];
                const priorityInfo = PRIORITY_MAP[t.priority];
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <Link
                      href={`/destek-merkezi/talep/${t.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50 transition-colors group"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        t.type === 'BUG' ? 'bg-red-100' : 'bg-amber-100'
                      }`}>
                        {t.type === 'BUG'
                          ? <Bug className="w-3.5 h-3.5 text-red-500" />
                          : <Lightbulb className="w-3.5 h-3.5 text-amber-500" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-ink-400">{t.ticketNo}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          <span className={`flex items-center gap-1 text-xs font-medium ${priorityInfo.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${priorityInfo.dot}`} />
                            {priorityInfo.label}
                          </span>
                          {t.module && (
                            <span className="text-xs bg-ink-100 text-ink-500 rounded-full px-2 py-0.5">{t.module}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-ink-700 truncate mt-0.5 group-hover:text-brand-800">{t.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-ink-400">
                          <span>{t.company.name}</span>
                          <span>·</span>
                          <span>{t.user.name ?? t.user.email}</span>
                          <span>·</span>
                          <span>{new Date(t.createdAt).toLocaleDateString('tr-TR')}</span>
                          {t._count.messages > 0 && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-0.5">
                                <MessageSquare className="w-3 h-3" />
                                {t._count.messages}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-brand-500 flex-shrink-0 transition-colors" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
