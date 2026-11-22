'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Bug, Lightbulb, Send, Loader2, Clock,
  User, Shield, CheckCircle2, AlertCircle, ChevronDown, Paperclip, X
} from '@/app/components/icons';
import AppShell from '@/app/components/app-shell';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  content: string;
  isAdmin: boolean;
  createdAt: string;
  user?: { id: string; name?: string; email: string };
}

interface TicketDetail {
  id: string;
  ticketNo: string;
  type: string;
  title: string;
  description: string;
  status: 'YENI' | 'INCELENIYOR' | 'CEVAPLANDI' | 'COZULDU';
  priority: 'DUSUK' | 'ORTA' | 'KRITIK';
  module?: string;
  pageUrl?: string;
  browser?: string;
  createdAt: string;
  user: { id: string; name?: string; email: string };
  company: { id: string; name: string };
  messages: Message[];
  attachments: { id: string; name: string; size: number; mimeType: string }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_MAP = {
  YENI:        { label: 'Yeni',        color: 'bg-brand-100 text-brand-800 border-brand-200' },
  INCELENIYOR: { label: 'İnceleniyor', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  CEVAPLANDI:  { label: 'Cevaplandı',  color: 'bg-brand-100 text-brand-800 border-brand-200' },
  COZULDU:     { label: 'Çözüldü',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const PRIORITY_MAP = {
  DUSUK:  { label: 'Düşük',  color: 'bg-ink-100 text-ink-600' },
  ORTA:   { label: 'Orta',   color: 'bg-amber-100 text-amber-700' },
  KRITIK: { label: 'Kritik', color: 'bg-red-100 text-red-700' },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dakika önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} saat önce`;
  return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession() || {};
  const user = session?.user as any;
  const isAdmin = user?.role === 'ADMIN';

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTicket = () => {
    fetch(`/api/support/tickets/${params.id}`)
      .then(r => r.json())
      .then(data => { setTicket(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchTicket(); }, [params.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/tickets/${params.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply }),
      });
      if (res.ok) { setReply(''); fetchTicket(); }
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setStatusChanging(true);
    setShowStatusMenu(false);
    try {
      await fetch(`/api/support/tickets/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchTicket();
    } finally {
      setStatusChanging(false);
    }
  };

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    </AppShell>
  );

  if (!ticket) return (
    <AppShell>
      <div className="text-center py-20">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-ink-600">Talep bulunamadı.</p>
      </div>
    </AppShell>
  );

