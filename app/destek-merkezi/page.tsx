'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LifeBuoy, Bug, Lightbulb, ClipboardList, BookOpen,
  ChevronRight, Search, Send, Paperclip, X, CheckCircle2,
  AlertCircle, Clock, MessageSquare, Upload, Loader2,
  ChevronDown, Star
} from 'lucide-react';
import Link from 'next/link';
import AppShell from '@/app/components/app-shell';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'hata' | 'oneri' | 'talepler' | 'bilgi';

interface Ticket {
  id: string;
  ticketNo: string;
  type: string;
  title: string;
  status: 'YENI' | 'INCELENIYOR' | 'CEVAPLANDI' | 'COZULDU';
  priority: 'DUSUK' | 'ORTA' | 'KRITIK';
  module?: string;
  createdAt: string;
  _count: { messages: number };
}

// ─── Knowledge Base Articles ─────────────────────────────────────────────────

const ARTICLES = [
  {
    id: 1, category: 'Sipariş', icon: '📦',
    title: 'Sipariş nasıl eklenir?',
    keywords: ['sipariş', 'ekle', 'yeni', 'oluştur', 'kaydet'],
    content: `Yeni sipariş eklemek için sol menüden **Siparişler** sekmesine tıklayın.\n\n1. Sağ üstteki **+ Yeni Sipariş** butonuna tıklayın\n2. Müşteri seçin\n3. Ürün ve beden dağılımını girin\n4. Termin tarihi belirleyin\n5. **Kaydet** butonuna tıklayın\n\nSipariş başarıyla oluşturulduktan sonra müşteriye bildirim gönderilir.`,
  },
  {
    id: 2, category: 'Hesap', icon: '🔑',
    title: 'Şifre nasıl değiştirilir?',
    keywords: ['şifre', 'parola', 'değiştir', 'güncelle', 'sıfırla', 'unutdum'],
    content: `Şifrenizi değiştirmek için:\n\n1. Sol alttaki **kullanıcı adınıza** tıklayın\n2. **Profil Ayarları** seçeneğini seçin\n3. **Şifre Değiştir** bölümüne gidin\n4. Mevcut ve yeni şifrenizi girin\n5. **Güncelle** butonuna tıklayın\n\nŞifrenizi unuttuysanız giriş sayfasındaki **Şifremi Unuttum** bağlantısını kullanın.`,
  },
  {
    id: 3, category: 'İçe Aktarma', icon: '📊',
    title: 'Excel aktarımı nasıl yapılır?',
    keywords: ['excel', 'içe aktar', 'import', 'dışa aktar', 'export', 'aktarım', 'xlsx'],
    content: `Excel ile veri aktarmak için ilgili modülün listesine gidin.\n\n**İçe Aktarma:**\n1. Sağ üstteki **↑ İçe Aktar** butonuna tıklayın\n2. **Şablon İndir** ile örnek dosyayı indirin\n3. Dosyayı doldurun\n4. Doldurulan dosyayı yükleyin\n5. **Aktar** butonuna tıklayın\n\n**Dışa Aktarma:**\n1. **↓ Dışa Aktar** butonuna tıklayın\n2. Dosya otomatik olarak indirilir`,
  },
  {
    id: 4, category: 'Personel', icon: '👥',
    title: 'Personel nasıl eklenir?',
    keywords: ['personel', 'çalışan', 'ekle', 'yeni', 'işçi', 'eleman'],
    content: `Yeni personel kaydı oluşturmak için:\n\n1. Sol menüden **Personel Takip** sayfasına gidin\n2. **+ Yeni Personel** butonuna tıklayın\n3. Ad, soyad ve iletişim bilgilerini girin\n4. Departman ve pozisyon seçin\n5. İşe başlama tarihini girin\n6. **Kaydet** butonuna tıklayın\n\nPersonel ekledikten sonra belge yükleyebilir ve maaş takibi yapabilirsiniz.`,
  },
  {
    id: 5, category: 'Stok', icon: '📦',
    title: 'Stok neden görünmüyor?',
    keywords: ['stok', 'görünmüyor', 'eksik', 'miktar', 'ürün', 'stok yok', 'sıfır'],
    content: `Stok miktarı görünmüyorsa aşağıdakileri kontrol edin:\n\n1. **Satış faturası** kesildiğinde stok otomatik düşer\n2. **Alış faturası** girişinde stok artmalı — tekrar kontrol edin\n3. Ürün sayfasında **Stok Hareketleri** sekmesini inceleyin\n4. Stok düzeltmesi için **Manuel Düzeltme** özelliğini kullanabilirsiniz\n\nHâlâ sorun yaşıyorsanız ilgili fatura numarasıyla destek talebi oluşturun.`,
  },
  {
    id: 6, category: 'Fatura', icon: '🧾',
    title: 'Satış faturası nasıl oluşturulur?',
    keywords: ['fatura', 'satış', 'oluştur', 'kesim', 'düzenle', 'yeni fatura'],
    content: `Satış faturası oluşturmak için:\n\n1. Sol menüden **Satışlar** sayfasına gidin\n2. **+ Yeni Fatura** butonuna tıklayın\n3. Müşteri seçin\n4. Ürün ve miktarları girin\n5. KDV oranını belirleyin\n6. **Fatura Oluştur** butonuna tıklayın\n\nFatura oluşturulduktan sonra PDF olarak indirebilir veya e-posta ile gönderebilirsiniz.`,
  },
  {
    id: 7, category: 'Tedarikçi', icon: '🏭',
    title: 'Tedarikçi nasıl eklenir?',
    keywords: ['tedarikçi', 'supplier', 'satıcı', 'ekle', 'yeni'],
    content: `Yeni tedarikçi eklemek için:\n\n1. Sol menüden **Tedarikçiler** sayfasına gidin\n2. **+ Yeni Tedarikçi** butonuna tıklayın\n3. Firma adı, iletişim ve vergi bilgilerini girin\n4. Para birimini seçin\n5. **Kaydet** butonuna tıklayın\n\nTedarikçi eklendikten sonra alış faturası ve ödeme takibi yapabilirsiniz.`,
  },
  {
    id: 8, category: 'Hesaplar', icon: '🏦',
    title: 'Kasa / Banka hesabı nasıl eklenir?',
    keywords: ['kasa', 'banka', 'hesap', 'ekle', 'para', 'bakiye'],
    content: `Yeni kasa veya banka hesabı eklemek için:\n\n1. Sol menüden **Hesaplar** sayfasına gidin\n2. **+ Yeni Hesap** butonuna tıklayın\n3. Hesap adı ve türünü (Kasa/Banka) seçin\n4. Para birimini seçin\n5. Başlangıç bakiyesini girin\n6. **Kaydet** butonuna tıklayın`,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_MAP = {
  YENI:        { label: 'Yeni',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  INCELENIYOR: { label: 'İnceleniyor', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  CEVAPLANDI:  { label: 'Cevaplandı',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  COZULDU:     { label: 'Çözüldü',     color: 'bg-green-100 text-green-700 border-green-200' },
};

const PRIORITY_MAP = {
  DUSUK:  { label: 'Düşük',  color: 'bg-slate-100 text-slate-600 border-slate-200' },
  ORTA:   { label: 'Orta',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  KRITIK: { label: 'Kritik', color: 'bg-red-100 text-red-700 border-red-200' },
};

const MODULES = ['Ön Muhasebe', 'Maliyet', 'Personel', 'Sipariş', 'Stok', 'Diğer'];

function Badge({ map, value }: { map: Record<string, { label: string; color: string }>; value: string }) {
  const entry = map[value] ?? { label: value, color: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${entry.color}`}>
      {entry.label}
    </span>
  );
}

function getSuggestedArticles(text: string) {
  if (text.length < 3) return [];
  const lower = text.toLowerCase();
  return ARTICLES.filter(a => a.keywords.some(kw => lower.includes(kw))).slice(0, 3);
}

// ─── Tab: Hata Bildir ─────────────────────────────────────────────────────────

function HataBildir({ onSuccess }: { onSuccess: () => void }) {
  const { data: session } = useSession() || {};
  const [form, setForm] = useState({ title: '', description: '', module: '', priority: 'ORTA' });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const suggestions = getSuggestedArticles(form.description || form.title);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('type', 'BUG');
      fd.append('title', form.title);
      fd.append('description', form.description);
      if (form.module) fd.append('module', form.module);
      fd.append('priority', form.priority);
      fd.append('pageUrl', window.location.href);
      fd.append('browser', navigator.userAgent);
      if (file) fd.append('screenshot', file);

      const res = await fetch('/api/support/tickets', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-4"
        >
          <p className="text-xs font-semibold text-blue-600 mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Bu konuyla ilgili makaleler bulundu
          </p>
          <div className="space-y-1.5">
            {suggestions.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  const tabs = document.querySelector('[data-tab="bilgi"]') as HTMLButtonElement;
                  tabs?.click();
                }}
                className="w-full text-left flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-lg px-2 py-1 transition-colors"
              >
                <span>{a.icon}</span>
                <span>{a.title}</span>
                <ChevronRight className="w-3.5 h-3.5 ml-auto flex-shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Konu *</label>
          <input
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Hatayı kısaca özetleyin"
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Modül</label>
          <select
            value={form.module}
            onChange={e => setForm(p => ({ ...p, module: e.target.value }))}
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          >
            <option value="">Seçiniz</option>
            {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Öncelik</label>
          <div className="flex gap-2">
            {(['DUSUK', 'ORTA', 'KRITIK'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                  form.priority === p
                    ? PRIORITY_MAP[p].color + ' ring-2 ring-offset-1 ring-current'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {PRIORITY_MAP[p].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Açıklama *</label>
        <textarea
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          rows={5}
          placeholder="Hatayı ayrıntılı açıklayın. Hangi adımları izlediniz? Ne bekliyordunuz?"
          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-white"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Ekran Görüntüsü</label>
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
            file ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Paperclip className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }} className="ml-2 text-slate-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div>
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Görsel yüklemek için tıklayın</p>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG, WebP · max 5MB</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>

      {/* Auto-attached info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
        <p className="text-xs font-medium text-slate-500 mb-2">Otomatik eklenen bilgiler</p>
        <div className="flex flex-wrap gap-2">
          {[
            `Kullanıcı: ${(session?.user as any)?.name ?? '-'}`,
            `Sayfa: ${typeof window !== 'undefined' ? window.location.pathname : '-'}`,
            `Tarih: ${new Date().toLocaleDateString('tr-TR')}`,
          ].map(info => (
            <span key={info} className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600">
              {info}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Hata Bildir
      </button>
    </form>
  );
}

// ─── Tab: Talep / Öneri ───────────────────────────────────────────────────────

function TalepOneri({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', module: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('type', 'ONERI');
      fd.append('title', form.title);
      fd.append('description', form.description);
      if (form.module) fd.append('module', form.module);
      fd.append('priority', 'DUSUK');
      fd.append('pageUrl', window.location.href);
      fd.append('browser', navigator.userAgent);

      const res = await fetch('/api/support/tickets', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Öneriniz değerlendirmeye alınacaktır</p>
          <p className="text-xs text-amber-600 mt-0.5">Önerilen özellikler ürün yol haritamıza eklenmekte ve kullanıcı talepleri doğrultusunda önceliklendirilmektedir.</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Başlık *</label>
        <input
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          placeholder="Önerinizi kısaca özetleyin"
          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">İlgili Modül</label>
        <select
          value={form.module}
          onChange={e => setForm(p => ({ ...p, module: e.target.value }))}
          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
        >
          <option value="">Seçiniz</option>
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Açıklama *</label>
        <textarea
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          rows={5}
          placeholder="Bu özellik neden gerekli? Nasıl çalışmasını istersiniz? Hangi sorunu çözer?"
          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-white"
          required
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Öneriyi Gönder
      </button>
    </form>
  );
}

// ─── Tab: Taleplerim ─────────────────────────────────────────────────────────

function Taleplerim() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/support/tickets')
      .then(r => r.json())
      .then(data => { setTickets(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );

  if (tickets.length === 0) return (
    <div className="text-center py-16">
      <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500 font-medium">Henüz talep oluşturmadınız</p>
      <p className="text-slate-400 text-sm mt-1">Hata bildirmek veya öneri göndermek için ilgili sekmeleri kullanın.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {tickets.map((t, i) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <Link
            href={`/destek-merkezi/talep/${t.id}`}
            className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                t.type === 'BUG' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                {t.type === 'BUG' ? <Bug className="w-4 h-4 text-red-500" /> : <Lightbulb className="w-4 h-4 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-slate-400">{t.ticketNo}</span>
                  <Badge map={STATUS_MAP} value={t.status} />
                  <Badge map={PRIORITY_MAP} value={t.priority} />
                  {t.module && (
                    <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">{t.module}</span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800 mt-1 truncate group-hover:text-blue-700">{t.title}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(t.createdAt).toLocaleDateString('tr-TR')}
                  </span>
                  {t._count.messages > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {t._count.messages} mesaj
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors" />
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Tab: Bilgi Bankası ───────────────────────────────────────────────────────

function BilgiBank() {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = ARTICLES.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.keywords.some(k => k.includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-2xl space-y-5">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Makale ara... (örn: stok, fatura, şifre)"
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
        />
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Bu aramayla eşleşen makale bulunamadı.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(a => (
          <motion.div
            key={a.id}
            layout
            className="bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="text-xl flex-shrink-0">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{a.category}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${expanded === a.id ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {expanded === a.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="px-4 pb-4 border-t border-slate-100">
                    <div className="pt-3 prose prose-sm prose-slate max-w-none text-sm text-slate-600 whitespace-pre-line">
                      {a.content}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <p className="text-xs text-slate-400">Bu makale yardımcı oldu mu?</p>
                      <button className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors">
                        <Star className="w-3 h-3" /> Evet
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: any; desc: string }[] = [
  { id: 'hata',    label: 'Hata Bildir',      icon: Bug,          desc: 'Teknik sorun bildirin' },
  { id: 'oneri',   label: 'Talep / Öneri',    icon: Lightbulb,    desc: 'Yeni özellik önerin' },
  { id: 'talepler',label: 'Taleplerim',       icon: ClipboardList,desc: 'Geçmiş talepleriniz' },
  { id: 'bilgi',   label: 'Bilgi Bankası',    icon: BookOpen,     desc: 'Sık sorulan sorular' },
];

export default function DestekMerkeziPage() {
  const [activeTab, setActiveTab] = useState<Tab>('hata');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSuccess = () => {
    setSuccessMsg('Talebiniz başarıyla oluşturuldu. En kısa sürede yanıt vereceğiz.');
    setActiveTab('talepler');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <LifeBuoy className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-800">Destek Merkezi</h1>
            </div>
            <p className="text-sm text-slate-500 ml-12">Sorun bildirin, öneri gönderin, destek alın.</p>
          </div>
        </div>

        {/* Success Banner */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl"
            >
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-700">{successMsg}</p>
              <button onClick={() => setSuccessMsg('')} className="ml-auto text-green-400 hover:text-green-600">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Navigation */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {activeTab === 'hata'    && <HataBildir   onSuccess={handleSuccess} />}
              {activeTab === 'oneri'   && <TalepOneri   onSuccess={handleSuccess} />}
              {activeTab === 'talepler'&& <Taleplerim />}
              {activeTab === 'bilgi'   && <BilgiBank />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  );
}
