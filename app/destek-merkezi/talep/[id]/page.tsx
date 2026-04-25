'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Bug, Lightbulb, Send, Loader2, Clock,
  User, Shield, CheckCircle2, AlertCircle, ChevronDown, Paperclip, Image
} from 'lucide-react';
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
  YENI:        { label: 'Yeni',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  INCELENIYOR: { label: 'İnceleniyor', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  CEVAPLANDI:  { label: 'Cevaplandı',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  COZULDU:     { label: 'Çözüldü',     color: 'bg-green-100 text-green-700 border-green-200' },
};

const PRIORITY_MAP = {
  DUSUK:  { label: 'Düşük',  color: 'bg-slate-100 text-slate-600' },
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
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    </AppShell>
  );

  if (!ticket) return (
    <AppShell>
      <div className="text-center py-20">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-slate-600">Talep bulunamadı.</p>
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
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Destek Merkezi
          </button>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
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
                  <span className="text-xs font-mono text-slate-400">{ticket.ticketNo}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityInfo.color}`}>
                    {priorityInfo.label}
                  </span>
                  {ticket.module && (
                    <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{ticket.module}</span>
                  )}
                </div>
                <h1 className="text-base font-semibold text-slate-800">{ticket.title}</h1>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {ticket.user.name ?? ticket.user.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ticket.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  {isAdmin && (
                    <span className="text-blue-500">{ticket.company.name}</span>
                  )}
                </div>
              </div>

              {/* Status change (admin) */}
              {isAdmin && (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setShowStatusMenu(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    {statusChanging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Durum
                  </button>
                  {showStatusMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 min-w-[140px]">
                      {Object.entries(STATUS_MAP).map(([key, val]) => (
                        <button
                          key={key}
                          onClick={() => handleStatusChange(key)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center gap-2 ${ticket.status === key ? 'font-semibold' : ''}`}
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
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 mb-2">Açıklama</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </div>
          </div>
        </div>

        {/* Attachments */}
        {ticket.attachments.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Ekler ({ticket.attachments.length})</h2>
            </div>
            <div className="p-4 flex flex-wrap gap-3">
              {ticket.attachments.map(att => {
                const isImage = att.mimeType.startsWith('image/');
                const url = `/api/support/tickets/${ticket.id}/attachments/${att.id}`;
                return (
                  <a
                    key={att.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded-xl border border-slate-200 hover:border-blue-300 transition-colors"
                  >
                    {isImage ? (
                      <img
                        src={url}
                        alt={att.name}
                        className="w-40 h-28 object-cover"
                      />
                    ) : (
                      <div className="w-40 h-28 flex flex-col items-center justify-center gap-2 bg-slate-50">
                        <Paperclip className="w-6 h-6 text-slate-400" />
                        <span className="text-xs text-slate-500 px-2 text-center truncate w-full">{att.name}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end p-2">
                      <span className="text-xs text-white bg-black/50 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-full">
                        {att.name}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Konuşma</h2>
          </div>

          <div className="p-4 space-y-4 min-h-[200px] max-h-[420px] overflow-y-auto">
            {ticket.messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400">Henüz mesaj yok. İlk mesajı siz gönderin.</p>
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
                    msg.isAdmin ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {msg.isAdmin ? <Shield className="w-3.5 h-3.5" /> : (msg.user?.name?.[0] ?? '?')}
                  </div>
                  <div className={`max-w-[75%] ${isMyMsg ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.isAdmin
                        ? 'bg-blue-600 text-white rounded-tl-sm'
                        : 'bg-slate-100 text-slate-700 rounded-tr-sm'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-xs text-slate-400 px-1">
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
            <div className="px-4 pb-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl p-3">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Bu talep çözüldü olarak işaretlendi.
              </div>
            </div>
          ) : (
            <form onSubmit={handleReply} className="px-4 pb-4 pt-3 border-t border-slate-100">
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={!reply.trim() || sending}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