  const statusInfo = STATUS_MAP[ticket.status];
  const priorityInfo = PRIORITY_MAP[ticket.priority];

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Back + Header */}
        <div>
          <button
            onClick={() => router.push('/destek-merkezi')}
            className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Destek Merkezi
          </button>

          <div className="bg-white border border-ink-200 rounded-2xl p-5 shadow-card">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                ticket.type === 'BUG' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                {ticket.type === 'BUG'
                  ? <Bug className="w-5 h-5 text-red-500" />
                  : <Lightbulb className="w-5 h-5 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-mono text-ink-400">{ticket.ticketNo}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityInfo.color}`}>
                    {priorityInfo.label}
                  </span>
                  {ticket.module && (
                    <span className="text-xs bg-ink-100 text-ink-600 rounded-full px-2 py-0.5">{ticket.module}</span>
                  )}
                </div>
                <h1 className="text-base font-semibold text-ink-800">{ticket.title}</h1>
                <div className="flex items-center gap-3 mt-1 text-xs text-ink-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {ticket.user.name ?? ticket.user.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ticket.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  {isAdmin && (
                    <span className="text-brand-600">{ticket.company.name}</span>
                  )}
                </div>
              </div>

              {/* Status change (admin) */}
              {isAdmin && (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setShowStatusMenu(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-ink-200 rounded-xl hover:bg-ink-50 transition-colors"
                  >
                    {statusChanging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Durum
                  </button>
                  {showStatusMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-ink-200 rounded-xl shadow-lg py-1 z-20 min-w-[140px]">
                      {Object.entries(STATUS_MAP).map(([key, val]) => (
                        <button
                          key={key}
                          onClick={() => handleStatusChange(key)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-ink-50 transition-colors flex items-center gap-2 ${ticket.status === key ? 'font-semibold' : ''}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${val.color.split(' ')[0]}`} />
                          {val.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Original description */}
            <div className="mt-4 pt-4 border-t border-ink-100">
              <p className="text-xs font-medium text-ink-400 mb-2">Açıklama</p>
              <p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </div>
          </div>
        </div>

        {/* Attachments */}
        {ticket.attachments.length > 0 && (
          <div className="bg-white border border-ink-200 rounded-2xl shadow-card overflow-hidden">
            <div className="p-4 border-b border-ink-100 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-ink-400" />
              <h2 className="text-sm font-semibold text-ink-700">Ekler ({ticket.attachments.length})</h2>
            </div>
            <div className="p-4 flex flex-wrap gap-3">
              {ticket.attachments.map(att => {
                const isImage = att.mimeType.startsWith('image/');
                const url = `/api/support/tickets/${ticket.id}/attachments/${att.id}`;
                return isImage ? (
                  <button
                    key={att.id}
                    onClick={() => setLightbox(url)}
                    className="group relative overflow-hidden rounded-xl border border-ink-200 hover:border-brand-300 transition-colors"
                  >
                    <img src={url} alt={att.name} className="w-40 h-28 object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </button>
                ) : (
                  <a
                    key={att.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded-xl border border-ink-200 hover:border-brand-300 transition-colors"
                  >
                    <div className="w-40 h-28 flex flex-col items-center justify-center gap-2 bg-ink-50">
                      <Paperclip className="w-6 h-6 text-ink-400" />
                      <span className="text-xs text-ink-500 px-2 text-center truncate w-full">{att.name}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Lightbox */}
        <AnimatePresence>
          {lightbox && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              onClick={() => setLightbox(null)}
            >
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="relative z-10 max-w-[90vw] max-h-[90vh]"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => setLightbox(null)}
                  className="absolute -top-3 -right-3 z-20 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-ink-100 transition-colors"
                >
                  <X className="w-4 h-4 text-ink-700" />
                </button>
                <img
                  src={lightbox}
                  alt="Ekran görüntüsü"
                  className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-ink-100">
            <h2 className="text-sm font-semibold text-ink-700">Konuşma</h2>
          </div>

          <div className="p-4 space-y-4 min-h-[200px] max-h-[420px] overflow-y-auto">
            {ticket.messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-ink-400">Henüz mesaj yok. İlk mesajı siz gönderin.</p>
              </div>
            )}
            {ticket.messages.map((msg, i) => {
              const isMyMsg = !msg.isAdmin;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex gap-2.5 ${isMyMsg ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium ${
                    msg.isAdmin ? 'bg-brand-700 text-white' : 'bg-ink-200 text-ink-600'
                  }`}>
                    {msg.isAdmin ? <Shield className="w-3.5 h-3.5" /> : (msg.user?.name?.[0] ?? '?')}
                  </div>
                  <div className={`max-w-[75%] ${isMyMsg ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.isAdmin
                        ? 'bg-brand-700 text-white rounded-tl-sm'
                        : 'bg-ink-100 text-ink-700 rounded-tr-sm'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-xs text-ink-400 px-1">
                      {msg.isAdmin ? 'Destek Ekibi' : msg.user?.name ?? msg.user?.email ?? 'Siz'} · {timeAgo(msg.createdAt)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Resolved banner */}
          {ticket.status === 'COZULDU' ? (
            <div className="px-4 pb-4 pt-3 border-t border-ink-100">
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Bu talep çözüldü olarak işaretlendi.
              </div>
            </div>
          ) : (
            <form onSubmit={handleReply} className="px-4 pb-4 pt-3 border-t border-ink-100">
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 px-3.5 py-2.5 border border-ink-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={!reply.trim() || sending}
                  className="px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Gönder
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
